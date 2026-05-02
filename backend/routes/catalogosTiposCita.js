/**
 * Catálogo de Tipos de Cita por clínica
 * GET    /api/catalogos-tipos-cita        → lista activos de la clínica
 * POST   /api/catalogos-tipos-cita        → crear
 * PUT    /api/catalogos-tipos-cita/:id    → actualizar
 * DELETE /api/catalogos-tipos-cita/:id    → desactivar
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

// ── GET ──────────────────────────────────────────────────────────────────────
router.get("/", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.json({ ok: true, data: [] });

    const [rows] = await pool.query(
      `SELECT id, nombre, descripcion, orden, activo
       FROM catalogos_tipos_cita
       WHERE clinica_id = ? AND activo = 1
       ORDER BY orden ASC, nombre ASC`,
      [clinicaId]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST ─────────────────────────────────────────────────────────────────────
router.post("/", auth("ADMIN", "SUPER_ADMIN", "MEDICO", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "No se encontró la clínica. Recarga la página e intenta de nuevo." });

    // Verificar que la clínica exista
    const [[clinicaRow]] = await pool.query("SELECT id FROM clinicas WHERE id = ?", [clinicaId]);
    if (!clinicaRow) return res.status(400).json({ ok: false, msg: "Clínica no válida." });

    const { nombre, descripcion } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });
    }

    // Auto-calcular orden como MAX + 1
    const [[{ maxOrden }]] = await pool.query(
      "SELECT COALESCE(MAX(orden), 0) AS maxOrden FROM catalogos_tipos_cita WHERE clinica_id = ? AND activo = 1",
      [clinicaId]
    );

    const [r] = await pool.query(
      `INSERT INTO catalogos_tipos_cita (clinica_id, nombre, descripcion, orden)
       VALUES (?, ?, ?, ?)`,
      [clinicaId, nombre.trim(), descripcion?.trim() || null, maxOrden + 1]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT ──────────────────────────────────────────────────────────────────────
router.put("/:id", auth("ADMIN", "SUPER_ADMIN", "MEDICO", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    const { nombre, descripcion } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });
    }

    await pool.query(
      `UPDATE catalogos_tipos_cita
       SET nombre = ?, descripcion = ?
       WHERE id = ? AND clinica_id = ?`,
      [nombre.trim(), descripcion?.trim() || null, req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /:id/mover  (subir / bajar en la lista) ───────────────────────────────
router.put("/:id/mover", auth("ADMIN", "SUPER_ADMIN", "MEDICO", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    const { direccion } = req.body; // "arriba" | "abajo"

    const [[item]] = await pool.query(
      "SELECT id, orden FROM catalogos_tipos_cita WHERE id = ? AND clinica_id = ? AND activo = 1",
      [req.params.id, clinicaId]
    );
    if (!item) return res.status(404).json({ ok: false, msg: "No encontrado" });

    const op  = direccion === "arriba" ? "<" : ">";
    const ord = direccion === "arriba" ? "DESC" : "ASC";
    const [[adj]] = await pool.query(
      `SELECT id, orden FROM catalogos_tipos_cita
       WHERE clinica_id = ? AND activo = 1 AND orden ${op} ?
       ORDER BY orden ${ord} LIMIT 1`,
      [clinicaId, item.orden]
    );
    if (!adj) return res.json({ ok: true }); // ya está en el extremo

    await pool.query("UPDATE catalogos_tipos_cita SET orden = ? WHERE id = ?", [adj.orden, item.id]);
    await pool.query("UPDATE catalogos_tipos_cita SET orden = ? WHERE id = ?", [item.orden, adj.id]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── DELETE (soft) ────────────────────────────────────────────────────────────
router.delete("/:id", auth("ADMIN", "SUPER_ADMIN", "MEDICO", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    await pool.query(
      `UPDATE catalogos_tipos_cita SET activo = 0 WHERE id = ? AND clinica_id = ?`,
      [req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
