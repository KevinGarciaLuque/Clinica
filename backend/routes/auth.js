const router = require("express").Router();
const pool = require("../db");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, msg: "Email y contraseña son obligatorios" });
    }

    const clinicaId = req.tenant?.clinica_id || null;

    // 1) Intentar login como SUPER_ADMIN (sin clinica_id)
    let user = null;

    const [superRows] = await pool.query(
      "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE email=? AND tipo='SUPER_ADMIN' LIMIT 1",
      [email],
    );

    if (superRows.length > 0) {
      user = superRows[0];
    } else {
      // 2) Si no es super, entonces SÍ exigimos clinica_id
      if (!clinicaId) {
        return res.status(400).json({
          ok: false,
          msg: "Falta clinica_id. Envia header x-clinica-id",
        });
      }

      const [rows] = await pool.query(
        "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE clinica_id=? AND email=? LIMIT 1",
        [clinicaId, email],
      );

      if (rows.length === 0) {
        return res
          .status(401)
          .json({ ok: false, msg: "Credenciales inválidas" });
      }

      user = rows[0];
    }

    // Validaciones comunes
    if (!user.activo) {
      return res.status(403).json({ ok: false, msg: "Usuario inactivo" });
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      return res.status(401).json({ ok: false, msg: "Credenciales inválidas" });
    }

    const esSuper = user.tipo === "SUPER_ADMIN";

    const token = jwt.sign(
      {
        uid: user.id,
        clinica_id: user.clinica_id || null,
        tipo: user.tipo,
        super: esSuper,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "8h" },
    );

    res.json({
      ok: true,
      token,
      usuario: {
        id: user.id,
        clinica_id: user.clinica_id || null,
        nombres: user.nombres,
        apellidos: user.apellidos,
        email: user.email,
        tipo: user.tipo,
        super: esSuper,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
