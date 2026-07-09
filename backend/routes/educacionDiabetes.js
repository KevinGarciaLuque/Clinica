const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const ROLES           = ["SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA"];
const ROLES_ESCRITURA = ["SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA"];

// ─── Utilidad ─────────────────────────────────────────────────────────────────
async function ensureTablas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sesiones_educacion_diabetes (
      id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id            INT UNSIGNED NOT NULL,
      paciente_id           INT UNSIGNED NOT NULL,
      educador_id           INT UNSIGNED NOT NULL,
      fecha                 DATE NOT NULL,
      diagnostico           JSON,
      antecedentes          JSON,
      tratamiento_actual    JSON,
      monitoreo             JSON,
      alimentacion          JSON,
      actividad_fisica      JSON,
      educacion_previa      JSON,
      objetivos_paciente    TEXT,
      plan_educativo        JSON,
      evaluacion_educativa  JSON,
      secciones_completadas JSON,
      estado                ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
      firma_at              DATETIME,
      creado_en             DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sed_clinica  (clinica_id),
      INDEX idx_sed_paciente (paciente_id),
      INDEX idx_sed_educador (educador_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
ensureTablas().catch(() => {});

const SECCIONES = [
  "diagnostico", "antecedentes", "tratamiento_actual", "monitoreo", "alimentacion",
  "actividad_fisica", "educacion_previa", "objetivos_paciente", "plan_educativo", "evaluacion_educativa",
];
const jsonOrNull = (v) => (v === undefined || v === null ? null : JSON.stringify(v));

// GET /api/educacion-diabetes/sesiones?paciente_id=&page=1&limit=20
router.get("/sesiones", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, page = 1, limit = 20 } = req.query;
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(`
      SELECT se.*, CONCAT(u.nombres,' ',u.apellidos) AS educador_nombre
      FROM sesiones_educacion_diabetes se
      LEFT JOIN usuarios u ON u.id = se.educador_id
      WHERE se.clinica_id = ? AND se.paciente_id = ?
      ORDER BY se.fecha DESC, se.id DESC
      LIMIT ? OFFSET ?
    `, [cid, paciente_id, Number(limit), offset]);

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM sesiones_educacion_diabetes WHERE clinica_id=? AND paciente_id=?",
      [cid, paciente_id]
    );
    res.json({ ok: true, data: rows, total });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/educacion-diabetes/sesiones/:id
router.get("/sesiones/:id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT se.*, CONCAT(u.nombres,' ',u.apellidos) AS educador_nombre,
        CONCAT(p.nombres,' ',p.apellidos) AS paciente_nombre
      FROM sesiones_educacion_diabetes se
      LEFT JOIN usuarios u ON u.id = se.educador_id
      LEFT JOIN pacientes p ON p.id = se.paciente_id
      WHERE se.id = ? AND se.clinica_id = ?
    `, [req.params.id, req.user.clinica_id]);
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/educacion-diabetes/sesiones
router.post("/sesiones", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, fecha } = req.body;
    if (!paciente_id || !fecha) return res.status(400).json({ ok: false, msg: "paciente_id y fecha requeridos" });

    const secciones = SECCIONES.filter(k => req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== "");

    const [result] = await pool.query(`
      INSERT INTO sesiones_educacion_diabetes
        (clinica_id, paciente_id, educador_id, fecha,
         diagnostico, antecedentes, tratamiento_actual, monitoreo, alimentacion,
         actividad_fisica, educacion_previa, objetivos_paciente, plan_educativo,
         evaluacion_educativa, secciones_completadas)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      cid, paciente_id, req.user.id, fecha,
      jsonOrNull(req.body.diagnostico), jsonOrNull(req.body.antecedentes),
      jsonOrNull(req.body.tratamiento_actual), jsonOrNull(req.body.monitoreo),
      jsonOrNull(req.body.alimentacion), jsonOrNull(req.body.actividad_fisica),
      jsonOrNull(req.body.educacion_previa), req.body.objetivos_paciente || null,
      jsonOrNull(req.body.plan_educativo), jsonOrNull(req.body.evaluacion_educativa),
      JSON.stringify(secciones),
    ]);
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/educacion-diabetes/sesiones/:id
router.put("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id, estado FROM sesiones_educacion_diabetes WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "La sesión ya está firmada y no puede editarse" });

    const { fecha } = req.body;
    const secciones = SECCIONES.filter(k => req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== "");

    await pool.query(`
      UPDATE sesiones_educacion_diabetes SET
        fecha=?, diagnostico=?, antecedentes=?, tratamiento_actual=?, monitoreo=?,
        alimentacion=?, actividad_fisica=?, educacion_previa=?, objetivos_paciente=?,
        plan_educativo=?, evaluacion_educativa=?, secciones_completadas=?
      WHERE id=?
    `, [
      fecha || null,
      jsonOrNull(req.body.diagnostico), jsonOrNull(req.body.antecedentes),
      jsonOrNull(req.body.tratamiento_actual), jsonOrNull(req.body.monitoreo),
      jsonOrNull(req.body.alimentacion), jsonOrNull(req.body.actividad_fisica),
      jsonOrNull(req.body.educacion_previa), req.body.objetivos_paciente || null,
      jsonOrNull(req.body.plan_educativo), jsonOrNull(req.body.evaluacion_educativa),
      JSON.stringify(secciones),
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/educacion-diabetes/sesiones/:id/firmar
router.post("/sesiones/:id/firmar", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id FROM sesiones_educacion_diabetes WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    await pool.query(
      "UPDATE sesiones_educacion_diabetes SET estado='FIRMADA', firma_at=NOW() WHERE id=?",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/educacion-diabetes/sesiones/:id  (solo BORRADOR)
router.delete("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT estado FROM sesiones_educacion_diabetes WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "No se puede eliminar una sesión firmada" });
    await pool.query("DELETE FROM sesiones_educacion_diabetes WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
