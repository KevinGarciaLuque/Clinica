/**
 * MÓDULO 6 — Estudios y Exámenes (solicitudes + resultados)
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

/**
 * GET /api/estudios?paciente_id=&historia_id=&estado=
 */
router.get("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { paciente_id, historia_id, estado, page = 1 } = req.query;
    const limit  = 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT s.*,
             p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
             u.nombres AS medico_nombres, u.apellidos AS medico_apellidos
      FROM estudios_solicitudes s
      JOIN pacientes p ON p.id = s.paciente_id
      JOIN usuarios  u ON u.id = s.medico_id
      WHERE s.clinica_id = ?`;
    const params = [cid];

    if (paciente_id) { sql += " AND s.paciente_id = ?"; params.push(paciente_id); }
    if (historia_id) { sql += " AND s.historia_id = ?"; params.push(historia_id); }
    if (estado)      { sql += " AND s.estado = ?";      params.push(estado); }

    sql += " ORDER BY s.creado_en DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/estudios/:id  — con resultados
 */
router.get("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);

    const [[sol]] = await pool.query(
      `SELECT s.*,
              p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
              u.nombres AS medico_nombres, u.apellidos AS medico_apellidos
       FROM estudios_solicitudes s
       JOIN pacientes p ON p.id = s.paciente_id
       JOIN usuarios  u ON u.id = s.medico_id
       WHERE s.id = ? AND s.clinica_id = ?`,
      [req.params.id, cid]
    );
    if (!sol) return res.status(404).json({ ok: false, msg: "No encontrado" });

    const [resultados] = await pool.query(
      "SELECT * FROM estudios_resultados WHERE solicitud_id = ? AND clinica_id = ?",
      [sol.id, cid]
    );

    res.json({ ok: true, data: { ...sol, resultados } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/estudios
 * Body: { paciente_id, historia_id?, tipo, descripcion, urgente? }
 */
router.post("/", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { paciente_id, historia_id, tipo = "LABORATORIO", descripcion, urgente = 0 } = req.body;
    if (!paciente_id || !descripcion) {
      return res.status(400).json({ ok: false, msg: "paciente_id y descripcion son requeridos" });
    }

    const [r] = await pool.query(
      `INSERT INTO estudios_solicitudes (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente)
       VALUES (?,?,?,?,?,?,?)`,
      [cid, paciente_id, req.user.id, historia_id || null, tipo, descripcion, urgente ? 1 : 0]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PATCH /api/estudios/:id/estado
 */
router.patch("/:id/estado", auth("ADMIN","MEDICO","ENFERMERA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { estado } = req.body;
    const validos = ["SOLICITADO","EN_PROCESO","COMPLETADO","CANCELADO"];
    if (!validos.includes(estado)) return res.status(400).json({ ok: false, msg: "Estado inválido" });

    await pool.query(
      "UPDATE estudios_solicitudes SET estado=? WHERE id=? AND clinica_id=?",
      [estado, req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/estudios/:id/resultado
 * Agregar un resultado a una solicitud
 */
router.post("/:id/resultado", auth("ADMIN","MEDICO","ENFERMERA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const solicitudId = req.params.id;

    const {
      nombre_examen, valor_resultado,
      valor_referencia_min, valor_referencia_max,
      unidad, anormal = 0, archivo_url,
    } = req.body;

    const [r] = await pool.query(
      `INSERT INTO estudios_resultados
         (solicitud_id, clinica_id, nombre_examen, valor_resultado,
          valor_referencia_min, valor_referencia_max, unidad, anormal, archivo_url)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        solicitudId, cid,
        nombre_examen || null,
        valor_resultado || null,
        valor_referencia_min || null,
        valor_referencia_max || null,
        unidad || null,
        anormal ? 1 : 0,
        archivo_url || null,
      ]
    );

    // Marcar solicitud como COMPLETADO si todos ingresan resultados
    await pool.query(
      "UPDATE estudios_solicitudes SET estado='COMPLETADO' WHERE id=? AND clinica_id=?",
      [solicitudId, cid]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
