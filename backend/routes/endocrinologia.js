const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const ROLES           = ["SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA"];
const ROLES_ESCRITURA = ["SUPER_ADMIN","ADMIN","MEDICO"];

// ─── Utilidad ─────────────────────────────────────────────────────────────────
async function ensureTablas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS historia_endocrinologia (
      id                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id                INT UNSIGNED NOT NULL,
      paciente_id               INT UNSIGNED NOT NULL,
      medico                    VARCHAR(150),
      medico_refiere            VARCHAR(150),
      fecha_diagnostico         DATE,
      edad_diagnostico          SMALLINT UNSIGNED,
      circunstancia_diagnostico VARCHAR(40),
      circunstancias_diagnostico JSON,
      circunstancia_otro        VARCHAR(255),
      autoanticuerpos           JSON,
      tratamiento_inicial       JSON,
      antecedentes_patologicos  JSON,
      antecedentes_patologicos_estado VARCHAR(20),
      antecedentes_otros        TEXT,
      tabaquismo                VARCHAR(20),
      tabaquismo_comentario     VARCHAR(255),
      alcohol                   VARCHAR(20),
      alcohol_comentario        VARCHAR(255),
      drogas                    VARCHAR(20),
      drogas_comentario         VARCHAR(255),
      antecedentes_familiares   JSON,
      gineco_obstetricos        JSON,
      creado_en                 DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_he_clinica_paciente (clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seguimientos_endocrinologia (
      id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id            INT UNSIGNED NOT NULL,
      paciente_id           INT UNSIGNED NOT NULL,
      medico_id             INT UNSIGNED NOT NULL,
      es_inicial            TINYINT(1) NOT NULL DEFAULT 0,
      fecha                 DATE NOT NULL,
      control_metabolico    JSON,
      antropometria         JSON,
      retinopatia           JSON,
      nefropatia            JSON,
      neuropatia            JSON,
      cardiovascular        JSON,
      terapia_adherencia    JSON,
      psicosocial           JSON,
      plan                  JSON,
      secciones_completadas JSON,
      estado                ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
      firma_at              DATETIME,
      creado_en             DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_se_clinica  (clinica_id),
      INDEX idx_se_paciente (paciente_id),
      INDEX idx_se_medico   (medico_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS planes_endocrinologia (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id  INT UNSIGNED NOT NULL,
      paciente_id INT UNSIGNED NOT NULL,
      medico_id   INT UNSIGNED NOT NULL,
      fecha       DATE NOT NULL,
      plan        JSON,
      creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pe_clinica  (clinica_id),
      INDEX idx_pe_paciente (paciente_id),
      INDEX idx_pe_medico   (medico_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
ensureTablas().catch(() => {});

const SECCIONES = [
  "control_metabolico", "antropometria", "retinopatia", "nefropatia",
  "neuropatia", "cardiovascular", "terapia_adherencia", "psicosocial", "plan",
];
const jsonOrNull = (v) => (v === undefined || v === null ? null : JSON.stringify(v));

// ═══════════════════════════════════════════════════════════════════════════════
//  HISTORIA CLÍNICA INICIAL
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/endocrinologia/historia/:paciente_id
router.get("/historia/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT * FROM historia_endocrinologia WHERE clinica_id=? AND paciente_id=?",
      [req.user.clinica_id, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/endocrinologia/historia/:paciente_id  (upsert)
router.post("/historia/:paciente_id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;
    const {
      medico, medico_refiere,
      fecha_diagnostico, edad_diagnostico, circunstancias_diagnostico, circunstancia_otro,
      autoanticuerpos, tratamiento_inicial, antecedentes_patologicos, antecedentes_patologicos_estado, antecedentes_otros,
      tabaquismo, tabaquismo_comentario, alcohol, alcohol_comentario,
      drogas, drogas_comentario, antecedentes_familiares, gineco_obstetricos,
    } = req.body;
    // Acepta tanto "YYYY-MM-DD" como un ISO datetime completo (ej. si el valor viene
    // de un round-trip por una columna DATE) y lo normaliza para MySQL.
    const fechaDiagnosticoDb = fecha_diagnostico ? String(fecha_diagnostico).slice(0, 10) : null;

    await pool.query(`
      INSERT INTO historia_endocrinologia
        (clinica_id, paciente_id, medico, medico_refiere,
         fecha_diagnostico, edad_diagnostico, circunstancias_diagnostico, circunstancia_otro,
         autoanticuerpos, tratamiento_inicial, antecedentes_patologicos, antecedentes_patologicos_estado, antecedentes_otros,
         tabaquismo, tabaquismo_comentario, alcohol, alcohol_comentario,
         drogas, drogas_comentario, antecedentes_familiares, gineco_obstetricos)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        medico=VALUES(medico), medico_refiere=VALUES(medico_refiere),
        fecha_diagnostico=VALUES(fecha_diagnostico), edad_diagnostico=VALUES(edad_diagnostico),
        circunstancias_diagnostico=VALUES(circunstancias_diagnostico), circunstancia_otro=VALUES(circunstancia_otro),
        autoanticuerpos=VALUES(autoanticuerpos), tratamiento_inicial=VALUES(tratamiento_inicial),
        antecedentes_patologicos=VALUES(antecedentes_patologicos), antecedentes_patologicos_estado=VALUES(antecedentes_patologicos_estado),
        antecedentes_otros=VALUES(antecedentes_otros),
        tabaquismo=VALUES(tabaquismo), tabaquismo_comentario=VALUES(tabaquismo_comentario),
        alcohol=VALUES(alcohol), alcohol_comentario=VALUES(alcohol_comentario),
        drogas=VALUES(drogas), drogas_comentario=VALUES(drogas_comentario),
        antecedentes_familiares=VALUES(antecedentes_familiares), gineco_obstetricos=VALUES(gineco_obstetricos),
        actualizado_en=NOW()
    `, [
      cid, pid, medico || null, medico_refiere || null,
      fechaDiagnosticoDb, edad_diagnostico || null, jsonOrNull(circunstancias_diagnostico), circunstancia_otro || null,
      jsonOrNull(autoanticuerpos), jsonOrNull(tratamiento_inicial),
      jsonOrNull(antecedentes_patologicos), antecedentes_patologicos_estado || null, antecedentes_otros || null,
      tabaquismo || null, tabaquismo_comentario || null,
      alcohol || null, alcohol_comentario || null,
      drogas || null, drogas_comentario || null,
      jsonOrNull(antecedentes_familiares), jsonOrNull(gineco_obstetricos),
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEGUIMIENTOS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/endocrinologia/seguimientos?paciente_id=&page=1&limit=20
router.get("/seguimientos", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, page = 1, limit = 20 } = req.query;
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(`
      SELECT se.*, CONCAT(u.nombres,' ',u.apellidos) AS medico_nombre
      FROM seguimientos_endocrinologia se
      LEFT JOIN usuarios u ON u.id = se.medico_id
      WHERE se.clinica_id = ? AND se.paciente_id = ?
      ORDER BY se.fecha DESC, se.id DESC
      LIMIT ? OFFSET ?
    `, [cid, paciente_id, Number(limit), offset]);

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM seguimientos_endocrinologia WHERE clinica_id=? AND paciente_id=?",
      [cid, paciente_id]
    );
    res.json({ ok: true, data: rows, total });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/endocrinologia/seguimientos/:id
router.get("/seguimientos/:id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT se.*, CONCAT(u.nombres,' ',u.apellidos) AS medico_nombre,
        CONCAT(p.nombres,' ',p.apellidos) AS paciente_nombre
      FROM seguimientos_endocrinologia se
      LEFT JOIN usuarios u ON u.id = se.medico_id
      LEFT JOIN pacientes p ON p.id = se.paciente_id
      WHERE se.id = ? AND se.clinica_id = ?
    `, [req.params.id, req.user.clinica_id]);
    if (!row) return res.status(404).json({ ok: false, msg: "Seguimiento no encontrado" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/endocrinologia/seguimientos
router.post("/seguimientos", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, fecha } = req.body;
    if (!paciente_id || !fecha) return res.status(400).json({ ok: false, msg: "paciente_id y fecha requeridos" });

    const secciones = SECCIONES.filter(k => req.body[k] !== undefined && req.body[k] !== null);

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM seguimientos_endocrinologia WHERE clinica_id=? AND paciente_id=?",
      [cid, paciente_id]
    );
    const esInicial = total === 0 ? 1 : 0;

    const [result] = await pool.query(`
      INSERT INTO seguimientos_endocrinologia
        (clinica_id, paciente_id, medico_id, es_inicial, fecha,
         control_metabolico, antropometria, retinopatia, nefropatia, neuropatia,
         cardiovascular, terapia_adherencia, psicosocial, plan, secciones_completadas)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      cid, paciente_id, req.user.id, esInicial, fecha,
      jsonOrNull(req.body.control_metabolico), jsonOrNull(req.body.antropometria),
      jsonOrNull(req.body.retinopatia), jsonOrNull(req.body.nefropatia),
      jsonOrNull(req.body.neuropatia), jsonOrNull(req.body.cardiovascular),
      jsonOrNull(req.body.terapia_adherencia), jsonOrNull(req.body.psicosocial),
      jsonOrNull(req.body.plan), JSON.stringify(secciones),
    ]);
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/endocrinologia/seguimientos/:id
router.put("/seguimientos/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id, estado FROM seguimientos_endocrinologia WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Seguimiento no encontrado" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "El seguimiento ya está firmado y no puede editarse" });

    const { fecha } = req.body;
    const secciones = SECCIONES.filter(k => req.body[k] !== undefined && req.body[k] !== null);

    await pool.query(`
      UPDATE seguimientos_endocrinologia SET
        fecha=?, control_metabolico=?, antropometria=?, retinopatia=?, nefropatia=?,
        neuropatia=?, cardiovascular=?, terapia_adherencia=?, psicosocial=?, plan=?,
        secciones_completadas=?
      WHERE id=?
    `, [
      fecha || null,
      jsonOrNull(req.body.control_metabolico), jsonOrNull(req.body.antropometria),
      jsonOrNull(req.body.retinopatia), jsonOrNull(req.body.nefropatia),
      jsonOrNull(req.body.neuropatia), jsonOrNull(req.body.cardiovascular),
      jsonOrNull(req.body.terapia_adherencia), jsonOrNull(req.body.psicosocial),
      jsonOrNull(req.body.plan), JSON.stringify(secciones),
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/endocrinologia/seguimientos/:id/firmar
router.post("/seguimientos/:id/firmar", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id FROM seguimientos_endocrinologia WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Seguimiento no encontrado" });
    await pool.query(
      "UPDATE seguimientos_endocrinologia SET estado='FIRMADA', firma_at=NOW() WHERE id=?",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/endocrinologia/seguimientos/:id  (solo BORRADOR)
router.delete("/seguimientos/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT estado FROM seguimientos_endocrinologia WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrado" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "No se puede eliminar un seguimiento firmado" });
    await pool.query("DELETE FROM seguimientos_endocrinologia WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PLANES DE SEGUIMIENTO (formulario imprimible de tratamiento — uno por visita)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/endocrinologia/planes?paciente_id=&page=1&limit=20
router.get("/planes", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, page = 1, limit = 20 } = req.query;
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(`
      SELECT pe.*, CONCAT(u.nombres,' ',u.apellidos) AS medico_nombre
      FROM planes_endocrinologia pe
      LEFT JOIN usuarios u ON u.id = pe.medico_id
      WHERE pe.clinica_id = ? AND pe.paciente_id = ?
      ORDER BY pe.fecha DESC, pe.id DESC
      LIMIT ? OFFSET ?
    `, [cid, paciente_id, Number(limit), offset]);

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM planes_endocrinologia WHERE clinica_id=? AND paciente_id=?",
      [cid, paciente_id]
    );
    res.json({ ok: true, data: rows, total });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/endocrinologia/planes/:id
router.get("/planes/:id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT pe.*, CONCAT(u.nombres,' ',u.apellidos) AS medico_nombre
      FROM planes_endocrinologia pe
      LEFT JOIN usuarios u ON u.id = pe.medico_id
      WHERE pe.id = ? AND pe.clinica_id = ?
    `, [req.params.id, req.user.clinica_id]);
    if (!row) return res.status(404).json({ ok: false, msg: "Plan no encontrado" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/endocrinologia/planes
router.post("/planes", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const { paciente_id, fecha, plan } = req.body;
    if (!paciente_id || !fecha) return res.status(400).json({ ok: false, msg: "paciente_id y fecha requeridos" });

    const [result] = await pool.query(
      "INSERT INTO planes_endocrinologia (clinica_id, paciente_id, medico_id, fecha, plan) VALUES (?,?,?,?,?)",
      [req.user.clinica_id, paciente_id, req.user.id, fecha, jsonOrNull(plan)]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/endocrinologia/planes/:id
router.put("/planes/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id FROM planes_endocrinologia WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Plan no encontrado" });

    const { fecha, plan } = req.body;
    await pool.query(
      "UPDATE planes_endocrinologia SET fecha=?, plan=? WHERE id=?",
      [fecha || null, jsonOrNull(plan), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/endocrinologia/planes/:id
router.delete("/planes/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id FROM planes_endocrinologia WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrado" });
    await pool.query("DELETE FROM planes_endocrinologia WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/endocrinologia/resumen/:paciente_id  (para el tab del paciente)
router.get("/resumen/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;

    const [[historia]] = await pool.query(
      "SELECT id FROM historia_endocrinologia WHERE clinica_id=? AND paciente_id=?",
      [cid, pid]
    );
    const [[{ total_seguimientos }]] = await pool.query(
      "SELECT COUNT(*) AS total_seguimientos FROM seguimientos_endocrinologia WHERE clinica_id=? AND paciente_id=?",
      [cid, pid]
    );
    const [[ultimo]] = await pool.query(
      "SELECT id, fecha, estado FROM seguimientos_endocrinologia WHERE clinica_id=? AND paciente_id=? ORDER BY fecha DESC, id DESC LIMIT 1",
      [cid, pid]
    );

    res.json({ ok: true, data: { tiene_historia: !!historia, total_seguimientos, ultimo_seguimiento: ultimo || null } });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
