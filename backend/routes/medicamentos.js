/**
 * Catálogo de Medicamentos (compartido, sin clinica_id — o por clinica si se prefiere)
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

/**
 * GET /api/medicamentos?q=&page=1
 * Búsqueda de medicamentos (autocompletar + listado)
 */
router.get("/", auth(), async (req, res) => {
  try {
    const { q = "", page = 1 } = req.query;
    const limit  = 30;
    const offset = (page - 1) * limit;

    let sql    = "SELECT * FROM medicamentos WHERE activo = 1";
    const params = [];

    if (q.length >= 2) {
      sql += " AND (nombre_generico LIKE ? OR nombre_comercial LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY nombre_generico ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/medicamentos/:id
 */
router.get("/:id", auth(), async (req, res) => {
  try {
    const [[m]] = await pool.query("SELECT * FROM medicamentos WHERE id = ?", [req.params.id]);
    if (!m) return res.status(404).json({ ok: false, msg: "No encontrado" });
    res.json({ ok: true, data: m });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/medicamentos
 */
router.post("/", auth("ADMIN","SUPER_ADMIN","MEDICO"), async (req, res) => {
  try {
    const {
      nombre_generico, nombre_comercial,
      presentacion, via_administracion, contraindicaciones,
    } = req.body;

    if (!nombre_generico) return res.status(400).json({ ok: false, msg: "nombre_generico requerido" });

    const [r] = await pool.query(
      `INSERT INTO medicamentos
         (nombre_generico, nombre_comercial, presentacion, via_administracion, contraindicaciones)
       VALUES (?,?,?,?,?)`,
      [nombre_generico, nombre_comercial || null, presentacion || null, via_administracion || null, contraindicaciones || null]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PUT /api/medicamentos/:id
 */
router.put("/:id", auth("ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const {
      nombre_generico, nombre_comercial,
      presentacion, via_administracion, contraindicaciones,
    } = req.body;

    await pool.query(
      `UPDATE medicamentos
       SET nombre_generico=?, nombre_comercial=?,
           presentacion=?, via_administracion=?, contraindicaciones=?
       WHERE id=?`,
      [nombre_generico, nombre_comercial || null, presentacion || null, via_administracion || null, contraindicaciones || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * DELETE /api/medicamentos/:id  — toggle activo
 */
router.delete("/:id", auth("ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    await pool.query(
      "UPDATE medicamentos SET activo = NOT activo WHERE id = ?",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
