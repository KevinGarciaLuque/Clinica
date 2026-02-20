const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const argon2 = require("argon2");

// ──────────────────────────────────────────────
//  GET /api/clinicas  → lista (SUPER_ADMIN ve todas; ADMIN ve la suya)
// ──────────────────────────────────────────────
router.get("/", auth("SUPER_ADMIN","ADMIN","MEDICO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    if (req.user.super) {
      const [rows] = await pool.query(
        "SELECT id, nombre, slug, logo_url, email, telefono, direccion, ciudad, pais, ruc, activo, creado_en FROM clinicas ORDER BY nombre"
      );
      return res.json({ ok: true, data: rows });
    }
    // No-super: solo puede ver la suya
    const [rows] = await pool.query(
      "SELECT id, nombre, slug, logo_url, email, telefono, direccion, ciudad, pais, ruc, activo, creado_en FROM clinicas WHERE id=?",
      [req.user.clinica_id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/clinicas/:id
router.get("/:id", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const [rows] = await pool.query(
      "SELECT id, nombre, slug, logo_url, email, telefono, direccion, ciudad, pais, ruc, datos_fiscales, activo FROM clinicas WHERE id=?",
      [id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    // Configuraciones clave-valor
    const [config] = await pool.query(
      "SELECT clave, valor FROM clinica_config WHERE clinica_id=?",
      [id]
    );
    res.json({ ok: true, data: { ...rows[0], config } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/clinicas  → solo SUPER_ADMIN puede crear clínicas
router.post("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { nombre, slug, email, telefono, direccion, ciudad, pais, ruc,
            admin_nombres, admin_apellidos, admin_email, admin_password } = req.body;

    if (!nombre || !slug) {
      return res.status(400).json({ ok: false, msg: "nombre y slug son obligatorios" });
    }

    // Verificar slug único
    const [exist] = await pool.query("SELECT id FROM clinicas WHERE slug=?", [slug]);
    if (exist.length) return res.status(409).json({ ok: false, msg: "El slug ya existe" });

    // Insertar clínica
    const [r] = await pool.query(
      `INSERT INTO clinicas (nombre, slug, email, telefono, direccion, ciudad, pais, ruc)
       VALUES (?,?,?,?,?,?,?,?)`,
      [nombre, slug, email||null, telefono||null, direccion||null, ciudad||null, pais||"PE", ruc||null]
    );
    const clinicaId = r.insertId;

    // Crear admin de la clínica si viene en el body
    if (admin_email && admin_password) {
      const hash = await argon2.hash(admin_password);
      await pool.query(
        `INSERT INTO usuarios (clinica_id, nombres, apellidos, email, password_hash, tipo)
         VALUES (?,?,?,?,?,?)`,
        [clinicaId, admin_nombres||"Admin", admin_apellidos||"Clínica",
         admin_email, hash, "ADMIN"]
      );
    }

    res.status(201).json({ ok: true, id: clinicaId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/clinicas/:id  → SUPER_ADMIN o ADMIN de esa clínica
router.put("/:id", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { nombre, slug, email, telefono, direccion, ciudad, pais, ruc, logo_url, activo } = req.body;

    if (slug) {
      const [exist] = await pool.query("SELECT id FROM clinicas WHERE slug=? AND id!=?", [slug, id]);
      if (exist.length) return res.status(409).json({ ok: false, msg: "El slug ya existe" });
    }

    await pool.query(
      `UPDATE clinicas SET
         nombre=COALESCE(?,nombre), slug=COALESCE(?,slug), email=COALESCE(?,email),
         telefono=COALESCE(?,telefono), direccion=COALESCE(?,direccion),
         ciudad=COALESCE(?,ciudad), pais=COALESCE(?,pais), ruc=COALESCE(?,ruc),
         logo_url=COALESCE(?,logo_url), activo=COALESCE(?,activo)
       WHERE id=?`,
      [nombre||null, slug||null, email||null, telefono||null, direccion||null,
       ciudad||null, pais||null, ruc||null, logo_url||null,
       activo !== undefined ? activo : null, id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/clinicas/:id/config  → guardar pares clave-valor de config
router.put("/:id/config", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { config } = req.body; // { smtp_host: "...", slot_minutos: "30", ... }

    if (!config || typeof config !== "object") {
      return res.status(400).json({ ok: false, msg: "config debe ser un objeto clave:valor" });
    }

    for (const [clave, valor] of Object.entries(config)) {
      await pool.query(
        `INSERT INTO clinica_config (clinica_id, clave, valor) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE valor=VALUES(valor)`,
        [id, clave, valor]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// DELETE /api/clinicas/:id  → solo SUPER_ADMIN (desactivar, no borrar)
router.delete("/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await pool.query("UPDATE clinicas SET activo=0 WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;

