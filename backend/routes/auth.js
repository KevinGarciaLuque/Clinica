const router = require("express").Router();
const pool = require("../db");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // clinica_id requerido para multi-clínica (modo header)
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) {
      return res.status(400).json({
        ok: false,
        msg: "Falta clinica_id. Envia header x-clinica-id",
      });
    }

    const [rows] = await pool.query(
      "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE clinica_id=? AND email=? LIMIT 1",
      [clinicaId, email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, msg: "Credenciales inválidas" });
    }

    const user = rows[0];
    if (!user.activo) {
      return res.status(403).json({ ok: false, msg: "Usuario inactivo" });
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      return res.status(401).json({ ok: false, msg: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      {
        uid: user.id,
        clinica_id: user.clinica_id,
        tipo: user.tipo,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "8h" }
    );

    res.json({
      ok: true,
      token,
      usuario: {
        id: user.id,
        clinica_id: user.clinica_id,
        nombres: user.nombres,
        apellidos: user.apellidos,
        email: user.email,
        tipo: user.tipo,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
