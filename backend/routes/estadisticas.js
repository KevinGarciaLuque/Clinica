/**
 * routes/estadisticas.js
 * Módulo de reportería — KPIs operativos del mes/rango seleccionado.
 * GET /api/estadisticas/resumen      → KPIs (pacientes nuevos, consultas, canal, ingresos)
 * GET /api/estadisticas/serie-citas  → conteo diario de citas para gráfico
 * GET /api/estadisticas/por-medico   → ranking de consultas por médico (solo ADMIN/SUPER_ADMIN)
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

function rangoFechas(req) {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const finMes     = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().slice(0, 10);
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || "") ? req.query.desde : inicioMes;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || "") ? req.query.hasta : finMes;
  return { desde, hasta };
}

// GET /api/estadisticas/resumen
router.get("/resumen", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const esMedico  = req.user.tipo === "MEDICO";
    const { desde, hasta } = rangoFechas(req);

    const filtroMedico = esMedico ? " AND medico_id = ? " : "";
    const paramsMedico = esMedico ? [req.user.id] : [];

    const [
      [consultasAtendidas],
      [pacientesNuevos],
      [citasAgendadas],
      [citasPorCanal],
      [citasCanceladas],
      [ingresos],
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total FROM citas
         WHERE clinica_id=? AND estado='COMPLETADA' AND DATE(inicio) BETWEEN ? AND ? ${filtroMedico}`,
        [clinicaId, desde, hasta, ...paramsMedico]
      ),
      pool.query(
        "SELECT COUNT(*) AS total FROM pacientes WHERE clinica_id=? AND DATE(creado_en) BETWEEN ? AND ?",
        [clinicaId, desde, hasta]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM citas
         WHERE clinica_id=? AND DATE(creado_en) BETWEEN ? AND ? ${filtroMedico}`,
        [clinicaId, desde, hasta, ...paramsMedico]
      ),
      pool.query(
        `SELECT canal, COUNT(*) AS total FROM citas
         WHERE clinica_id=? AND DATE(creado_en) BETWEEN ? AND ? ${filtroMedico}
         GROUP BY canal`,
        [clinicaId, desde, hasta, ...paramsMedico]
      ),
      pool.query(
        `SELECT estado, COUNT(*) AS total FROM citas
         WHERE clinica_id=? AND estado IN ('CANCELADA','NO_ASISTIO') AND DATE(inicio) BETWEEN ? AND ? ${filtroMedico}
         GROUP BY estado`,
        [clinicaId, desde, hasta, ...paramsMedico]
      ),
      // Ingresos: solo visible para ADMIN/SUPER_ADMIN (privacidad financiera de cada médico)
      esMedico
        ? Promise.resolve([[{ total_pagado: 0, total_pendiente: 0 }]])
        : pool.query(
            `SELECT
               COALESCE(SUM(CASE WHEN estado='PAGADA' THEN total ELSE 0 END), 0) AS total_pagado,
               COALESCE(SUM(CASE WHEN estado='PENDIENTE' THEN total ELSE 0 END), 0) AS total_pendiente
             FROM facturas
             WHERE clinica_id=? AND estado != 'ANULADA' AND DATE(creado_en) BETWEEN ? AND ?`,
            [clinicaId, desde, hasta]
          ),
    ]);

    res.json({
      ok: true,
      data: {
        rango: { desde, hasta },
        consultas_atendidas: consultasAtendidas[0].total,
        pacientes_nuevos:    pacientesNuevos[0].total,
        citas_agendadas:     citasAgendadas[0].total,
        citas_por_canal:     citasPorCanal,
        citas_canceladas:    citasCanceladas,
        ingresos: esMedico ? null : {
          pagado:    Number(ingresos[0].total_pagado),
          pendiente: Number(ingresos[0].total_pendiente),
        },
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/estadisticas/serie-citas
router.get("/serie-citas", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const esMedico  = req.user.tipo === "MEDICO";
    const { desde, hasta } = rangoFechas(req);
    const filtroMedico = esMedico ? " AND medico_id = ? " : "";
    const paramsMedico = esMedico ? [req.user.id] : [];

    const [rows] = await pool.query(
      `SELECT DATE(inicio) AS fecha, COUNT(*) AS total,
              SUM(CASE WHEN estado='COMPLETADA' THEN 1 ELSE 0 END) AS completadas
       FROM citas
       WHERE clinica_id=? AND DATE(inicio) BETWEEN ? AND ? ${filtroMedico}
       GROUP BY DATE(inicio)
       ORDER BY fecha ASC`,
      [clinicaId, desde, hasta, ...paramsMedico]
    );

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/estadisticas/por-medico  (solo ADMIN/SUPER_ADMIN)
router.get("/por-medico", auth("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const { desde, hasta } = rangoFechas(req);

    const [rows] = await pool.query(
      `SELECT u.id AS medico_id, u.nombres, u.apellidos,
              COUNT(*) AS citas_totales,
              SUM(CASE WHEN c.estado='COMPLETADA' THEN 1 ELSE 0 END) AS consultas_atendidas,
              SUM(CASE WHEN c.estado IN ('CANCELADA','NO_ASISTIO') THEN 1 ELSE 0 END) AS canceladas_no_asistio
       FROM citas c
       JOIN usuarios u ON u.id = c.medico_id
       WHERE c.clinica_id=? AND DATE(c.inicio) BETWEEN ? AND ?
       GROUP BY u.id, u.nombres, u.apellidos
       ORDER BY consultas_atendidas DESC`,
      [clinicaId, desde, hasta]
    );

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
