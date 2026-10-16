/**
 * routes/portalPaciente.js — Portal del paciente  (/api/portal)
 *
 * Acceso sin contraseña: el paciente escribe su correo y recibe un enlace de
 * un solo uso (15 min). Al abrirlo obtiene una sesión de 7 días para ver sus
 * citas, recetas y estudios pendientes en todas las clínicas donde ese correo
 * esté registrado.
 *
 * - Solo lectura sobre los datos clínicos; confirmar/cancelar citas reutiliza
 *   los enlaces de /mi-cita (routes/citaPublica.js).
 * - Tabla nueva portal_accesos; no modifica tablas existentes.
 * - La sesión se firma con una clave derivada distinta a la del personal: un
 *   token del portal nunca sirve para las rutas internas, ni al revés.
 */
const router    = require("express").Router();
const crypto    = require("crypto");
const jwt       = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const dayjs     = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool      = require("../db");
const { enviarEmail } = require("../utils/mailer");
const { obtenerToken } = require("../utils/citaEnlace");
const { urlPublica } = require("../utils/urlPublica");

const ACCESO_MINUTOS = 15;
const SESION = "7d";

let tablaLista = null;
function asegurarTabla() {
  if (!tablaLista) {
    tablaLista = pool.query(`
      CREATE TABLE IF NOT EXISTS portal_accesos (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email       VARCHAR(120) NOT NULL,
        token_hash  CHAR(64) NOT NULL UNIQUE,
        expira_en   DATETIME NOT NULL,
        usado_en    DATETIME NULL,
        ip          VARCHAR(45) NULL,
        creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_portal_accesos_email (email, creado_en)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((e) => { tablaLista = null; throw e; });
  }
  return tablaLista;
}

function claveSesion() {
  if (!process.env.JWT_SECRET) return null;
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update("portal-paciente").digest("hex");
}

const sha256 = (t) => crypto.createHash("sha256").update(t).digest("hex");
const normalizarEmail = (e) => String(e || "").trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapar = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const limiterAcceso = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
});

const limiterEntrar = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
});

const limiterPortal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
});

async function pacientesDeEmail(email) {
  const [rows] = await pool.query(
    `SELECT p.id, p.clinica_id, p.nombres, p.apellidos, p.dni, p.fecha_nacimiento, p.telefono,
            c.nombre AS clinica, c.slug AS clinica_slug, c.logo_url, c.telefono AS clinica_telefono,
            COALESCE(c.timezone, 'America/Tegucigalpa') AS tz
     FROM pacientes p
     JOIN clinicas c ON c.id = p.clinica_id
     WHERE LOWER(p.email) = ? AND p.activo = 1 AND c.activo = 1
     ORDER BY c.nombre`,
    [email]
  );
  return rows;
}

function plantillaAcceso({ nombre, link }) {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:24px">
    <div style="background:#fff;border-radius:12px;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f766e;margin:0 0 8px">Hola ${escapar(nombre)} 👋</h2>
      <p style="color:#475569">Recibimos una solicitud para entrar a tu <strong>portal de paciente</strong>,
        donde puedes ver tus citas, recetas y estudios.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Entrar a mi portal</a>
      </p>
      <p style="color:#94a3b8;font-size:13px">El enlace funciona una sola vez y vence en ${ACCESO_MINUTOS} minutos.
        Si no fuiste tú, ignora este mensaje: nadie puede entrar sin abrir este correo.</p>
    </div>
  </div>`;
}

// ── POST /api/portal/acceso  { email }  → envía el enlace de entrada ──────────
router.post("/acceso", limiterAcceso, async (req, res) => {
  const email = normalizarEmail(req.body?.email);
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return res.status(400).json({ ok: false, msg: "Escribe un correo válido." });
  }
  // Respuesta idéntica exista o no el correo: no revela quién es paciente
  const respuesta = { ok: true, msg: "Si tu correo está registrado en una clínica, te enviamos un enlace para entrar." };
  try {
    if (!claveSesion() || !process.env.FRONTEND_URL) {
      console.error("[portal] Falta JWT_SECRET o FRONTEND_URL");
      return res.status(503).json({ ok: false, msg: "El portal no está disponible en este momento." });
    }
    await asegurarTabla();
    const pacientes = await pacientesDeEmail(email);
    if (!pacientes.length) return res.json(respuesta);

    // Máximo 3 enlaces por correo cada 15 min (además del límite por IP)
    const [[{ recientes }]] = await pool.query(
      "SELECT COUNT(*) AS recientes FROM portal_accesos WHERE email = ? AND creado_en > NOW() - INTERVAL 15 MINUTE",
      [email]
    );
    if (recientes >= 3) return res.json(respuesta);

    const token = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO portal_accesos (email, token_hash, expira_en, ip)
       VALUES (?, ?, NOW() + INTERVAL ${ACCESO_MINUTOS} MINUTE, ?)`,
      [email, sha256(token), String(req.ip || "").slice(0, 45)]
    );

    const link = `${urlPublica()}/portal/entrar/${token}`;
    await enviarEmail({
      to: email,
      subject: "Tu enlace para entrar al portal de paciente",
      html: plantillaAcceso({ nombre: pacientes[0].nombres.split(" ")[0], link }),
    });
    res.json(respuesta);
  } catch (e) {
    console.error("[portal] acceso:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo enviar el enlace. Intenta de nuevo." });
  }
});

// ── POST /api/portal/entrar  { token }  → canjea el enlace por una sesión ─────
router.post("/entrar", limiterEntrar, async (req, res) => {
  try {
    const token = String(req.body?.token || "");
    const clave = claveSesion();
    if (!/^[a-f0-9]{64}$/.test(token) || !clave) {
      return res.status(400).json({ ok: false, msg: "El enlace no es válido." });
    }
    await asegurarTabla();
    // Se marca usado en la misma sentencia: dos clics simultáneos no generan dos sesiones
    const [r] = await pool.query(
      "UPDATE portal_accesos SET usado_en = NOW() WHERE token_hash = ? AND usado_en IS NULL AND expira_en > NOW()",
      [sha256(token)]
    );
    if (!r.affectedRows) {
      return res.status(400).json({ ok: false, msg: "El enlace ya se usó o venció. Pide uno nuevo." });
    }
    const [[acceso]] = await pool.query("SELECT email FROM portal_accesos WHERE token_hash = ?", [sha256(token)]);
    const sesion = jwt.sign({ email: acceso.email, tipo: "portal_paciente" }, clave, { expiresIn: SESION });
    res.json({ ok: true, token: sesion });
  } catch (e) {
    console.error("[portal] entrar:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo iniciar sesión." });
  }
});

// ── Middleware de sesión del portal ──────────────────────────────────────────
async function sesionPortal(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const clave = claveSesion();
    if (!header.startsWith("Bearer ") || !clave) {
      return res.status(401).json({ ok: false, msg: "Inicia sesión para continuar." });
    }
    let payload;
    try {
      payload = jwt.verify(header.slice(7), clave);
    } catch {
      return res.status(401).json({ ok: false, msg: "Tu sesión venció. Vuelve a entrar." });
    }
    if (payload.tipo !== "portal_paciente" || !payload.email) {
      return res.status(401).json({ ok: false, msg: "Sesión inválida." });
    }
    const pacientes = await pacientesDeEmail(payload.email);
    if (!pacientes.length) return res.status(401).json({ ok: false, msg: "Tu cuenta ya no está activa." });
    req.portal = { email: payload.email, pacientes, ids: pacientes.map((p) => p.id) };
    next();
  } catch (e) {
    console.error("[portal] sesión:", e.message);
    res.status(500).json({ ok: false, msg: "Error del servidor." });
  }
}

// ── GET /api/portal/yo ───────────────────────────────────────────────────────
router.get("/yo", limiterPortal, sesionPortal, (req, res) => {
  res.json({
    ok: true,
    data: {
      email: req.portal.email,
      perfiles: req.portal.pacientes.map((p) => ({
        id: p.id,
        nombres: p.nombres,
        apellidos: p.apellidos,
        dni: p.dni,
        fecha_nacimiento: p.fecha_nacimiento ? dayjs(p.fecha_nacimiento).format("YYYY-MM-DD") : null,
        telefono: p.telefono,
        clinica: p.clinica,
        clinica_slug: p.clinica_slug,
        clinica_telefono: p.clinica_telefono,
        logo_url: p.logo_url,
      })),
    },
  });
});

// ── GET /api/portal/citas ────────────────────────────────────────────────────
router.get("/citas", limiterPortal, sesionPortal, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.paciente_id, c.estado, c.motivo,
              DATE_FORMAT(c.inicio, '%Y-%m-%d %H:%i:%s') AS inicio,
              CONCAT(u.nombres, ' ', u.apellidos) AS medico,
              cl.nombre AS clinica, COALESCE(cl.timezone, 'America/Tegucigalpa') AS tz
       FROM citas c
       JOIN usuarios u  ON u.id = c.medico_id
       JOIN clinicas cl ON cl.id = c.clinica_id
       WHERE c.paciente_id IN (?)
       ORDER BY c.inicio DESC
       LIMIT 200`,
      [req.portal.ids]
    );

    const proximas = [];
    const anteriores = [];
    for (const c of rows) {
      const futura = c.inicio > dayjs().tz(c.tz).format("YYYY-MM-DD HH:mm:ss");
      const item = { id: c.id, inicio: c.inicio, estado: c.estado, motivo: c.motivo, medico: c.medico, clinica: c.clinica };
      if (futura && !["CANCELADA", "NO_ASISTIO", "COMPLETADA"].includes(c.estado)) {
        // Enlace a /mi-cita para confirmar o cancelar (mismo flujo del recordatorio)
        if (["PENDIENTE", "CONFIRMADA"].includes(c.estado)) item.enlace = await obtenerToken(c.id);
        proximas.push(item);
      } else {
        anteriores.push(item);
      }
    }
    proximas.reverse(); // la más cercana primero
    res.json({ ok: true, data: { proximas, anteriores } });
  } catch (e) {
    console.error("[portal] citas:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar tus citas." });
  }
});

// ── GET /api/portal/recetas ──────────────────────────────────────────────────
router.get("/recetas", limiterPortal, sesionPortal, async (req, res) => {
  try {
    const [recetas] = await pool.query(
      `SELECT pr.id, pr.codigo_qr, DATE_FORMAT(pr.creado_en, '%Y-%m-%d %H:%i:%s') AS fecha,
              CONCAT(u.nombres, ' ', u.apellidos) AS medico, cl.nombre AS clinica
       FROM prescripciones pr
       JOIN usuarios u  ON u.id = pr.medico_id
       JOIN clinicas cl ON cl.id = pr.clinica_id
       WHERE pr.paciente_id IN (?)
       ORDER BY pr.creado_en DESC
       LIMIT 100`,
      [req.portal.ids]
    );
    if (recetas.length) {
      const [items] = await pool.query(
        `SELECT pi.prescripcion_id, COALESCE(m.nombre_generico, pi.medicamento_texto) AS medicamento,
                pi.dosis, pi.duracion, pi.instrucciones
         FROM prescripcion_items pi
         LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
         WHERE pi.prescripcion_id IN (?)`,
        [recetas.map((r) => r.id)]
      );
      for (const r of recetas) r.items = items.filter((i) => i.prescripcion_id === r.id);
    }
    res.json({ ok: true, data: recetas });
  } catch (e) {
    console.error("[portal] recetas:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar tus recetas." });
  }
});

// ── GET /api/portal/estudios  (solo solicitudes; los resultados los explica el médico) ──
router.get("/estudios", limiterPortal, sesionPortal, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT es.id, es.tipo, es.descripcion, es.urgente, es.estado,
              DATE_FORMAT(es.creado_en, '%Y-%m-%d %H:%i:%s') AS fecha,
              CONCAT(u.nombres, ' ', u.apellidos) AS medico, cl.nombre AS clinica
       FROM estudios_solicitudes es
       JOIN usuarios u  ON u.id = es.medico_id
       JOIN clinicas cl ON cl.id = es.clinica_id
       WHERE es.paciente_id IN (?)
       ORDER BY es.creado_en DESC
       LIMIT 100`,
      [req.portal.ids]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("[portal] estudios:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar tus estudios." });
  }
});

module.exports = router;
module.exports.asegurarTabla = asegurarTabla;
