/**
 * routes/servicios.js
 * Catálogo de servicios y tarifas por clínica
 */

const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

// GET /api/servicios
router.get("/", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.super
      ? (req.query.clinica_id || req.tenant?.clinica_id)
      : req.user.clinica_id;

    const { categoria, activo = "1" } = req.query;
    let sql = "SELECT id, nombre, descripcion, categoria, precio, moneda, duracion_min, activo FROM servicios WHERE clinica_id=?";
    const params = [clinicaId];

    if (categoria) { sql += " AND categoria=?"; params.push(categoria); }
    if (activo !== "all") { sql += " AND activo=?"; params.push(Number(activo)); }
    sql += " ORDER BY categoria, nombre";

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/servicios/categorias  → lista de categorías usadas
router.get("/categorias", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const [rows] = await pool.query(
      "SELECT DISTINCT categoria FROM servicios WHERE clinica_id=? AND categoria IS NOT NULL ORDER BY categoria",
      [clinicaId]
    );
    res.json({ ok: true, data: rows.map(r => r.categoria) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/servicios/:id
router.get("/:id", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const [rows] = await pool.query(
      "SELECT * FROM servicios WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: "Servicio no encontrado" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/servicios
router.post("/", auth("SUPER_ADMIN","ADMIN","MEDICO","RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.super
      ? (req.body.clinica_id || req.tenant?.clinica_id)
      : req.user.clinica_id;

    const { nombre, descripcion, categoria, precio, moneda, duracion_min } = req.body;

    if (!nombre || precio === undefined) {
      return res.status(400).json({ ok: false, msg: "nombre y precio son obligatorios" });
    }

    const [r] = await pool.query(
      `INSERT INTO servicios (clinica_id, nombre, descripcion, categoria, precio, moneda, duracion_min)
       VALUES (?,?,?,?,?,?,?)`,
      [clinicaId, nombre, descripcion||null, categoria||"consulta",
       precio, moneda||"PEN", duracion_min||30]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/servicios/:id
router.put("/:id", auth("SUPER_ADMIN","ADMIN","MEDICO","RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? null : req.user.clinica_id;
    const { nombre, descripcion, categoria, precio, moneda, duracion_min, activo } = req.body;

    const base = `UPDATE servicios SET
      nombre=COALESCE(?,nombre), descripcion=COALESCE(?,descripcion),
      categoria=COALESCE(?,categoria), precio=COALESCE(?,precio),
      moneda=COALESCE(?,moneda), duracion_min=COALESCE(?,duracion_min),
      activo=COALESCE(?,activo)
    WHERE id=?`;

    const params = [
      nombre||null, descripcion||null, categoria||null,
      precio !== undefined ? precio : null,
      moneda||null, duracion_min||null,
      activo !== undefined ? activo : null,
      req.params.id
    ];

    if (clinicaId) {
      await pool.query(base + " AND clinica_id=?", [...params, clinicaId]);
    } else {
      await pool.query(base, params);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// DELETE /api/servicios/:id  → desactivar
router.delete("/:id", auth("SUPER_ADMIN","ADMIN","MEDICO","RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? null : req.user.clinica_id;
    const sql = clinicaId
      ? "UPDATE servicios SET activo=0 WHERE id=? AND clinica_id=?"
      : "UPDATE servicios SET activo=0 WHERE id=?";
    const params = clinicaId ? [req.params.id, clinicaId] : [req.params.id];
    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
