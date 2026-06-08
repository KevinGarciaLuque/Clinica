const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const ROLES = ["SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA"];
const ROLES_ESCRITURA = ["SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"];

// ─── Utilidad ─────────────────────────────────────────────────────────────────
async function ensureTablas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sesiones_psicologia (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      psicologo_id INT UNSIGNED NOT NULL, cita_id INT UNSIGNED,
      numero_sesion SMALLINT UNSIGNED NOT NULL DEFAULT 1,
      modalidad ENUM('INDIVIDUAL','PAREJA','FAMILIA','GRUPO') DEFAULT 'INDIVIDUAL',
      motivo_consulta TEXT, estado_mental JSON,
      diagnostico_cie VARCHAR(120), diagnostico_desc TEXT,
      diagnosticos_secundarios JSON, intervenciones TEXT,
      tarea_proxima TEXT, observaciones TEXT,
      estado ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
      firma_at DATETIME,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sp_clinica(clinica_id), INDEX idx_sp_paciente(paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS historia_psicologica (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      motivo_derivacion TEXT, demanda_inicial TEXT,
      dinamica_familiar TEXT, historia_social TEXT, historia_laboral TEXT,
      nivel_educativo VARCHAR(100), estado_civil VARCHAR(60),
      antecedentes_psiq TEXT, diagnosticos_previos TEXT,
      medicacion_actual TEXT, hospitalizaciones TEXT,
      intentos_autoliticos TINYINT(1) DEFAULT 0, ideacion_actual TINYINT(1) DEFAULT 0,
      consumo_sustancias JSON, eventos_traumaticos TEXT,
      genograma JSON, redes_apoyo TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_hp (clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_terapeutico (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      psicologo_id INT UNSIGNED NOT NULL,
      enfoque VARCHAR(120), frecuencia VARCHAR(80),
      objetivos JSON, progreso_general TINYINT UNSIGNED DEFAULT 0,
      notas TEXT, activo TINYINT(1) DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pt (clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS escalas_psicologia (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      sesion_id INT UNSIGNED,
      tipo_escala VARCHAR(60) NOT NULL,
      respuestas JSON NOT NULL, puntaje_total SMALLINT NOT NULL,
      interpretacion VARCHAR(120),
      aplicado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ep(clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
ensureTablas().catch(() => {});

// ═══════════════════════════════════════════════════════════════════════════════
//  SESIONES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/psicologia/sesiones?paciente_id=&page=1&limit=20
router.get("/sesiones", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, page = 1, limit = 20 } = req.query;
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(`
      SELECT sp.*,
        CONCAT(u.nombres,' ',u.apellidos) AS psicologo_nombre,
        CONCAT(p.nombres,' ',p.apellidos) AS paciente_nombre
      FROM sesiones_psicologia sp
      LEFT JOIN usuarios u ON u.id = sp.psicologo_id
      LEFT JOIN pacientes p ON p.id = sp.paciente_id
      WHERE sp.clinica_id = ? AND sp.paciente_id = ?
      ORDER BY sp.creado_en DESC
      LIMIT ? OFFSET ?
    `, [cid, paciente_id, Number(limit), offset]);

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM sesiones_psicologia WHERE clinica_id=? AND paciente_id=?",
      [cid, paciente_id]
    );
    res.json({ ok: true, data: rows, total });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/psicologia/sesiones/:id
router.get("/sesiones/:id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT sp.*,
        CONCAT(u.nombres,' ',u.apellidos) AS psicologo_nombre,
        CONCAT(p.nombres,' ',p.apellidos) AS paciente_nombre
      FROM sesiones_psicologia sp
      LEFT JOIN usuarios u ON u.id = sp.psicologo_id
      LEFT JOIN pacientes p ON p.id = sp.paciente_id
      WHERE sp.id = ? AND sp.clinica_id = ?
    `, [req.params.id, req.user.clinica_id]);
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/psicologia/sesiones
router.post("/sesiones", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const {
      paciente_id, cita_id, modalidad = "INDIVIDUAL",
      motivo_consulta, estado_mental, diagnostico_cie, diagnostico_desc,
      diagnosticos_secundarios, intervenciones, tarea_proxima, observaciones,
    } = req.body;
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    // Calcular número de sesión
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM sesiones_psicologia WHERE clinica_id=? AND paciente_id=?",
      [cid, paciente_id]
    );
    const numero_sesion = total + 1;

    const [result] = await pool.query(`
      INSERT INTO sesiones_psicologia
        (clinica_id, paciente_id, psicologo_id, cita_id, numero_sesion, modalidad,
         motivo_consulta, estado_mental, diagnostico_cie, diagnostico_desc,
         diagnosticos_secundarios, intervenciones, tarea_proxima, observaciones)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      cid, paciente_id, req.user.id, cita_id || null, numero_sesion, modalidad,
      motivo_consulta || null,
      estado_mental ? JSON.stringify(estado_mental) : null,
      diagnostico_cie || null, diagnostico_desc || null,
      diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null,
      intervenciones || null, tarea_proxima || null, observaciones || null,
    ]);
    res.status(201).json({ ok: true, id: result.insertId, numero_sesion });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/psicologia/sesiones/:id
router.put("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id, estado FROM sesiones_psicologia WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "La sesión ya está firmada y no puede editarse" });

    const {
      modalidad, motivo_consulta, estado_mental, diagnostico_cie, diagnostico_desc,
      diagnosticos_secundarios, intervenciones, tarea_proxima, observaciones,
    } = req.body;

    await pool.query(`
      UPDATE sesiones_psicologia SET
        modalidad=?, motivo_consulta=?, estado_mental=?, diagnostico_cie=?,
        diagnostico_desc=?, diagnosticos_secundarios=?, intervenciones=?,
        tarea_proxima=?, observaciones=?
      WHERE id=?
    `, [
      modalidad,
      motivo_consulta || null,
      estado_mental ? JSON.stringify(estado_mental) : null,
      diagnostico_cie || null, diagnostico_desc || null,
      diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null,
      intervenciones || null, tarea_proxima || null, observaciones || null,
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/psicologia/sesiones/:id/firmar
router.post("/sesiones/:id/firmar", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id FROM sesiones_psicologia WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    await pool.query(
      "UPDATE sesiones_psicologia SET estado='FIRMADA', firma_at=NOW() WHERE id=?",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/psicologia/sesiones/:id  (solo BORRADOR)
router.delete("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT estado FROM sesiones_psicologia WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "No se puede eliminar una sesión firmada" });
    await pool.query("DELETE FROM sesiones_psicologia WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HISTORIA PSICOLÓGICA
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/psicologia/historia/:paciente_id
router.get("/historia/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT * FROM historia_psicologica WHERE clinica_id=? AND paciente_id=?",
      [req.user.clinica_id, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/psicologia/historia/:paciente_id  (upsert)
router.post("/historia/:paciente_id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;
    const {
      motivo_derivacion, demanda_inicial, dinamica_familiar, historia_social,
      historia_laboral, nivel_educativo, estado_civil, antecedentes_psiq,
      diagnosticos_previos, medicacion_actual, hospitalizaciones,
      intentos_autoliticos, ideacion_actual, consumo_sustancias,
      eventos_traumaticos, genograma, redes_apoyo,
    } = req.body;

    await pool.query(`
      INSERT INTO historia_psicologica
        (clinica_id, paciente_id, motivo_derivacion, demanda_inicial, dinamica_familiar,
         historia_social, historia_laboral, nivel_educativo, estado_civil,
         antecedentes_psiq, diagnosticos_previos, medicacion_actual, hospitalizaciones,
         intentos_autoliticos, ideacion_actual, consumo_sustancias,
         eventos_traumaticos, genograma, redes_apoyo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        motivo_derivacion=VALUES(motivo_derivacion), demanda_inicial=VALUES(demanda_inicial),
        dinamica_familiar=VALUES(dinamica_familiar), historia_social=VALUES(historia_social),
        historia_laboral=VALUES(historia_laboral), nivel_educativo=VALUES(nivel_educativo),
        estado_civil=VALUES(estado_civil), antecedentes_psiq=VALUES(antecedentes_psiq),
        diagnosticos_previos=VALUES(diagnosticos_previos), medicacion_actual=VALUES(medicacion_actual),
        hospitalizaciones=VALUES(hospitalizaciones), intentos_autoliticos=VALUES(intentos_autoliticos),
        ideacion_actual=VALUES(ideacion_actual), consumo_sustancias=VALUES(consumo_sustancias),
        eventos_traumaticos=VALUES(eventos_traumaticos), genograma=VALUES(genograma),
        redes_apoyo=VALUES(redes_apoyo), actualizado_en=NOW()
    `, [
      cid, pid,
      motivo_derivacion || null, demanda_inicial || null, dinamica_familiar || null,
      historia_social || null, historia_laboral || null, nivel_educativo || null,
      estado_civil || null, antecedentes_psiq || null, diagnosticos_previos || null,
      medicacion_actual || null, hospitalizaciones || null,
      intentos_autoliticos ? 1 : 0, ideacion_actual ? 1 : 0,
      consumo_sustancias ? JSON.stringify(consumo_sustancias) : null,
      eventos_traumaticos || null,
      genograma ? JSON.stringify(genograma) : null,
      redes_apoyo || null,
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PLAN TERAPÉUTICO
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/psicologia/plan/:paciente_id
router.get("/plan/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT * FROM plan_terapeutico WHERE clinica_id=? AND paciente_id=? AND activo=1",
      [req.user.clinica_id, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/psicologia/plan/:paciente_id  (upsert)
router.post("/plan/:paciente_id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;
    const { enfoque, frecuencia, objetivos, progreso_general = 0, notas } = req.body;

    await pool.query(`
      INSERT INTO plan_terapeutico
        (clinica_id, paciente_id, psicologo_id, enfoque, frecuencia, objetivos, progreso_general, notas)
      VALUES (?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        psicologo_id=VALUES(psicologo_id), enfoque=VALUES(enfoque),
        frecuencia=VALUES(frecuencia), objetivos=VALUES(objetivos),
        progreso_general=VALUES(progreso_general), notas=VALUES(notas),
        actualizado_en=NOW()
    `, [
      cid, pid, req.user.id,
      enfoque || null, frecuencia || null,
      objetivos ? JSON.stringify(objetivos) : null,
      progreso_general, notas || null,
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCALAS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/psicologia/escalas/:paciente_id
router.get("/escalas/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM escalas_psicologia WHERE clinica_id=? AND paciente_id=? ORDER BY aplicado_en DESC",
      [req.user.clinica_id, req.params.paciente_id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/psicologia/escalas
router.post("/escalas", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const { paciente_id, sesion_id, tipo_escala, respuestas, puntaje_total, interpretacion } = req.body;
    if (!paciente_id || !tipo_escala || !respuestas) return res.status(400).json({ ok: false, msg: "Faltan campos" });

    const [result] = await pool.query(`
      INSERT INTO escalas_psicologia
        (clinica_id, paciente_id, sesion_id, tipo_escala, respuestas, puntaje_total, interpretacion)
      VALUES (?,?,?,?,?,?,?)
    `, [
      req.user.clinica_id, paciente_id, sesion_id || null, tipo_escala,
      JSON.stringify(respuestas), puntaje_total, interpretacion || null,
    ]);
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/psicologia/resumen/:paciente_id  (dashboard rápido del paciente)
router.get("/resumen/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;

    const [[{ total_sesiones }]] = await pool.query(
      "SELECT COUNT(*) AS total_sesiones FROM sesiones_psicologia WHERE clinica_id=? AND paciente_id=?",
      [cid, pid]
    );
    const [[ultima]] = await pool.query(
      "SELECT creado_en, numero_sesion, diagnostico_desc, estado FROM sesiones_psicologia WHERE clinica_id=? AND paciente_id=? ORDER BY creado_en DESC LIMIT 1",
      [cid, pid]
    );
    const [[plan]] = await pool.query(
      "SELECT progreso_general, enfoque FROM plan_terapeutico WHERE clinica_id=? AND paciente_id=? AND activo=1",
      [cid, pid]
    );
    const [escalas] = await pool.query(
      "SELECT tipo_escala, puntaje_total, interpretacion, aplicado_en FROM escalas_psicologia WHERE clinica_id=? AND paciente_id=? ORDER BY aplicado_en DESC LIMIT 5",
      [cid, pid]
    );

    res.json({ ok: true, data: { total_sesiones, ultima_sesion: ultima || null, plan: plan || null, escalas } });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
