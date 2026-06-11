const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const ROLES           = ["SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA"];
const ROLES_ESCRITURA = ["SUPER_ADMIN","ADMIN","MEDICO"];

// ─── Auto-crear tablas ────────────────────────────────────────────────────────
async function ensureTablas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sesiones_odontologia (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      dentista_id INT UNSIGNED NOT NULL, cita_id INT UNSIGNED,
      numero_sesion SMALLINT UNSIGNED NOT NULL DEFAULT 1,
      motivo_consulta TEXT, exploracion_clinica JSON, procedimientos JSON,
      diagnostico_cie VARCHAR(120), diagnostico_desc TEXT,
      indicaciones TEXT, proxima_cita TEXT, observaciones TEXT,
      estado ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
      firma_at DATETIME,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_so_clinica(clinica_id), INDEX idx_so_paciente(paciente_id),
      INDEX idx_so_dentista(dentista_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odontograma_estado (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      dientes JSON NOT NULL DEFAULT ('{}'),
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_oe(clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS historia_odontologica (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      motivo_consulta_inicial TEXT,
      frecuencia_cepillado VARCHAR(80), usa_hilo_dental TINYINT(1) DEFAULT 0,
      usa_enjuague TINYINT(1) DEFAULT 0, habitos_nocivos TEXT,
      diabetes TINYINT(1) DEFAULT 0, hipertension TINYINT(1) DEFAULT 0,
      anticoagulantes TINYINT(1) DEFAULT 0, alergia_anestesia TINYINT(1) DEFAULT 0,
      alergia_latex TINYINT(1) DEFAULT 0, otras_condiciones TEXT,
      ortodoncia_previa TINYINT(1) DEFAULT 0, extracciones_previas TEXT,
      implantes_previos TINYINT(1) DEFAULT 0, protesis_actual VARCHAR(120),
      tratamientos_previos TEXT, historia_familiar TEXT, notas TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ho(clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_tratamiento_odontologia (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      dentista_id INT UNSIGNED NOT NULL,
      items JSON NOT NULL DEFAULT ('[]'), costo_total DECIMAL(10,2) DEFAULT 0,
      notas TEXT, activo TINYINT(1) DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pto(clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
ensureTablas().catch(() => {});

// ═══════════════════════════════════════════════════════════════════════════════
//  SESIONES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/odontologia/sesiones?paciente_id=&page=1&limit=20
router.get("/sesiones", auth(...ROLES), async (req, res) => {
  try {
    const cid  = req.user.clinica_id;
    const pid  = req.query.paciente_id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const lim  = Math.min(50, parseInt(req.query.limit) || 20);
    const off  = (page - 1) * lim;

    if (!pid) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, pid]
    );
    const [rows] = await pool.query(
      `SELECT s.*, CONCAT(u.nombre,' ',IFNULL(u.apellido,'')) AS dentista_nombre
       FROM sesiones_odontologia s
       LEFT JOIN usuarios u ON u.id = s.dentista_id
       WHERE s.clinica_id=? AND s.paciente_id=?
       ORDER BY s.creado_en DESC LIMIT ? OFFSET ?`,
      [cid, pid, lim, off]
    );
    res.json({ ok: true, data: rows, total, page, pages: Math.ceil(total / lim) });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/odontologia/sesiones/:id
router.get("/sesiones/:id", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[row]] = await pool.query(
      `SELECT s.*, CONCAT(u.nombre,' ',IFNULL(u.apellido,'')) AS dentista_nombre
       FROM sesiones_odontologia s
       LEFT JOIN usuarios u ON u.id = s.dentista_id
       WHERE s.id=? AND s.clinica_id=?`,
      [req.params.id, cid]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/sesiones
router.post("/sesiones", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const uid = req.user.id;
    const {
      paciente_id, cita_id, motivo_consulta, exploracion_clinica,
      procedimientos, diagnostico_cie, diagnostico_desc,
      indicaciones, proxima_cita, observaciones
    } = req.body;

    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    // Calcular número de sesión
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, paciente_id]
    );

    const [result] = await pool.query(
      `INSERT INTO sesiones_odontologia
        (clinica_id, paciente_id, dentista_id, cita_id, numero_sesion,
         motivo_consulta, exploracion_clinica, procedimientos,
         diagnostico_cie, diagnostico_desc, indicaciones, proxima_cita, observaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cid, paciente_id, uid, cita_id || null, cnt + 1,
        motivo_consulta || null,
        exploracion_clinica ? JSON.stringify(exploracion_clinica) : null,
        procedimientos ? JSON.stringify(procedimientos) : JSON.stringify([]),
        diagnostico_cie || null, diagnostico_desc || null,
        indicaciones || null, proxima_cita || null, observaciones || null
      ]
    );
    const [[sesion]] = await pool.query(
      `SELECT * FROM sesiones_odontologia WHERE id=?`, [result.insertId]
    );
    res.status(201).json({ ok: true, data: sesion });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/odontologia/sesiones/:id
router.put("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[sesion]] = await pool.query(
      `SELECT * FROM sesiones_odontologia WHERE id=? AND clinica_id=?`,
      [req.params.id, cid]
    );
    if (!sesion) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (sesion.estado === 'FIRMADA') return res.status(400).json({ ok: false, msg: "Sesión ya firmada" });

    const {
      motivo_consulta, exploracion_clinica, procedimientos,
      diagnostico_cie, diagnostico_desc, indicaciones, proxima_cita, observaciones
    } = req.body;

    await pool.query(
      `UPDATE sesiones_odontologia SET
        motivo_consulta=?, exploracion_clinica=?, procedimientos=?,
        diagnostico_cie=?, diagnostico_desc=?,
        indicaciones=?, proxima_cita=?, observaciones=?
       WHERE id=? AND clinica_id=?`,
      [
        motivo_consulta ?? sesion.motivo_consulta,
        exploracion_clinica ? JSON.stringify(exploracion_clinica) : sesion.exploracion_clinica,
        procedimientos ? JSON.stringify(procedimientos) : sesion.procedimientos,
        diagnostico_cie ?? sesion.diagnostico_cie,
        diagnostico_desc ?? sesion.diagnostico_desc,
        indicaciones ?? sesion.indicaciones,
        proxima_cita ?? sesion.proxima_cita,
        observaciones ?? sesion.observaciones,
        req.params.id, cid
      ]
    );
    const [[updated]] = await pool.query(
      `SELECT * FROM sesiones_odontologia WHERE id=?`, [req.params.id]
    );
    res.json({ ok: true, data: updated });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/sesiones/:id/firmar
router.post("/sesiones/:id/firmar", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[sesion]] = await pool.query(
      `SELECT * FROM sesiones_odontologia WHERE id=? AND clinica_id=?`,
      [req.params.id, cid]
    );
    if (!sesion) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (sesion.estado === 'FIRMADA') return res.status(400).json({ ok: false, msg: "Ya firmada" });

    await pool.query(
      `UPDATE sesiones_odontologia SET estado='FIRMADA', firma_at=NOW() WHERE id=? AND clinica_id=?`,
      [req.params.id, cid]
    );
    res.json({ ok: true, msg: "Sesión firmada" });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/odontologia/sesiones/:id
router.delete("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[sesion]] = await pool.query(
      `SELECT estado FROM sesiones_odontologia WHERE id=? AND clinica_id=?`,
      [req.params.id, cid]
    );
    if (!sesion) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (sesion.estado === 'FIRMADA') return res.status(400).json({ ok: false, msg: "No se puede eliminar una sesión firmada" });

    await pool.query(`DELETE FROM sesiones_odontologia WHERE id=? AND clinica_id=?`, [req.params.id, cid]);
    res.json({ ok: true, msg: "Sesión eliminada" });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ODONTOGRAMA
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/odontologia/odontograma/:paciente_id
router.get("/odontograma/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[row]] = await pool.query(
      `SELECT * FROM odontograma_estado WHERE clinica_id=? AND paciente_id=?`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/odontograma/:paciente_id  (upsert)
router.post("/odontograma/:paciente_id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { dientes } = req.body;
    if (!dientes) return res.status(400).json({ ok: false, msg: "dientes requerido" });

    await pool.query(
      `INSERT INTO odontograma_estado (clinica_id, paciente_id, dientes)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE dientes=VALUES(dientes), actualizado_en=NOW()`,
      [cid, req.params.paciente_id, JSON.stringify(dientes)]
    );
    const [[row]] = await pool.query(
      `SELECT * FROM odontograma_estado WHERE clinica_id=? AND paciente_id=?`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HISTORIA ODONTOLÓGICA
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/odontologia/historia/:paciente_id
router.get("/historia/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[row]] = await pool.query(
      `SELECT * FROM historia_odontologica WHERE clinica_id=? AND paciente_id=?`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/historia/:paciente_id  (upsert)
router.post("/historia/:paciente_id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;
    const f = req.body;

    await pool.query(
      `INSERT INTO historia_odontologica
        (clinica_id, paciente_id, motivo_consulta_inicial, frecuencia_cepillado,
         usa_hilo_dental, usa_enjuague, habitos_nocivos,
         diabetes, hipertension, anticoagulantes, alergia_anestesia, alergia_latex,
         otras_condiciones, ortodoncia_previa, extracciones_previas,
         implantes_previos, protesis_actual, tratamientos_previos,
         historia_familiar, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         motivo_consulta_inicial=VALUES(motivo_consulta_inicial),
         frecuencia_cepillado=VALUES(frecuencia_cepillado),
         usa_hilo_dental=VALUES(usa_hilo_dental), usa_enjuague=VALUES(usa_enjuague),
         habitos_nocivos=VALUES(habitos_nocivos),
         diabetes=VALUES(diabetes), hipertension=VALUES(hipertension),
         anticoagulantes=VALUES(anticoagulantes), alergia_anestesia=VALUES(alergia_anestesia),
         alergia_latex=VALUES(alergia_latex), otras_condiciones=VALUES(otras_condiciones),
         ortodoncia_previa=VALUES(ortodoncia_previa), extracciones_previas=VALUES(extracciones_previas),
         implantes_previos=VALUES(implantes_previos), protesis_actual=VALUES(protesis_actual),
         tratamientos_previos=VALUES(tratamientos_previos),
         historia_familiar=VALUES(historia_familiar), notas=VALUES(notas),
         actualizado_en=NOW()`,
      [
        cid, pid,
        f.motivo_consulta_inicial || null, f.frecuencia_cepillado || null,
        f.usa_hilo_dental ? 1 : 0, f.usa_enjuague ? 1 : 0, f.habitos_nocivos || null,
        f.diabetes ? 1 : 0, f.hipertension ? 1 : 0,
        f.anticoagulantes ? 1 : 0, f.alergia_anestesia ? 1 : 0, f.alergia_latex ? 1 : 0,
        f.otras_condiciones || null,
        f.ortodoncia_previa ? 1 : 0, f.extracciones_previas || null,
        f.implantes_previos ? 1 : 0, f.protesis_actual || null,
        f.tratamientos_previos || null, f.historia_familiar || null, f.notas || null
      ]
    );
    const [[row]] = await pool.query(
      `SELECT * FROM historia_odontologica WHERE clinica_id=? AND paciente_id=?`, [cid, pid]
    );
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PLAN DE TRATAMIENTO
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/odontologia/plan/:paciente_id
router.get("/plan/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[row]] = await pool.query(
      `SELECT * FROM plan_tratamiento_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/plan/:paciente_id  (upsert)
router.post("/plan/:paciente_id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;
    const uid = req.user.id;
    const { items = [], notas, costo_total } = req.body;

    const costoCalc = items.reduce((s, i) => s + (parseFloat(i.costo_estimado) || 0), 0);

    await pool.query(
      `INSERT INTO plan_tratamiento_odontologia (clinica_id, paciente_id, dentista_id, items, costo_total, notas)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         items=VALUES(items), costo_total=VALUES(costo_total),
         notas=VALUES(notas), dentista_id=VALUES(dentista_id), actualizado_en=NOW()`,
      [cid, pid, uid, JSON.stringify(items), costo_total ?? costoCalc, notas || null]
    );
    const [[row]] = await pool.query(
      `SELECT * FROM plan_tratamiento_odontologia WHERE clinica_id=? AND paciente_id=?`, [cid, pid]
    );
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/odontologia/resumen/:paciente_id
router.get("/resumen/:paciente_id", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;

    const [[{ total_sesiones }]] = await pool.query(
      `SELECT COUNT(*) AS total_sesiones FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, pid]
    );
    const [[{ sesiones_firmadas }]] = await pool.query(
      `SELECT COUNT(*) AS sesiones_firmadas FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=? AND estado='FIRMADA'`,
      [cid, pid]
    );
    const [[ultima]] = await pool.query(
      `SELECT creado_en FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=? ORDER BY creado_en DESC LIMIT 1`,
      [cid, pid]
    );
    const [[plan]] = await pool.query(
      `SELECT items, costo_total FROM plan_tratamiento_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, pid]
    );

    let pendientes = 0, completados = 0;
    if (plan?.items) {
      const items = typeof plan.items === 'string' ? JSON.parse(plan.items) : plan.items;
      pendientes  = items.filter(i => !i.completado).length;
      completados = items.filter(i => i.completado).length;
    }

    res.json({
      ok: true,
      data: {
        total_sesiones,
        sesiones_firmadas,
        ultima_sesion: ultima?.creado_en || null,
        plan_pendientes: pendientes,
        plan_completados: completados,
        costo_total: plan?.costo_total || 0
      }
    });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
