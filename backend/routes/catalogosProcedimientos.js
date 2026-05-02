/**
 * Catálogo de Procedimientos por clínica (Dermatológicos + Estéticos)
 * GET    /api/catalogos-procedimientos           → lista activos de la clínica
 * POST   /api/catalogos-procedimientos           → crear
 * PUT    /api/catalogos-procedimientos/:id       → actualizar
 * PUT    /api/catalogos-procedimientos/:id/mover → cambiar orden
 * DELETE /api/catalogos-procedimientos/:id       → desactivar (soft)
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

// ── GET ──────────────────────────────────────────────────────────────────────
router.get("/", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.json({ ok: true, data: [] });

    const { categoria } = req.query;
    const params = [clinicaId];
    let catFilter = "";
    if (categoria) {
      catFilter = " AND categoria = ?";
      params.push(categoria);
    }

    const [rows] = await pool.query(
      `SELECT id, nombre, categoria, descripcion, precio_ref, duracion_min, orden, activo
       FROM catalogos_procedimientos
       WHERE clinica_id = ? AND activo = 1${catFilter}
       ORDER BY categoria ASC, orden ASC, nombre ASC`,
      params
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST ─────────────────────────────────────────────────────────────────────
router.post("/", auth("ADMIN", "SUPER_ADMIN", "MEDICO"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "No se encontró la clínica." });

    const [[clinicaRow]] = await pool.query("SELECT id FROM clinicas WHERE id = ?", [clinicaId]);
    if (!clinicaRow) return res.status(400).json({ ok: false, msg: "Clínica no válida." });

    const { nombre, categoria, descripcion, precio_ref, duracion_min } = req.body;
    if (!nombre || !nombre.trim())
      return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });

    const cat = ["dermatologico", "estetico"].includes(categoria) ? categoria : "dermatologico";

    const [[{ maxOrden }]] = await pool.query(
      "SELECT COALESCE(MAX(orden), 0) AS maxOrden FROM catalogos_procedimientos WHERE clinica_id = ? AND categoria = ? AND activo = 1",
      [clinicaId, cat]
    );

    const [r] = await pool.query(
      `INSERT INTO catalogos_procedimientos (clinica_id, nombre, categoria, descripcion, precio_ref, duracion_min, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        clinicaId,
        nombre.trim(),
        cat,
        descripcion?.trim() || null,
        precio_ref ? parseFloat(precio_ref) : null,
        duracion_min ? parseInt(duracion_min, 10) : null,
        maxOrden + 1,
      ]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT ──────────────────────────────────────────────────────────────────────
router.put("/:id", auth("ADMIN", "SUPER_ADMIN", "MEDICO"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    const { nombre, categoria, descripcion, precio_ref, duracion_min } = req.body;

    if (!nombre || !nombre.trim())
      return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });

    const cat = ["dermatologico", "estetico"].includes(categoria) ? categoria : "dermatologico";

    await pool.query(
      `UPDATE catalogos_procedimientos
       SET nombre = ?, categoria = ?, descripcion = ?, precio_ref = ?, duracion_min = ?
       WHERE id = ? AND clinica_id = ?`,
      [
        nombre.trim(),
        cat,
        descripcion?.trim() || null,
        precio_ref ? parseFloat(precio_ref) : null,
        duracion_min ? parseInt(duracion_min, 10) : null,
        req.params.id,
        clinicaId,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /:id/mover ────────────────────────────────────────────────────────────
router.put("/:id/mover", auth("ADMIN", "SUPER_ADMIN", "MEDICO"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    const { direccion } = req.body;

    const [[item]] = await pool.query(
      "SELECT id, orden, categoria FROM catalogos_procedimientos WHERE id = ? AND clinica_id = ? AND activo = 1",
      [req.params.id, clinicaId]
    );
    if (!item) return res.status(404).json({ ok: false, msg: "No encontrado" });

    const op  = direccion === "arriba" ? "<" : ">";
    const ord = direccion === "arriba" ? "DESC" : "ASC";
    const [[adj]] = await pool.query(
      `SELECT id, orden FROM catalogos_procedimientos
       WHERE clinica_id = ? AND categoria = ? AND activo = 1 AND orden ${op} ?
       ORDER BY orden ${ord} LIMIT 1`,
      [clinicaId, item.categoria, item.orden]
    );
    if (!adj) return res.json({ ok: true });

    await pool.query("UPDATE catalogos_procedimientos SET orden = ? WHERE id = ?", [adj.orden, item.id]);
    await pool.query("UPDATE catalogos_procedimientos SET orden = ? WHERE id = ?", [item.orden, adj.id]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── DELETE (soft) ─────────────────────────────────────────────────────────────
router.delete("/:id", auth("ADMIN", "SUPER_ADMIN", "MEDICO"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    await pool.query(
      "UPDATE catalogos_procedimientos SET activo = 0 WHERE id = ? AND clinica_id = ?",
      [req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
