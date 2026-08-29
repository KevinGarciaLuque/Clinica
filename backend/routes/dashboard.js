/**
 * routes/dashboard.js
 * Estadísticas del panel principal
 * GET /api/dashboard/stats  → KPIs del día + semana
 * GET /api/dashboard/sala-espera  → pacientes en espera hoy
 */

const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

let _ndReady = false;
async function ensureNombreDisplayColumn() {
  if (_ndReady) return;
  try {
    const [c] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'nombre_display'");
    if (!c.length) await pool.query("ALTER TABLE usuarios ADD COLUMN nombre_display VARCHAR(150) NULL AFTER apellidos");
    _ndReady = true;
  } catch (e) { console.error("ensureNombreDisplayColumn:", e.message); }
}

// GET /api/dashboard/stats
router.get("/stats", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    await ensureNombreDisplayColumn();

    // La fecha "de hoy" la decide el navegador del usuario (req.query.fecha), no el
    // servidor: Railway corre en UTC y calcular "hoy" ahí desfasa el día en horarios
    // nocturnos de Centroamérica.
    const hoy = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || "")
      ? req.query.fecha
      : new Date().toLocaleDateString('en-CA');
    const inicioSem = new Date();
    inicioSem.setDate(inicioSem.getDate() - inicioSem.getDay() + 1); // Lunes
    const finSem    = new Date(inicioSem);
    finSem.setDate(finSem.getDate() + 6);

    const [
      [totalPacientes],
      [citasHoy],
      [citasSemana],
      [porEstadoHoy],
      [ultimosPacientes],
    ] = await Promise.all([
      pool.query(
        "SELECT COUNT(*) AS total FROM pacientes WHERE clinica_id=? AND activo=1",
        [clinicaId]
      ),
      pool.query(
        "SELECT COUNT(*) AS total FROM citas WHERE clinica_id=? AND DATE(inicio)=?",
        [clinicaId, hoy]
      ),
      pool.query(
        "SELECT COUNT(*) AS total FROM citas WHERE clinica_id=? AND DATE(inicio) BETWEEN ? AND ?",
        [clinicaId, inicioSem.toISOString().slice(0,10), finSem.toISOString().slice(0,10)]
      ),
      pool.query(
        `SELECT estado, COUNT(*) AS total
         FROM citas WHERE clinica_id=? AND DATE(inicio)=?
         GROUP BY estado`,
        [clinicaId, hoy]
      ),
      pool.query(
        `SELECT id, nombres, apellidos, telefono, creado_en
         FROM pacientes WHERE clinica_id=? AND activo=1
         ORDER BY id DESC LIMIT 5`,
        [clinicaId]
      ),
    ]);

    res.json({
      ok: true,
      data: {
        total_pacientes:      totalPacientes[0].total,
        citas_hoy:            citasHoy[0].total,
        citas_semana:         citasSemana[0].total,
        estados_hoy:          porEstadoHoy,   // array [{estado, total}, ...]
        ultimos_pacientes:    ultimosPacientes,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/dashboard/sala-espera  → citas de hoy con datos del paciente y médico
router.get("/sala-espera", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    // La fecha "de hoy" la decide el navegador del usuario (req.query.fecha), no el
    // servidor: Railway corre en UTC y calcular "hoy" ahí desfasa el día en horarios
    // nocturnos de Centroamérica, dejando la sala de espera vacía sin motivo aparente.
    const hoy = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || "")
      ? req.query.fecha
      : new Date().toLocaleDateString('en-CA');

    const [rows] = await pool.query(
      `SELECT c.id,
              DATE_FORMAT(c.inicio, '%Y-%m-%dT%H:%i:%s') AS inicio,
              DATE_FORMAT(c.fin, '%Y-%m-%dT%H:%i:%s') AS fin,
              c.estado, c.tipo_consulta, c.motivo, c.canal,
              p.id AS paciente_id, p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
              p.telefono AS paciente_tel, p.dni AS paciente_dni, p.email AS paciente_email,
              u.id AS medico_id, u.nombres AS medico_nombres, u.apellidos AS medico_apellidos, u.nombre_display AS medico_nombre_display,
              e.nombre AS especialidad
       FROM citas c
       JOIN pacientes p  ON p.id = c.paciente_id
       JOIN usuarios  u  ON u.id = c.medico_id
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE c.clinica_id=? AND DATE(c.inicio)=?
         AND c.estado NOT IN ('CANCELADA','NO_ASISTIO')
       ORDER BY c.inicio ASC`,
      [clinicaId, hoy]
    );

    const [[{ total: totalRecepcionistas }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE clinica_id=? AND tipo='RECEPCIONISTA' AND activo=1`,
      [clinicaId]
    );

    res.json({ ok: true, data: rows, tiene_recepcionista: totalRecepcionistas > 0 });
  } catch (e) {
    console.error('❌ Error en sala-espera:', e.message);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
