/**
 * routes/dashboard.js
 * Estadísticas del panel principal
 * GET /api/dashboard/stats  → KPIs del día + semana
 * GET /api/dashboard/sala-espera  → pacientes en espera hoy
 */

const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

// GET /api/dashboard/stats
router.get("/stats", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;

    const hoy       = new Date().toISOString().slice(0, 10);
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

    // Agrupar estados del día
    const estados = {};
    porEstadoHoy.forEach(r => { estados[r.estado] = r.total; });

    res.json({
      ok: true,
      data: {
        total_pacientes:      totalPacientes[0].total,
        citas_hoy:            citasHoy[0].total,
        citas_semana:         citasSemana[0].total,
        estados_hoy:          estados,
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
    const hoy = new Date().toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT c.id, c.inicio, c.fin, c.estado, c.tipo_consulta, c.motivo, c.canal,
              p.id AS paciente_id, p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              p.telefono AS pac_tel, p.dni AS pac_dni,
              u.id AS medico_id, u.nombres AS med_nombres, u.apellidos AS med_apellidos,
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
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
