const router = require("express").Router();
const pool = require("../db");

// GET /api/pacientes
router.get("/", async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const q = (req.query.q || "").trim();
    let sql =
      "SELECT id, nombres, apellidos, dni, telefono, email, activo, creado_en FROM pacientes WHERE clinica_id=? ";
    const params = [clinicaId];

    if (q) {
      sql += " AND (nombres LIKE ? OR apellidos LIKE ? OR dni LIKE ? OR telefono LIKE ?) ";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY id DESC LIMIT 200";

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/pacientes
router.post("/", async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo, direccion } = req.body;

    if (!nombres || !apellidos) {
      return res.status(400).json({ ok: false, msg: "nombres y apellidos son obligatorios" });
    }

    const [r] = await pool.query(
      `INSERT INTO pacientes (clinica_id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo, direccion)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [clinicaId, nombres, apellidos, dni || null, telefono || null, email || null, fecha_nacimiento || null, sexo || null, direccion || null]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
