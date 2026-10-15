// Página pública "Mi cita": el paciente abre el enlace de su recordatorio y
// puede confirmar o cancelar su cita sin iniciar sesión. El token de 64
// caracteres aleatorios es la única llave; solo permite actuar sobre esa cita.
const router    = require("express").Router();
const pool      = require("../db");
const rateLimit = require("express-rate-limit");
const dayjs     = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const sse       = require("../utils/sseManager");
const webPush   = require("../utils/webPush");
const gcal      = require("../utils/googleCalendar");
const { asegurarTabla } = require("../utils/citaEnlace");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
});

const TOKEN_RE = /^[a-f0-9]{64}$/;

async function buscarCita(token) {
  if (!TOKEN_RE.test(token)) return null;
  await asegurarTabla();
  const [[cita]] = await pool.query(
    `SELECT c.id, c.clinica_id, c.medico_id, c.estado, c.google_event_id,
            DATE_FORMAT(c.inicio, '%Y-%m-%d %H:%i:%s') AS inicio,
            p.nombres AS paciente_nombres,
            CONCAT(u.nombres, ' ', u.apellidos) AS medico,
            cl.nombre AS clinica, cl.logo_url, cl.telefono AS clinica_telefono,
            COALESCE(cl.timezone, 'America/Tegucigalpa') AS tz,
            e.accion, e.accion_en
     FROM cita_enlaces e
     JOIN citas c      ON c.id = e.cita_id
     JOIN pacientes p  ON p.id = c.paciente_id
     JOIN usuarios u   ON u.id = c.medico_id
     JOIN clinicas cl  ON cl.id = c.clinica_id
     WHERE e.token = ?`,
    [token]
  );
  return cita || null;
}

// La cita aún no ha pasado (se compara en la hora local de la clínica,
// igual que el envío de recordatorios: citas.inicio es hora local sin zona)
function esFutura(cita) {
  return cita.inicio > dayjs().tz(cita.tz).format("YYYY-MM-DD HH:mm:ss");
}

function vista(cita) {
  const futura = esFutura(cita);
  return {
    paciente: String(cita.paciente_nombres || "").split(" ")[0],
    medico: cita.medico,
    clinica: cita.clinica,
    logo_url: cita.logo_url,
    clinica_telefono: cita.clinica_telefono,
    inicio: cita.inicio,
    estado: cita.estado,
    puede_confirmar: futura && cita.estado === "PENDIENTE",
    puede_cancelar: futura && ["PENDIENTE", "CONFIRMADA"].includes(cita.estado),
  };
}

async function avisarClinica(cita, accion) {
  try {
    const [usuarios] = await pool.query(
      `SELECT id FROM usuarios WHERE clinica_id = ? AND activo = 1 AND tipo <> 'SUPER_ADMIN'`,
      [cita.clinica_id]
    );
    if (!usuarios.length) return;
    const fecha = dayjs(cita.inicio).format("DD/MM/YYYY h:mm A");
    const verbo = accion === "CONFIRMADA" ? "confirmó" : "canceló";
    const mensaje = `${cita.paciente_nombres} ${verbo} su cita del ${fecha} desde el recordatorio`;
    const tipo = accion === "CONFIRMADA" ? "CITA_CONFIRMADA_PACIENTE" : "CITA_CANCELADA_PACIENTE";

    await pool.query(
      `INSERT INTO notificaciones_usuario (usuario_id, clinica_id, tipo, mensaje, paciente_id, cita_id) VALUES ?`,
      [usuarios.map((u) => [u.id, cita.clinica_id, tipo, mensaje.slice(0, 300), null, cita.id])]
    );
    for (const u of usuarios) sse.notifyUser(u.id, "notificacion_portal", { tipo, mensaje, cita_id: cita.id });
    await webPush.sendToUsers(pool, usuarios.map((u) => u.id), {
      title: accion === "CONFIRMADA" ? "Cita confirmada" : "Cita cancelada",
      body: mensaje, tag: tipo, data: { tipo, cita_id: cita.id, url: "/citas" },
    });
  } catch (e) {
    console.error("[citaPublica] aviso a la clínica:", e.message);
  }
}

// GET /api/cita-publica/:token
router.get("/:token", limiter, async (req, res) => {
  try {
    const cita = await buscarCita(req.params.token);
    if (!cita) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    res.json({ ok: true, data: vista(cita) });
  } catch (e) {
    console.error("[citaPublica] GET:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar la cita." });
  }
});

// POST /api/cita-publica/:token/confirmar
router.post("/:token/confirmar", limiter, async (req, res) => {
  try {
    const cita = await buscarCita(req.params.token);
    if (!cita) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    if (cita.estado === "CONFIRMADA") return res.json({ ok: true, data: vista(cita) });
    if (!vista(cita).puede_confirmar) {
      return res.status(409).json({ ok: false, msg: "Esta cita ya no se puede confirmar.", data: vista(cita) });
    }

    // Solo cambia si sigue PENDIENTE (por si la clínica la movió mientras tanto)
    const [r] = await pool.query(
      "UPDATE citas SET estado='CONFIRMADA' WHERE id=? AND estado='PENDIENTE'", [cita.id]);
    if (r.affectedRows) {
      await pool.query("UPDATE cita_enlaces SET accion='CONFIRMADA', accion_en=NOW() WHERE cita_id=?", [cita.id]);
      avisarClinica(cita, "CONFIRMADA");
    }
    res.json({ ok: true, data: vista(await buscarCita(req.params.token)) });
  } catch (e) {
    console.error("[citaPublica] confirmar:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo confirmar la cita." });
  }
});

// POST /api/cita-publica/:token/cancelar
router.post("/:token/cancelar", limiter, async (req, res) => {
  try {
    const cita = await buscarCita(req.params.token);
    if (!cita) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    if (cita.estado === "CANCELADA") return res.json({ ok: true, data: vista(cita) });
    if (!vista(cita).puede_cancelar) {
      return res.status(409).json({ ok: false, msg: "Esta cita ya no se puede cancelar.", data: vista(cita) });
    }

    const [r] = await pool.query(
      "UPDATE citas SET estado='CANCELADA' WHERE id=? AND estado IN ('PENDIENTE','CONFIRMADA')", [cita.id]);
    if (r.affectedRows) {
      await pool.query("UPDATE cita_enlaces SET accion='CANCELADA', accion_en=NOW() WHERE cita_id=?", [cita.id]);
      if (cita.google_event_id) {
        gcal.borrarEvento(cita.medico_id, cita.google_event_id)
          .catch((e) => console.error("[citaPublica] Google Calendar:", e.message));
      }
      avisarClinica(cita, "CANCELADA");
    }
    res.json({ ok: true, data: vista(await buscarCita(req.params.token)) });
  } catch (e) {
    console.error("[citaPublica] cancelar:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cancelar la cita." });
  }
});

module.exports = router;
