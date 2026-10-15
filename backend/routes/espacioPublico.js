// /api/espacio/:token — el paciente en lista de espera acepta (o rechaza) el
// espacio liberado que le llegó por correo. Sin sesión: el token aleatorio de
// 64 caracteres es la llave, y solo sirve para esa oferta.
const router    = require("express").Router();
const rateLimit = require("express-rate-limit");
const dayjs     = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool      = require("../db");
const sse       = require("../utils/sseManager");
const webPush   = require("../utils/webPush");
const gcal      = require("../utils/googleCalendar");
const { asegurarTablas, horarioLibre, etiquetaFecha } = require("../utils/listaEspera");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
});

async function buscarOferta(token, conn = pool) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  await asegurarTablas();
  const [[o]] = await conn.query(
    `SELECT o.id, o.estado AS oferta_estado, o.cita_origen_id, o.lista_espera_id,
            e.clinica_id, e.medico_id, e.tomado_oferta_id, e.cita_nueva_id,
            DATE_FORMAT(e.inicio, '%Y-%m-%d %H:%i:%s') AS inicio,
            DATE_FORMAT(e.fin,    '%Y-%m-%d %H:%i:%s') AS fin,
            le.paciente_id, le.estado AS lista_estado, le.nota,
            p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
            CONCAT(u.nombres, ' ', u.apellidos) AS medico,
            cl.nombre AS clinica, cl.logo_url, cl.telefono AS clinica_telefono,
            COALESCE(cl.timezone, 'America/Tegucigalpa') AS tz
     FROM lista_espera_ofertas o
     JOIN lista_espera_espacios e ON e.cita_origen_id = o.cita_origen_id
     JOIN lista_espera le ON le.id = o.lista_espera_id
     JOIN pacientes p     ON p.id = le.paciente_id
     JOIN usuarios u      ON u.id = e.medico_id
     JOIN clinicas cl     ON cl.id = e.clinica_id
     WHERE o.token = ?`,
    [token]
  );
  return o || null;
}

function situacion(o) {
  if (o.tomado_oferta_id === o.id) return "TUYO";
  if (o.oferta_estado === "RECHAZADA") return "RECHAZADA";
  if (o.tomado_oferta_id != null || o.oferta_estado === "TARDE") return "TOMADO";
  if (o.lista_estado !== "ACTIVA") return "CERRADA";
  if (o.inicio <= dayjs().tz(o.tz).format("YYYY-MM-DD HH:mm:ss")) return "VENCIDO";
  return "DISPONIBLE";
}

function vista(o, extra = {}) {
  return {
    paciente: String(o.paciente_nombres || "").split(" ")[0],
    medico: o.medico,
    clinica: o.clinica,
    logo_url: o.logo_url,
    clinica_telefono: o.clinica_telefono,
    inicio: o.inicio,
    situacion: situacion(o),
    ...extra,
  };
}

router.get("/:token", limiter, async (req, res) => {
  try {
    const o = await buscarOferta(req.params.token);
    if (!o) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    res.json({ ok: true, data: vista(o) });
  } catch (e) {
    console.error("[espacio] GET:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar el espacio." });
  }
});

router.post("/:token/aceptar", limiter, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const o = await buscarOferta(req.params.token, conn);
    if (!o) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    if (situacion(o) !== "DISPONIBLE") return res.json({ ok: true, data: vista(o) });

    await conn.beginTransaction();
    // El primero que logra esta actualización se queda con el espacio
    const [r] = await conn.query(
      "UPDATE lista_espera_espacios SET tomado_oferta_id=? WHERE cita_origen_id=? AND tomado_oferta_id IS NULL",
      [o.id, o.cita_origen_id]);
    if (!r.affectedRows) {
      await conn.rollback();
      await pool.query("UPDATE lista_espera_ofertas SET estado='TARDE', respondido_en=NOW() WHERE id=?", [o.id]);
      return res.json({ ok: true, data: vista(await buscarOferta(req.params.token)) });
    }
    // Por si la clínica ya ocupó ese horario a mano mientras tanto
    if (!(await horarioLibre(conn, { medico_id: o.medico_id, inicio: o.inicio, fin: o.fin }))) {
      await conn.rollback();
      await pool.query("UPDATE lista_espera_espacios SET tomado_oferta_id=0 WHERE cita_origen_id=? AND tomado_oferta_id IS NULL", [o.cita_origen_id]);
      await pool.query("UPDATE lista_espera_ofertas SET estado='TARDE', respondido_en=NOW() WHERE id=?", [o.id]);
      return res.json({ ok: true, data: vista(await buscarOferta(req.params.token)) });
    }

    const [cita] = await conn.query(
      `INSERT INTO citas (clinica_id, paciente_id, medico_id, inicio, fin, motivo, estado, canal)
       VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMADA', 'LISTA_ESPERA')`,
      [o.clinica_id, o.paciente_id, o.medico_id, o.inicio, o.fin, o.nota || "Lista de espera"]);
    await conn.query("UPDATE lista_espera_espacios SET cita_nueva_id=? WHERE cita_origen_id=?", [cita.insertId, o.cita_origen_id]);
    await conn.query("UPDATE lista_espera_ofertas SET estado='ACEPTADA', respondido_en=NOW() WHERE id=?", [o.id]);
    await conn.query(
      "UPDATE lista_espera SET estado='AGENDADA', cita_id=?, actualizado_en=NOW() WHERE id=?",
      [cita.insertId, o.lista_espera_id]);
    await conn.commit();

    avisarClinica(o, cita.insertId);
    gcal.crearEvento(o.medico_id, {
      paciente_nombre: `${o.paciente_nombres} ${o.paciente_apellidos}`,
      motivo: o.nota || "Lista de espera",
      inicio: o.inicio, fin: o.fin,
    }, o.tz)
      .then((id) => id && pool.query("UPDATE citas SET google_event_id=? WHERE id=?", [id, cita.insertId]))
      .catch((e) => console.error("[espacio] Google Calendar:", e.message));

    res.json({ ok: true, data: vista(await buscarOferta(req.params.token)) });
  } catch (e) {
    await conn.rollback().catch(() => {});
    console.error("[espacio] aceptar:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo reservar el espacio. Intenta de nuevo." });
  } finally {
    conn.release();
  }
});

router.post("/:token/rechazar", limiter, async (req, res) => {
  try {
    const o = await buscarOferta(req.params.token);
    if (!o) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    if (o.oferta_estado === "ENVIADA") {
      await pool.query("UPDATE lista_espera_ofertas SET estado='RECHAZADA', respondido_en=NOW() WHERE id=?", [o.id]);
    }
    res.json({ ok: true, data: vista(await buscarOferta(req.params.token)) });
  } catch (e) {
    console.error("[espacio] rechazar:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo registrar tu respuesta." });
  }
});

async function avisarClinica(o, citaId) {
  try {
    const [usuarios] = await pool.query(
      `SELECT id FROM usuarios WHERE clinica_id = ? AND activo = 1 AND tipo <> 'SUPER_ADMIN'`, [o.clinica_id]);
    if (!usuarios.length) return;
    const tipo = "CITA_LISTA_ESPERA";
    const mensaje = `${o.paciente_nombres} ${o.paciente_apellidos} tomó desde la lista de espera el espacio del ${etiquetaFecha(o.inicio)}`.slice(0, 300);
    await pool.query(
      `INSERT INTO notificaciones_usuario (usuario_id, clinica_id, tipo, mensaje, paciente_id, cita_id) VALUES ?`,
      [usuarios.map((u) => [u.id, o.clinica_id, tipo, mensaje, o.paciente_id, citaId])]);
    for (const u of usuarios) sse.notifyUser(u.id, "notificacion_portal", { tipo, mensaje, cita_id: citaId });
    await webPush.sendToUsers(pool, usuarios.map((u) => u.id), {
      title: "Espacio ocupado desde la lista de espera", body: mensaje, tag: tipo,
      data: { tipo, cita_id: citaId, url: "/citas" },
    });
  } catch (e) {
    console.error("[espacio] aviso a la clínica:", e.message);
  }
}

module.exports = router;
