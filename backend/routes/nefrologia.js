/**
 * Módulo de Nefrología — Hoja Analítica (flujograma de laboratorios)
 *
 *  Catálogo de parámetros (filas del formato en papel), configurable por clínica:
 *    GET    /api/nefrologia/parametros
 *    POST   /api/nefrologia/parametros
 *    PUT    /api/nefrologia/parametros/:id
 *    PUT    /api/nefrologia/parametros/:id/mover
 *    DELETE /api/nefrologia/parametros/:id
 *
 *  Hoja analítica (columnas = fechas/visitas), por paciente:
 *    GET    /api/nefrologia/hoja-analitica?paciente_id=
 *    POST   /api/nefrologia/hoja-analitica
 *    PUT    /api/nefrologia/hoja-analitica/:id
 *    DELETE /api/nefrologia/hoja-analitica/:id
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const ROLES           = ["SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA"];
const ROLES_ESCRITURA = ["SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA"];

// ─── Auto-crear tablas ────────────────────────────────────────────────────────
async function ensureTablas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalogo_parametros_nefrologia (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL,
      categoria VARCHAR(80) NOT NULL DEFAULT 'General',
      nombre VARCHAR(150) NOT NULL,
      unidad VARCHAR(40),
      orden INT DEFAULT 0,
      activo TINYINT(1) DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cpn_clinica(clinica_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hoja_analitica_nefrologia (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      fecha DATE NOT NULL,
      encabezado JSON,
      valores JSON NOT NULL DEFAULT ('{}'),
      creado_por INT UNSIGNED,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_han_clinica(clinica_id), INDEX idx_han_paciente(paciente_id),
      INDEX idx_han_fecha(fecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
ensureTablas().catch(() => {});

// ─── Parámetros por defecto (tomados de la hoja analítica del servicio) ───────
const DEFAULT_PARAMETROS = [
  // categoria, nombre
  ["Generales", "Peso"], ["Generales", "P/A"], ["Generales", "Diuresis"],
  ["Hematología", "FG"], ["Hematología", "Hto/Hb"], ["Hematología", "VCM/HCM"],
  ["Hematología", "Leucocitos"], ["Hematología", "N/L"], ["Hematología", "M/E"],
  ["Hematología", "Plaquetas"], ["Hematología", "TP/TPc"], ["Hematología", "TPT/TPTc"],
  ["Hematología", "INR"],
  ["Química Sanguínea", "Glicemia"], ["Química Sanguínea", "BUN/Cr"], ["Química Sanguínea", "Ac. Úrico"],
  ["Química Sanguínea", "Na/K"], ["Química Sanguínea", "Ca/Ca ionizado/P"], ["Química Sanguínea", "Cl/Mg"],
  ["Química Sanguínea", "Coles/Tg"], ["Química Sanguínea", "PT/Alb"], ["Química Sanguínea", "TGO/TGP"],
  ["Química Sanguínea", "FA/LDH/GGT"], ["Química Sanguínea", "BT/BD/BI"],
  ["Gases/Orina", "PH/PO2"], ["Gases/Orina", "PCO2/HCO3"], ["Gases/Orina", "Orina PH"],
  ["Gases/Orina", "DE/Osmol"], ["Gases/Orina", "Nit/Est Leu"], ["Gases/Orina", "Pror/Sang"],
  ["Gases/Orina", "Sedimento"], ["Gases/Orina", "Prot. 24h"], ["Gases/Orina", "Índice Pr/Cr"],
  ["Orina - Función Renal", "Microalbuminuria"], ["Orina - Función Renal", "CaU/Ca/Cr"],
  ["Orina - Función Renal", "NaU/FeNa"], ["Orina - Función Renal", "KU/FeK"],
  ["Orina - Función Renal", "AU/AU/Cr"], ["Orina - Función Renal", "PU/%RP"],
  ["Química Sanguínea", "Anion Gap"],
  ["Inmunología/Serología", "VES/PCR/Procalci"], ["Inmunología/Serología", "C3/C4"],
  ["Inmunología/Serología", "ANA/DNAn"], ["Inmunología/Serología", "ASO/ANKA"],
  ["Inmunología/Serología", "IgG/IgM/IgA"], ["Inmunología/Serología", "PTH/Vit D"],
  ["Inmunología/Serología", "He/transferrina"], ["Inmunología/Serología", "Ferritina"],
  ["Inmunología/Serología", "Vit B/Ac. Fólico"], ["Inmunología/Serología", "TSH/T3/T4"],
  ["Serología Infecciosa", "Toxo IgG/IgM"], ["Serología Infecciosa", "CMV IgG/IgM"],
  ["Serología Infecciosa", "EBV IgG/IgM"], ["Serología Infecciosa", "Herpes 1 IgG/IgM"],
  ["Serología Infecciosa", "Herpes 2 IgG/IgM"], ["Serología Infecciosa", "Varicela IgG/IgM"],
  ["Serología Infecciosa", "RPR o VDRL"], ["Serología Infecciosa", "Hep B/C"],
  ["Serología Infecciosa", "HIV"],
  ["Cultivos", "Urocultivo"], ["Cultivos", "Hemo P/CVC"], ["Cultivos", "EGH/Coprocultivo"],
  ["Cultivos", "Citoqq LP"], ["Cultivos", "Cultivo LP"],
  ["Niveles de Fármacos", "Niveles CsA"], ["Niveles de Fármacos", "Niveles FK"],
  ["Niveles de Fármacos", "% Ku"], ["Niveles de Fármacos", "KTV"],
  ["Estudios de Imagen y Otros", "USG Renal"], ["Estudios de Imagen y Otros", "PIV"],
  ["Estudios de Imagen y Otros", "UCGM"], ["Estudios de Imagen y Otros", "Gamagrama"],
  ["Estudios de Imagen y Otros", "Densitometría"], ["Estudios de Imagen y Otros", "Ecocardiograma"],
  ["Estudios de Imagen y Otros", "Biopsia Renal"], ["Estudios de Imagen y Otros", "Transfusiones"],
];

async function seedParametrosSiVacio(clinicaId) {
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM catalogo_parametros_nefrologia WHERE clinica_id = ?",
    [clinicaId]
  );
  if (total > 0) return;
  const values = DEFAULT_PARAMETROS.map(([categoria, nombre], i) => [clinicaId, categoria, nombre, i + 1]);
  await pool.query(
    "INSERT INTO catalogo_parametros_nefrologia (clinica_id, categoria, nombre, orden) VALUES ?",
    [values]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  CATÁLOGO DE PARÁMETROS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/nefrologia/parametros
router.get("/parametros", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    await seedParametrosSiVacio(cid);
    const [rows] = await pool.query(
      `SELECT id, categoria, nombre, unidad, orden, activo
       FROM catalogo_parametros_nefrologia
       WHERE clinica_id = ? AND activo = 1
       ORDER BY orden ASC, categoria ASC`,
      [cid]
    );
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/nefrologia/parametros
router.post("/parametros", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { categoria, nombre, unidad } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });
    }
    const [[{ maxOrden }]] = await pool.query(
      "SELECT COALESCE(MAX(orden), 0) AS maxOrden FROM catalogo_parametros_nefrologia WHERE clinica_id = ?",
      [cid]
    );
    const [r] = await pool.query(
      `INSERT INTO catalogo_parametros_nefrologia (clinica_id, categoria, nombre, unidad, orden)
       VALUES (?, ?, ?, ?, ?)`,
      [cid, (categoria || "General").trim(), nombre.trim(), unidad ? unidad.trim() : null, maxOrden + 1]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/nefrologia/parametros/:id
router.put("/parametros/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { categoria, nombre, unidad } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });
    }
    await pool.query(
      `UPDATE catalogo_parametros_nefrologia
       SET categoria = ?, nombre = ?, unidad = ?
       WHERE id = ? AND clinica_id = ?`,
      [(categoria || "General").trim(), nombre.trim(), unidad ? unidad.trim() : null, req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/nefrologia/parametros/:id/mover  { direccion: "arriba" | "abajo" }
router.put("/parametros/:id/mover", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { direccion } = req.body;

    const [[item]] = await pool.query(
      "SELECT id, orden FROM catalogo_parametros_nefrologia WHERE id = ? AND clinica_id = ? AND activo = 1",
      [req.params.id, cid]
    );
    if (!item) return res.status(404).json({ ok: false, msg: "No encontrado" });

    const op  = direccion === "arriba" ? "<" : ">";
    const ord = direccion === "arriba" ? "DESC" : "ASC";
    const [[adj]] = await pool.query(
      `SELECT id, orden FROM catalogo_parametros_nefrologia
       WHERE clinica_id = ? AND activo = 1 AND orden ${op} ?
       ORDER BY orden ${ord} LIMIT 1`,
      [cid, item.orden]
    );
    if (!adj) return res.json({ ok: true });

    await pool.query("UPDATE catalogo_parametros_nefrologia SET orden = ? WHERE id = ?", [adj.orden, item.id]);
    await pool.query("UPDATE catalogo_parametros_nefrologia SET orden = ? WHERE id = ?", [item.orden, adj.id]);

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/nefrologia/parametros/:id (soft)
router.delete("/parametros/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    await pool.query(
      "UPDATE catalogo_parametros_nefrologia SET activo = 0 WHERE id = ? AND clinica_id = ?",
      [req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  HOJA ANALÍTICA (columnas = fechas)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/nefrologia/hoja-analitica?paciente_id=
router.get("/hoja-analitica", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.query.paciente_id;
    if (!pid) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const [rows] = await pool.query(
      `SELECT id, fecha, encabezado, valores, creado_en, actualizado_en
       FROM hoja_analitica_nefrologia
       WHERE clinica_id = ? AND paciente_id = ?
       ORDER BY fecha ASC, id ASC`,
      [cid, pid]
    );
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/nefrologia/hoja-analitica  { paciente_id, fecha, encabezado, valores }
router.post("/hoja-analitica", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, fecha, encabezado, valores } = req.body;
    if (!paciente_id || !fecha) {
      return res.status(400).json({ ok: false, msg: "paciente_id y fecha son obligatorios" });
    }
    const [r] = await pool.query(
      `INSERT INTO hoja_analitica_nefrologia (clinica_id, paciente_id, fecha, encabezado, valores, creado_por)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cid, paciente_id, fecha, JSON.stringify(encabezado || {}), JSON.stringify(valores || {}), req.user.id]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/nefrologia/hoja-analitica/:id  { fecha, encabezado, valores }
router.put("/hoja-analitica/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { fecha, encabezado, valores } = req.body;

    const campos = [];
    const params = [];
    if (fecha !== undefined)      { campos.push("fecha = ?");      params.push(fecha); }
    if (encabezado !== undefined) { campos.push("encabezado = ?"); params.push(JSON.stringify(encabezado || {})); }
    if (valores !== undefined)    { campos.push("valores = ?");    params.push(JSON.stringify(valores || {})); }
    if (campos.length === 0) return res.json({ ok: true });

    params.push(req.params.id, cid);
    await pool.query(
      `UPDATE hoja_analitica_nefrologia SET ${campos.join(", ")} WHERE id = ? AND clinica_id = ?`,
      params
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/nefrologia/hoja-analitica/:id
router.delete("/hoja-analitica/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    await pool.query(
      "DELETE FROM hoja_analitica_nefrologia WHERE id = ? AND clinica_id = ?",
      [req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
