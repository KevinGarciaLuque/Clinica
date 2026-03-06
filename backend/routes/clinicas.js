const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const argon2 = require("argon2");

// ──────────────────────────────────────────────
//  GET /api/clinicas/tipos  → catálogo de tipos de clínica
// ──────────────────────────────────────────────
router.get("/tipos", auth("SUPER_ADMIN","ADMIN","MEDICO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, clave, nombre, icono, color, descripcion FROM tipos_clinica WHERE activo=1 ORDER BY nombre"
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  GET /api/clinicas/modulos  → módulos activos de la clínica del usuario
// ──────────────────────────────────────────────
router.get("/modulos", auth("SUPER_ADMIN","ADMIN","MEDICO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    // SUPER_ADMIN tiene acceso a todos los módulos base
    if (req.user.super) {
      const [rows] = await pool.query(
        "SELECT clave, nombre, icono, ruta FROM modulos_sistema WHERE disponible=1 ORDER BY orden"
      );
      return res.json({ ok: true, data: rows });
    }

    // Para usuarios de clínica: módulos según el tipo de su clínica
    const [rows] = await pool.query(`
      SELECT ms.clave, ms.nombre, ms.icono, ms.ruta
      FROM modulos_sistema ms
      INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id
      INNER JOIN clinicas c ON c.tipo_id = tcm.tipo_id
      WHERE c.id = ? AND ms.disponible = 1
      ORDER BY ms.orden
    `, [req.user.clinica_id]);

    // Si la clínica no tiene tipo asignado, devolver módulos base
    if (!rows.length) {
      const [base] = await pool.query(
        "SELECT clave, nombre, icono, ruta FROM modulos_sistema WHERE clave IN (?,?,?,?,?,?) AND disponible=1 ORDER BY orden",
        ["dashboard","pacientes","citas","historia_clinica","chat_ia","estudios"]
      );
      return res.json({ ok: true, data: base });
    }

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  GET /api/clinicas  → lista (SUPER_ADMIN ve todas; ADMIN ve la suya)
// ──────────────────────────────────────────────
router.get("/", auth("SUPER_ADMIN","ADMIN","MEDICO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    if (req.user.super) {
      const [rows] = await pool.query(`
        SELECT c.id, c.nombre, c.slug, c.tipo_id, c.logo_url, c.email, c.telefono,
               c.direccion, c.ciudad, c.pais, c.ruc, c.activo, c.creado_en,
               t.clave AS tipo_clave, t.nombre AS tipo_nombre, t.icono AS tipo_icono, t.color AS tipo_color
        FROM clinicas c
        LEFT JOIN tipos_clinica t ON t.id = c.tipo_id
        ORDER BY c.nombre
      `);
      return res.json({ ok: true, data: rows });
    }
    // No-super: solo puede ver la suya
    const [rows] = await pool.query(`
      SELECT c.id, c.nombre, c.slug, c.tipo_id, c.logo_url, c.email, c.telefono,
             c.direccion, c.ciudad, c.pais, c.ruc, c.activo, c.creado_en,
             t.clave AS tipo_clave, t.nombre AS tipo_nombre, t.icono AS tipo_icono, t.color AS tipo_color
      FROM clinicas c
      LEFT JOIN tipos_clinica t ON t.id = c.tipo_id
      WHERE c.id=?
    `, [req.user.clinica_id]);
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
      "SELECT id, nombre, slug, tipo_id, logo_url, email, telefono, direccion, ciudad, pais, ruc, datos_fiscales, activo FROM clinicas WHERE id=?",
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
    const { nombre, slug, tipo_id, email, telefono, direccion, ciudad, pais, ruc,
            admin_nombres, admin_apellidos, admin_email, admin_password } = req.body;

    if (!nombre || !slug) {
      return res.status(400).json({ ok: false, msg: "nombre y slug son obligatorios" });
    }

    // Verificar slug único
    const [exist] = await pool.query("SELECT id FROM clinicas WHERE slug=?", [slug]);
    if (exist.length) return res.status(409).json({ ok: false, msg: "El slug ya existe" });

    // Convertir tipo_id a número o null
    const tipoIdFinal = tipo_id && tipo_id !== "" ? parseInt(tipo_id, 10) : null;

    // Insertar clínica
    const [r] = await pool.query(
      `INSERT INTO clinicas (nombre, slug, tipo_id, email, telefono, direccion, ciudad, pais, ruc)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [nombre, slug, tipoIdFinal, email||null, telefono||null, direccion||null, ciudad||null, pais||"PE", ruc||null]
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
    const { nombre, slug, tipo_id, email, telefono, direccion, ciudad, pais, ruc, logo_url, activo } = req.body;

    if (slug) {
      const [exist] = await pool.query("SELECT id FROM clinicas WHERE slug=? AND id!=?", [slug, id]);
      if (exist.length) return res.status(409).json({ ok: false, msg: "El slug ya existe" });
    }

    // Convertir tipo_id a número o null
    const tipoIdFinal = tipo_id !== undefined 
      ? (tipo_id && tipo_id !== "" ? parseInt(tipo_id, 10) : null)
      : -1; // -1 significa "no actualizar"

    await pool.query(
      `UPDATE clinicas SET
         nombre=COALESCE(?,nombre), slug=COALESCE(?,slug),
         tipo_id=IF(?=-1, tipo_id, ?),
         email=COALESCE(?,email),
         telefono=COALESCE(?,telefono), direccion=COALESCE(?,direccion),
         ciudad=COALESCE(?,ciudad), pais=COALESCE(?,pais), ruc=COALESCE(?,ruc),
         logo_url=COALESCE(?,logo_url), activo=COALESCE(?,activo)
       WHERE id=?`,
      [nombre||null, slug||null,
       tipoIdFinal, tipoIdFinal,
       email||null, telefono||null, direccion||null,
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

// DELETE /api/clinicas/:id  → solo SUPER_ADMIN (eliminar permanente o desactivar)
router.delete("/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { permanente } = req.query;
    
    if (permanente === "true") {
      // Eliminación permanente (CASCADE eliminará usuarios, pacientes, citas, etc.)
      await pool.query("DELETE FROM clinicas WHERE id=?", [req.params.id]);
      return res.json({ ok: true, msg: "Clínica eliminada permanentemente" });
    }
    
    // Solo desactivar
    await pool.query("UPDATE clinicas SET activo=0 WHERE id=?", [req.params.id]);
    res.json({ ok: true, msg: "Clínica desactivada" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;

