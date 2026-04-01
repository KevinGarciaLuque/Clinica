const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const argon2 = require("argon2");
const { uploadClinicas } = require("../middlewares/upload");

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

    // Obtener flag pediátrica de la clínica
    const [clinRow] = await pool.query("SELECT es_pediatrica FROM clinicas WHERE id=?", [req.user.clinica_id]);
    const esPed = clinRow.length ? clinRow[0].es_pediatrica : 0;
    const catFilter = esPed ? "ms.para_pediatrica = 1" : "ms.para_normal = 1";

    // Para usuarios de clínica: módulos según el tipo de su clínica + categoría
    const [rows] = await pool.query(`
      SELECT ms.clave, ms.nombre, ms.icono, ms.ruta
      FROM modulos_sistema ms
      INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id
      INNER JOIN clinicas c ON c.tipo_id = tcm.tipo_id
      WHERE c.id = ? AND ms.disponible = 1 AND ${catFilter}
      ORDER BY ms.orden
    `, [req.user.clinica_id]);

    // Si la clínica no tiene tipo asignado, devolver módulos base filtrados
    if (!rows.length) {
      const [base] = await pool.query(
        `SELECT clave, nombre, icono, ruta FROM modulos_sistema
         WHERE clave IN (?,?,?,?,?,?) AND disponible=1 AND ${catFilter}
         ORDER BY orden`,
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
//  GET /api/clinicas/modulos/configuracion  → todos los módulos con flags (SUPER_ADMIN)
// ──────────────────────────────────────────────
router.get("/modulos/configuracion", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica
       FROM modulos_sistema ORDER BY orden`
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  PUT /api/clinicas/modulos/:id/configuracion  → toggle flags (SUPER_ADMIN)
// ──────────────────────────────────────────────
router.put("/modulos/:id/configuracion", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { para_normal, para_pediatrica } = req.body;
    const sets = [];
    const vals = [];
    if (para_normal !== undefined)     { sets.push("para_normal=?");     vals.push(para_normal ? 1 : 0); }
    if (para_pediatrica !== undefined) { sets.push("para_pediatrica=?"); vals.push(para_pediatrica ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ ok: false, msg: "Nada que actualizar" });
    vals.push(req.params.id);
    await pool.query(`UPDATE modulos_sistema SET ${sets.join(",")} WHERE id=?`, vals);
    res.json({ ok: true });
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
        SELECT c.id, c.nombre, c.slug, c.tipo_id, c.es_pediatrica, c.logo_url, c.email, c.telefono,
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
      SELECT c.id, c.nombre, c.slug, c.tipo_id, c.es_pediatrica, c.logo_url, c.email, c.telefono,
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
router.get("/:id", auth("SUPER_ADMIN","ADMIN","MEDICO"), async (req, res) => {
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
    const { nombre, slug, tipo_id, es_pediatrica, email, telefono, direccion, ciudad, pais, ruc,
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
      `INSERT INTO clinicas (nombre, slug, tipo_id, es_pediatrica, email, telefono, direccion, ciudad, pais, ruc)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [nombre, slug, tipoIdFinal, es_pediatrica ? 1 : 0, email||null, telefono||null, direccion||null, ciudad||null, pais||"PE", ruc||null]
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

// PUT /api/clinicas/:id  → SUPER_ADMIN, ADMIN o MEDICO de esa clínica
router.put("/:id", auth("SUPER_ADMIN","ADMIN","MEDICO"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { nombre, slug, tipo_id, es_pediatrica, email, telefono, direccion, ciudad, pais, ruc, logo_url, activo } = req.body;

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
         es_pediatrica=COALESCE(?,es_pediatrica),
         email=COALESCE(?,email),
         telefono=COALESCE(?,telefono), direccion=COALESCE(?,direccion),
         ciudad=COALESCE(?,ciudad), pais=COALESCE(?,pais), ruc=COALESCE(?,ruc),
         logo_url=COALESCE(?,logo_url), activo=COALESCE(?,activo)
       WHERE id=?`,
      [nombre||null, slug||null,
       tipoIdFinal, tipoIdFinal,
       es_pediatrica !== undefined ? (es_pediatrica ? 1 : 0) : null,
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
router.put("/:id/config", auth("SUPER_ADMIN","ADMIN","MEDICO"), async (req, res) => {
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

// ══════════════════════════════════════════════════════════════════════════
//  PLANTILLAS DE DOCUMENTOS (recetas, laboratorio, estudios, informes)
// ══════════════════════════════════════════════════════════════════════════

// GET /api/clinicas/:id/plantillas  → obtener todas las plantillas de la clínica
router.get("/:id/plantillas", auth("SUPER_ADMIN","ADMIN","MEDICO"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const [rows] = await pool.query(
      `SELECT id, tipo, nombre, contenido, activo 
       FROM plantillas_documentos 
       WHERE clinica_id=? 
       ORDER BY tipo, nombre`,
      [id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/clinicas/:id/plantillas/:tipo  → obtener plantilla por tipo
router.get("/:id/plantillas/:tipo", auth("SUPER_ADMIN","ADMIN","MEDICO"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { tipo } = req.params;
    const [rows] = await pool.query(
      `SELECT id, tipo, nombre, contenido, activo 
       FROM plantillas_documentos 
       WHERE clinica_id=? AND tipo=? AND activo=1 
       LIMIT 1`,
      [id, tipo]
    );
    res.json({ ok: true, data: rows[0] || null });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/clinicas/:id/plantillas  → crear/actualizar plantilla
router.post("/:id/plantillas", auth("SUPER_ADMIN","ADMIN","MEDICO"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { tipo, nombre, contenido } = req.body;

    if (!tipo || !nombre) {
      return res.status(400).json({ ok: false, msg: "tipo y nombre son obligatorios" });
    }

    // Verificar si ya existe plantilla de ese tipo
    const [exist] = await pool.query(
      "SELECT id FROM plantillas_documentos WHERE clinica_id=? AND tipo=?",
      [id, tipo]
    );

    if (exist.length) {
      // Actualizar
      await pool.query(
        `UPDATE plantillas_documentos 
         SET nombre=?, contenido=?, activo=1 
         WHERE clinica_id=? AND tipo=?`,
        [nombre, contenido || "", id, tipo]
      );
      res.json({ ok: true, msg: "Plantilla actualizada" });
    } else {
      // Crear nueva
      await pool.query(
        `INSERT INTO plantillas_documentos (clinica_id, tipo, nombre, contenido) 
         VALUES (?,?,?,?)`,
        [id, tipo, nombre, contenido || ""]
      );
      res.json({ ok: true, msg: "Plantilla creada" });
    }
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// DELETE /api/clinicas/:id/plantillas/:tipo  → eliminar plantilla
router.delete("/:id/plantillas/:tipo", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { tipo } = req.params;
    
    await pool.query(
      "DELETE FROM plantillas_documentos WHERE clinica_id=? AND tipo=?",
      [id, tipo]
    );
    res.json({ ok: true, msg: "Plantilla eliminada" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  UPLOAD DE LOGO
// ══════════════════════════════════════════════════════════════════════════

// POST /api/clinicas/:id/upload-logo  → subir logo de la clínica
router.post("/:id/upload-logo", auth("SUPER_ADMIN","ADMIN","MEDICO"), uploadClinicas.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, msg: "No se recibió ningún archivo" });
    }

    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const logoUrl = `/uploads/clinicas/${req.file.filename}`;

    // Actualizar logo_url en la base de datos
    await pool.query(
      "UPDATE clinicas SET logo_url=? WHERE id=?",
      [logoUrl, id]
    );

    res.json({ 
      ok: true, 
      logo_url: logoUrl,
      msg: "Logo subido correctamente" 
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;

