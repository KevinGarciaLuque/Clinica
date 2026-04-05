const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const auth    = require("../middlewares/auth");

/* ────────────────────────────────────────────────────────────────
   GET /api/reportes/clinicas
   Resumen completo de todas las clínicas para el Super Admin.
   Métricas: pacientes, usuarios, citas, historias, crecimiento.
──────────────────────────────────────────────────────────────── */
router.get("/clinicas", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    primerDiaMes.setHours(0, 0, 0, 0);

    const [rows] = await pool.query(`
      SELECT
        c.id,
        c.nombre,
        c.slug,
        c.ciudad,
        c.pais,
        c.plan_tipo,
        c.licencia_fin,
        c.activo,
        c.creado_en,
        ct.nombre                                              AS tipo_nombre,

        /* ── Pacientes ── */
        COUNT(DISTINCT p.id)                                   AS total_pacientes,
        COUNT(DISTINCT CASE
          WHEN p.creado_en >= DATE_FORMAT(NOW(),'%Y-%m-01')
          THEN p.id END)                                       AS pacientes_este_mes,

        /* ── Usuarios activos (excluye portal) ── */
        COUNT(DISTINCT CASE
          WHEN u.activo = 1 AND u.tipo != 'PACIENTE_PORTAL'
          THEN u.id END)                                       AS total_usuarios,

        /* ── Citas ── */
        COUNT(DISTINCT ci.id)                                  AS total_citas,
        COUNT(DISTINCT CASE
          WHEN ci.creado_en >= DATE_FORMAT(NOW(),'%Y-%m-01')
          THEN ci.id END)                                      AS citas_este_mes,

        /* ── Historias clínicas (consultas) ── */
        COUNT(DISTINCT hc.id)                                  AS total_consultas,

        /* ── Días en plataforma ── */
        DATEDIFF(NOW(), c.creado_en)                           AS dias_en_plataforma

      FROM clinicas c
      LEFT JOIN tipos_clinica ct ON ct.id = c.tipo_id
      LEFT JOIN pacientes     p  ON p.clinica_id  = c.id
      LEFT JOIN usuarios      u  ON u.clinica_id  = c.id
      LEFT JOIN citas         ci ON ci.clinica_id = c.id
      LEFT JOIN historias_clinicas hc ON hc.clinica_id = c.id
      GROUP BY c.id
      ORDER BY total_pacientes DESC
    `);

    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("reportes/clinicas:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener reporte" });
  }
});

/* ────────────────────────────────────────────────────────────────
   GET /api/reportes/crecimiento
   Nuevos pacientes por clínica por mes (últimos 12 meses).
   Útil para identificar clínicas con crecimiento acelerado.
──────────────────────────────────────────────────────────────── */
router.get("/crecimiento", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.clinica_id,
        c.nombre                             AS clinica_nombre,
        DATE_FORMAT(p.creado_en, '%Y-%m')    AS mes,
        COUNT(*)                             AS nuevos_pacientes
      FROM pacientes p
      INNER JOIN clinicas c ON c.id = p.clinica_id
      WHERE p.creado_en >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY p.clinica_id, mes
      ORDER BY mes ASC, p.clinica_id ASC
    `);

    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("reportes/crecimiento:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener crecimiento" });
  }
});

/* ────────────────────────────────────────────────────────────────
   GET /api/reportes/actividad
   Citas por estado agrupadas por clínica (todo el tiempo).
──────────────────────────────────────────────────────────────── */
router.get("/actividad", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        ci.clinica_id,
        c.nombre   AS clinica_nombre,
        ci.estado,
        COUNT(*)   AS total
      FROM citas ci
      INNER JOIN clinicas c ON c.id = ci.clinica_id
      GROUP BY ci.clinica_id, ci.estado
      ORDER BY ci.clinica_id ASC
    `);

    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("reportes/actividad:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener actividad" });
  }
});

module.exports = router;
