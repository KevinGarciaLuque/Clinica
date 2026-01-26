const router = require("express").Router();
const pool = require("../db");

// GET /api/clinicas
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, nombre, email, telefono, activo FROM clinicas ORDER BY nombre"
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
