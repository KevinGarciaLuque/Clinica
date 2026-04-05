const router = require("express").Router();
const pool = require("../db");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password, clinica_slug } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, msg: "Email y contraseña son obligatorios" });
    }

    // Resolver clinica_id: puede venir del header, del body (slug) o null
    let clinicaId = req.tenant?.clinica_id || null;
    if (!clinicaId && clinica_slug) {
      const [slugRows] = await pool.query(
        "SELECT id FROM clinicas WHERE slug=? AND activo=1 LIMIT 1",
        [clinica_slug]
      );
      if (slugRows.length) clinicaId = slugRows[0].id;
    }

    // 1) Buscar como SUPER_ADMIN
    let user = null;
    const [superRows] = await pool.query(
      "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE email=? AND tipo='SUPER_ADMIN' LIMIT 1",
      [email],
    );
    if (superRows.length > 0) {
      user = superRows[0];
    } else {
      // 2) Buscar en la clínica indicada (header/slug)
      if (clinicaId) {
        const [rows] = await pool.query(
          "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE clinica_id=? AND email=? LIMIT 1",
          [clinicaId, email],
        );
        if (rows.length) user = rows[0];
      }
      // 3) Si no se indicó clínica, buscar el email en cualquier clínica (único)
      if (!user) {
        const [anyRows] = await pool.query(
          "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE email=? AND tipo != 'SUPER_ADMIN' LIMIT 1",
          [email],
        );
        if (anyRows.length) user = anyRows[0];
      }
      if (!user) {
        return res.status(401).json({ ok: false, msg: "Credenciales inválidas" });
      }
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

    // Obtener nombre e info de licencia de la clínica
    let clinicaNombre = null;
    let licencia_info = null;
    if (user.clinica_id) {
      const [clinicaRows] = await pool.query(
        "SELECT nombre, plan_tipo, licencia_inicio, licencia_fin FROM clinicas WHERE id=? LIMIT 1",
        [user.clinica_id]
      );
      if (clinicaRows.length) {
        clinicaNombre = clinicaRows[0].nombre;
        const { plan_tipo, licencia_inicio, licencia_fin } = clinicaRows[0];
        const fin  = licencia_fin ? new Date(licencia_fin) : null;
        const ahora = new Date();
        const dias  = fin ? Math.ceil((fin - ahora) / 86400000) : null;
        licencia_info = {
          plan_tipo:       plan_tipo || "trial",
          licencia_inicio: licencia_inicio || null,
          licencia_fin:    licencia_fin    || null,
          dias_restantes:  dias,
          vencida:         fin ? fin < ahora : false,
        };
      }
    }

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
      licencia_info,
      usuario: {
        id: user.id,
        clinica_id: user.clinica_id || null,
        clinica_nombre: clinicaNombre,
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
