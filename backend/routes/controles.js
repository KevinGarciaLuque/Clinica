/**
 * routes/controles.js — Recordatorio de control  (/api/controles)
 *
 * El médico programa "control en 1 mes / 3 meses…" desde la cita. Siete días
 * antes de la fecha, el paciente recibe un correo con el enlace para agendar
 * con ese médico. Si el paciente agenda (por cualquier vía) el control queda
 * AGENDADO solo; si no, recepción lo ve en la pestaña "Controles" para llamarle.
 *
 * Tabla nueva controles_programados; no modifica ninguna existente.
 */
const router = require("express").Router();
const dayjs  = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const { enviarEmail } = require("../utils/mailer");
const { urlPublica } = require("../utils/urlPublica");

const DIAS_ANTES_AVISO = 7;
const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

let tablaLista = null;
function asegurarTabla() {
  if (!tablaLista) {
    tablaLista = pool.query(`
      CREATE TABLE IF NOT EXISTS controles_programados (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id    INT UNSIGNED NOT NULL,
        paciente_id   INT UNSIGNED NOT NULL,
        medico_id     INT UNSIGNED NOT NULL,
        cita_origen_id INT UNSIGNED NULL,
        fecha_objetivo DATE NOT NULL,
        motivo        VARCHAR(200) NULL,
        estado        ENUM('PENDIENTE','AVISADO','AGENDADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
        cita_id       INT UNSIGNED NULL,
        creado_por    INT UNSIGNED NULL,
        creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
        avisado_en    DATETIME NULL,
        INDEX idx_cp_clinica (clinica_id, estado, fecha_objetivo),
        INDEX idx_cp_paciente (paciente_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((e) => { tablaLista = null; throw e; });
  }
  return tablaLista;
}

const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Marca AGENDADO los controles cuyo paciente ya tiene una cita con ese médico
 * creada después de programar el control (y que no fue cancelada).
 */
async function sincronizarAgendados(clinicaId = null) {
  await asegurarTabla();
  await pool.query(
    `UPDATE controles_programados cp
     JOIN citas c ON c.paciente_id = cp.paciente_id AND c.medico_id = cp.medico_id
                 AND c.creado_en >= cp.creado_en
                 AND c.estado NOT IN ('CANCELADA','NO_ASISTIO')
                 AND (cp.cita_origen_id IS NULL OR c.id <> cp.cita_origen_id)
     SET cp.estado = 'AGENDADO', cp.cita_id = c.id
     WHERE cp.estado IN ('PENDIENTE','AVISADO') ${clinicaId ? "AND cp.clinica_id = ?" : ""}`,
    clinicaId ? [clinicaId] : []);
}

// ═════════════════════════════════════════════════════════════════════════════
// Aviso diario (cron en server.js)
// ═════════════════════════════════════════════════════════════════════════════
async function enviarAvisosControl() {
  try {
    await asegurarTabla();
    if (!process.env.FRONTEND_URL) return { enviados: 0 };
    await sincronizarAgendados();
    const base = urlPublica();
    const hoy = dayjs().tz("America/Tegucigalpa");
    const limite = hoy.add(DIAS_ANTES_AVISO, "day").format("YYYY-MM-DD");
    const desde = hoy.subtract(30, "day").format("YYYY-MM-DD"); // no avisar controles muy vencidos

    const [pendientes] = await pool.query(
      `SELECT cp.id, cp.medico_id, cp.motivo, DATE_FORMAT(cp.fecha_objetivo,'%Y-%m-%d') AS fecha,
              p.nombres, p.email, u.nombres AS med_nombres, u.apellidos AS med_apellidos, u.tipo AS med_tipo, u.sexo AS med_sexo, u.clinica_id,
              cl.nombre AS clinica, cl.slug AS clinica_slug
       FROM controles_programados cp
       JOIN pacientes p ON p.id = cp.paciente_id
       JOIN usuarios u  ON u.id = cp.medico_id
       JOIN clinicas cl ON cl.id = cp.clinica_id
       WHERE cp.estado = 'PENDIENTE' AND cp.fecha_objetivo BETWEEN ? AND ?
         AND p.activo = 1 AND cl.activo = 1 AND u.activo = 1
         AND p.email IS NOT NULL AND p.email <> ''`,
      [desde, limite]);

    let slugDeMedico = null;
    try { slugDeMedico = require("./perfilPublico").slugDeMedico; } catch { /* sin perfiles: se usa la página de la clínica */ }

    let enviados = 0;
    for (const c of pendientes) {
      let link = c.clinica_slug ? `${base}/p/${c.clinica_slug}?ref=control` : null;
      if (slugDeMedico) {
        try {
          const slug = await slugDeMedico({ id: c.medico_id, nombres: c.med_nombres, apellidos: c.med_apellidos, clinica_id: c.clinica_id });
          link = `${base}/dr/${slug}?ref=control`;
        } catch { /* se queda con el enlace de la clínica */ }
      }
      if (!link) continue;
      // Se marca antes de enviar: si el servidor se reinicia, no se envía dos veces
      const [r] = await pool.query(
        "UPDATE controles_programados SET estado='AVISADO', avisado_en=NOW() WHERE id=? AND estado='PENDIENTE'", [c.id]);
      if (!r.affectedRows) continue;
      try {
        const medico = `${require("../utils/tituloMedico").tituloMedico(c.med_sexo, { tipo: c.med_tipo })}${c.med_nombres} ${c.med_apellidos}`;
        await enviarEmail({
          to: c.email,
          subject: `Es momento de tu control con ${medico}`,
          html: plantillaControl({ nombre: String(c.nombres || "").split(" ")[0], medico, clinica: c.clinica, motivo: c.motivo, fecha: c.fecha, link }),
        });
        enviados++;
      } catch (e) {
        // Si el correo falla, vuelve a PENDIENTE para reintentar mañana
        await pool.query("UPDATE controles_programados SET estado='PENDIENTE', avisado_en=NULL WHERE id=?", [c.id]);
        console.error("[controles] correo:", e.message);
      }
    }
    if (enviados) console.log(`🔔 [controles] ${enviados} aviso(s) de control enviado(s)`);
    return { enviados };
  } catch (e) {
    console.error("[controles] enviarAvisosControl:", e.message);
    return { enviados: 0, error: e.message };
  }
}

function plantillaControl({ nombre, medico, clinica, motivo, fecha, link }) {
  const f = dayjs(fecha).toDate().toLocaleDateString("es-HN", { day: "numeric", month: "long" });
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:24px">
    <div style="background:#fff;border-radius:12px;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f172a;margin:0 0 8px">Hola ${esc(nombre)} 👋</h2>
      <p style="color:#475569">${esc(medico)} te indicó un control${motivo ? ` (<strong>${esc(motivo)}</strong>)` : ""}
        para alrededor del <strong>${esc(f)}</strong> en ${esc(clinica)}.</p>
      <p style="color:#475569">Agenda tu cita en línea y elige el horario que mejor te quede:</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Agendar mi control</a>
      </p>
      <p style="color:#94a3b8;font-size:12.5px">Si ya agendaste, puedes ignorar este mensaje.</p>
    </div>
  </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// Personal de la clínica
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/controles  { paciente_id, medico_id, fecha_objetivo, motivo, cita_origen_id }
router.post("/", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Selecciona una clínica" });
    const { paciente_id, medico_id, fecha_objetivo, motivo, cita_origen_id } = req.body || {};
    if (!paciente_id || !medico_id || !FECHA_RE.test(fecha_objetivo || ""))
      return res.status(400).json({ ok: false, msg: "Paciente, médico y fecha son obligatorios" });
    if (fecha_objetivo <= dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD"))
      return res.status(400).json({ ok: false, msg: "La fecha del control debe ser futura" });

    await asegurarTabla();
    const [[pac]] = await pool.query("SELECT id FROM pacientes WHERE id=? AND clinica_id=?", [paciente_id, clinicaId]);
    const [[med]] = await pool.query("SELECT id FROM usuarios WHERE id=? AND clinica_id=?", [medico_id, clinicaId]);
    if (!pac || !med) return res.status(404).json({ ok: false, msg: "Paciente o médico no encontrado" });

    // Un control abierto por paciente y médico: uno nuevo reemplaza al anterior
    await pool.query(
      `UPDATE controles_programados SET estado='CANCELADO'
       WHERE clinica_id=? AND paciente_id=? AND medico_id=? AND estado IN ('PENDIENTE','AVISADO')`,
      [clinicaId, paciente_id, medico_id]);
    const [r] = await pool.query(
      `INSERT INTO controles_programados (clinica_id, paciente_id, medico_id, cita_origen_id, fecha_objetivo, motivo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clinicaId, paciente_id, medico_id, cita_origen_id || null, fecha_objetivo,
       motivo ? String(motivo).trim().slice(0, 200) : null, req.user.id]);
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    console.error("[controles] POST:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo programar el control" });
  }
});

// GET /api/controles?estado=abiertos|agendados|todos
router.get("/", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Selecciona una clínica" });
    await sincronizarAgendados(clinicaId);
    const filtroMedico = ["MEDICO", "PSICOLOGO"].includes(req.user.tipo) ? " AND cp.medico_id = ? " : "";
    const params = filtroMedico ? [clinicaId, req.user.id] : [clinicaId];
    const [rows] = await pool.query(
      `SELECT cp.id, cp.paciente_id, cp.medico_id, cp.motivo, cp.estado,
              DATE_FORMAT(cp.fecha_objetivo,'%Y-%m-%d') AS fecha_objetivo,
              DATE_FORMAT(cp.avisado_en,'%Y-%m-%d') AS avisado_en,
              p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos, p.telefono AS paciente_telefono,
              (p.email IS NOT NULL AND p.email <> '') AS tiene_email,
              CONCAT(u.nombres, ' ', u.apellidos) AS medico,
              (SELECT DATE_FORMAT(c.inicio,'%Y-%m-%d %H:%i') FROM citas c WHERE c.id = cp.cita_id) AS cita_inicio
       FROM controles_programados cp
       JOIN pacientes p ON p.id = cp.paciente_id
       JOIN usuarios u  ON u.id = cp.medico_id
       WHERE cp.clinica_id = ? ${filtroMedico}
         AND (cp.estado IN ('PENDIENTE','AVISADO') OR cp.creado_en > NOW() - INTERVAL 120 DAY)
       ORDER BY FIELD(cp.estado,'AVISADO','PENDIENTE','AGENDADO','CANCELADO'), cp.fecha_objetivo ASC
       LIMIT 300`, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("[controles] GET:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar los controles" });
  }
});

// PATCH /api/controles/:id  { estado: 'CANCELADO' }  ó  { fecha_objetivo }
router.patch("/:id", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTabla();
    const { estado, fecha_objetivo } = req.body || {};
    let r;
    if (estado === "CANCELADO") {
      [r] = await pool.query(
        "UPDATE controles_programados SET estado='CANCELADO' WHERE id=? AND clinica_id=? AND estado IN ('PENDIENTE','AVISADO')",
        [req.params.id, clinicaId]);
    } else if (FECHA_RE.test(fecha_objetivo || "")) {
      // Cambiar la fecha reinicia el aviso
      [r] = await pool.query(
        "UPDATE controles_programados SET fecha_objetivo=?, estado='PENDIENTE', avisado_en=NULL WHERE id=? AND clinica_id=? AND estado IN ('PENDIENTE','AVISADO')",
        [fecha_objetivo, req.params.id, clinicaId]);
    } else {
      return res.status(400).json({ ok: false, msg: "Cambio inválido" });
    }
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "Control no encontrado o ya cerrado" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[controles] PATCH:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo actualizar" });
  }
});

module.exports = router;
module.exports.asegurarTabla = asegurarTabla;
module.exports.enviarAvisosControl = enviarAvisosControl;
