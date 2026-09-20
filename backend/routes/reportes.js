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
    // Antes esto hacía un LEFT JOIN directo de clinicas contra pacientes,
    // usuarios, citas e historias_clinicas a la vez: por cada clínica se
    // generaba un producto cartesiano (pacientes × citas × historias) antes
    // de poder contar con DISTINCT, lo que se vuelve carísimo apenas hay
    // datos reales (cientos de miles/millones de filas intermedias). Se
    // precalcula cada conteo por separado (un solo GROUP BY por tabla) y
    // se pega todo con LEFT JOIN — mismo resultado, sin el cruce.
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
        ct.nombre                                AS tipo_nombre,
        COALESCE(p.total_pacientes, 0)            AS total_pacientes,
        COALESCE(p.pacientes_este_mes, 0)         AS pacientes_este_mes,
        COALESCE(u.total_usuarios, 0)             AS total_usuarios,
        COALESCE(ci.total_citas, 0)               AS total_citas,
        COALESCE(ci.citas_este_mes, 0)            AS citas_este_mes,
        COALESCE(hc.total_consultas, 0)           AS total_consultas,
        DATEDIFF(NOW(), c.creado_en)              AS dias_en_plataforma
      FROM clinicas c
      LEFT JOIN tipos_clinica ct ON ct.id = c.tipo_id
      LEFT JOIN (
        SELECT clinica_id,
               COUNT(*)                                                              AS total_pacientes,
               SUM(CASE WHEN creado_en >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN 1 ELSE 0 END) AS pacientes_este_mes
        FROM pacientes
        GROUP BY clinica_id
      ) p ON p.clinica_id = c.id
      LEFT JOIN (
        SELECT clinica_id, COUNT(*) AS total_usuarios
        FROM usuarios
        WHERE activo = 1 AND tipo != 'PACIENTE_PORTAL'
        GROUP BY clinica_id
      ) u ON u.clinica_id = c.id
      LEFT JOIN (
        SELECT clinica_id,
               COUNT(*)                                                              AS total_citas,
               SUM(CASE WHEN creado_en >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN 1 ELSE 0 END) AS citas_este_mes
        FROM citas
        GROUP BY clinica_id
      ) ci ON ci.clinica_id = c.id
      LEFT JOIN (
        SELECT clinica_id, COUNT(*) AS total_consultas
        FROM historias_clinicas
        GROUP BY clinica_id
      ) hc ON hc.clinica_id = c.id
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
