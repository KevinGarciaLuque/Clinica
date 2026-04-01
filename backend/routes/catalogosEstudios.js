/**
 * Catálogos de Estudios / Exámenes
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

/**
 * GET /api/catalogos-estudios?q=&categoria=
 */
router.get("/", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { q = "", categoria } = req.query;

    let sql = "SELECT * FROM catalogos_estudios WHERE activo = 1 AND clinica_id = ?";
    const params = [cid];

    if (q.length >= 2) {
      sql += " AND (nombre LIKE ? OR descripcion LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }
    if (categoria) {
      sql += " AND categoria = ?";
      params.push(categoria);
    }

    sql += " ORDER BY categoria, nombre ASC LIMIT 200";
    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/catalogos-estudios/:id
 */
router.get("/:id", auth(), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT * FROM catalogos_estudios WHERE id = ? AND clinica_id = ?",
      [req.params.id, clinicaOf(req)]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrado" });
    res.json({ ok: true, data: row });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/catalogos-estudios
 */
router.post("/", auth("ADMIN", "SUPER_ADMIN", "MEDICO"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { nombre, categoria = "LABORATORIO", descripcion = "" } = req.body;

    if (!nombre) {
      return res.status(400).json({ ok: false, msg: "nombre es requerido" });
    }

    const [r] = await pool.query(
      `INSERT INTO catalogos_estudios (clinica_id, nombre, categoria, descripcion)
       VALUES (?,?,?,?)`,
      [cid, nombre.trim(), categoria, descripcion.trim()]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PUT /api/catalogos-estudios/:id
 */
router.put("/:id", auth("ADMIN", "SUPER_ADMIN", "MEDICO"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { nombre, categoria, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({ ok: false, msg: "nombre es requerido" });
    }

    await pool.query(
      `UPDATE catalogos_estudios
         SET nombre = ?, categoria = ?, descripcion = ?
       WHERE id = ? AND clinica_id = ?`,
      [nombre.trim(), categoria || "LABORATORIO", (descripcion || "").trim(), req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * DELETE /api/catalogos-estudios/:id  (toggle activo)
 */
router.delete("/:id", auth("ADMIN", "SUPER_ADMIN", "MEDICO"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    await pool.query(
      "UPDATE catalogos_estudios SET activo = IF(activo=1,0,1) WHERE id = ? AND clinica_id = ?",
      [req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
