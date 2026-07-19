/**
 * Catálogo de Condiciones Médicas (Anamnesis / HC-02) por clínica
 * GET    /api/catalogos-condiciones-medicas        → lista activas de la clínica
 * POST   /api/catalogos-condiciones-medicas        → crear
 * PUT    /api/catalogos-condiciones-medicas/:id    → actualizar
 * PUT    /api/catalogos-condiciones-medicas/:id/mover → subir / bajar
 * DELETE /api/catalogos-condiciones-medicas/:id    → desactivar
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
      `SELECT id, nombre, requiere_especifique, es_alerta, orden, activo
       FROM catalogo_condiciones_medicas
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

    const { nombre, requiere_especifique, es_alerta } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });
    }

    const [[{ maxOrden }]] = await pool.query(
      "SELECT COALESCE(MAX(orden), 0) AS maxOrden FROM catalogo_condiciones_medicas WHERE clinica_id = ? AND activo = 1",
      [clinicaId]
    );

    const [r] = await pool.query(
      `INSERT INTO catalogo_condiciones_medicas (clinica_id, nombre, requiere_especifique, es_alerta, orden)
       VALUES (?, ?, ?, ?, ?)`,
      [clinicaId, nombre.trim(), requiere_especifique ? 1 : 0, es_alerta ? 1 : 0, maxOrden + 1]
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
    const { nombre, requiere_especifique, es_alerta } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });
    }

    await pool.query(
      `UPDATE catalogo_condiciones_medicas
       SET nombre = ?, requiere_especifique = ?, es_alerta = ?
       WHERE id = ? AND clinica_id = ?`,
      [nombre.trim(), requiere_especifique ? 1 : 0, es_alerta ? 1 : 0, req.params.id, clinicaId]
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
      "SELECT id, orden FROM catalogo_condiciones_medicas WHERE id = ? AND clinica_id = ? AND activo = 1",
      [req.params.id, clinicaId]
    );
    if (!item) return res.status(404).json({ ok: false, msg: "No encontrado" });

    const op  = direccion === "arriba" ? "<" : ">";
    const ord = direccion === "arriba" ? "DESC" : "ASC";
    const [[adj]] = await pool.query(
      `SELECT id, orden FROM catalogo_condiciones_medicas
       WHERE clinica_id = ? AND activo = 1 AND orden ${op} ?
       ORDER BY orden ${ord} LIMIT 1`,
      [clinicaId, item.orden]
    );
    if (!adj) return res.json({ ok: true }); // ya está en el extremo

    await pool.query("UPDATE catalogo_condiciones_medicas SET orden = ? WHERE id = ?", [adj.orden, item.id]);
    await pool.query("UPDATE catalogo_condiciones_medicas SET orden = ? WHERE id = ?", [item.orden, adj.id]);

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
      `UPDATE catalogo_condiciones_medicas SET activo = 0 WHERE id = ? AND clinica_id = ?`,
      [req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
