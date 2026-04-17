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
         WHERE clave IN (?,?,?,?,?,?,?) AND disponible=1 AND ${catFilter}
         ORDER BY orden`,
        ["dashboard","pacientes","citas","consulta","historia_clinica","chat_ia","estudios"]
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
               c.plan_tipo, c.licencia_inicio, c.licencia_fin,
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
             c.plan_tipo, c.licencia_inicio, c.licencia_fin,
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

// ══════════════════════════════════════════════════════════════════════════
//  SOLICITUDES DE LICENCIA  (deben ir ANTES de /:id para no ser capturadas)
// ══════════════════════════════════════════════════════════════════════════

// POST /api/clinicas/solicitar-licencia  → clínica pide activación de plan
router.post("/solicitar-licencia",
  auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  async (req, res) => {
  try {
    const clinica_id = req.user.clinica_id;
    if (!clinica_id) return res.status(400).json({ ok: false, msg: "Sin clínica asociada" });

    const { plan_solicitado, mensaje } = req.body;
    if (!["semestral","anual","trial"].includes(plan_solicitado)) {
      return res.status(400).json({ ok: false, msg: "plan_solicitado inválido" });
    }

    await pool.query(
      `UPDATE solicitudes_licencia SET estado='atendida', atendida_en=NOW()
       WHERE clinica_id=? AND estado='pendiente'`,
      [clinica_id]
    );
    await pool.query(
      `INSERT INTO solicitudes_licencia (clinica_id, plan_solicitado, mensaje) VALUES (?, ?, ?)`,
      [clinica_id, plan_solicitado, mensaje || null]
    );
    res.json({ ok: true, msg: "Solicitud enviada al administrador" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/clinicas/solicitudes-licencia  → SUPER_ADMIN lista solicitudes pendientes
router.get("/solicitudes-licencia", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT sl.id, sl.plan_solicitado, sl.mensaje, sl.estado, sl.creado_en,
             c.id AS clinica_id, c.nombre AS clinica_nombre, c.email AS clinica_email,
             c.plan_tipo AS plan_actual, c.licencia_fin
      FROM solicitudes_licencia sl
      JOIN clinicas c ON c.id = sl.clinica_id
      WHERE sl.estado = 'pendiente'
      ORDER BY sl.creado_en DESC
    `);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/clinicas/solicitudes-licencia/:id/atender
router.put("/solicitudes-licencia/:id/atender", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await pool.query(
      `UPDATE solicitudes_licencia SET estado='atendida', atendida_en=NOW() WHERE id=?`,
      [req.params.id]
    );
    res.json({ ok: true, msg: "Solicitud marcada como atendida" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  GET /api/clinicas/:id/detalles  → estadísticas y consumo de espacio (SUPER_ADMIN)
// ══════════════════════════════════════════════════════════════════════════
router.get("/:id/detalles", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // ── Info base de la clínica ──────────────────────────────
    const [[clinica]] = await pool.query(
      `SELECT c.id, c.nombre, c.slug, c.creado_en, c.activo, c.plan_tipo,
              c.licencia_inicio, c.licencia_fin,
              t.nombre AS tipo_nombre, t.icono AS tipo_icono, t.color AS tipo_color
       FROM clinicas c LEFT JOIN tipos_clinica t ON t.id = c.tipo_id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    // ── Conteos en paralelo ──────────────────────────────────
    const [
      [[{ total_pacientes }]],
      [[{ total_usuarios }]],
      [[{ total_citas }]],
      [[{ fotos_galeria }]],
      [[{ fotos_perfil_pacientes }]],
      [[{ fotos_perfil_usuarios }]],
      [[{ total_documentos }]],
      [[{ ultima_cita }]],
      [top_usuarios],
    ] = await Promise.all([
      // Pacientes registrados
      pool.query(
        "SELECT COUNT(*) AS total_pacientes FROM pacientes WHERE clinica_id = ?",
        [id]
      ),
      // Staff (excluye SUPER_ADMIN)
      pool.query(
        "SELECT COUNT(*) AS total_usuarios FROM usuarios WHERE clinica_id = ? AND tipo != 'SUPER_ADMIN'",
        [id]
      ),
      // Citas totales
      pool.query(
        "SELECT COUNT(*) AS total_citas FROM citas WHERE clinica_id = ?",
        [id]
      ),
      // Fotos de galería antes/después (vía pacientes de esa clínica)
      pool.query(
        `SELECT COUNT(*) AS fotos_galeria
         FROM galeria_fotos gf
         INNER JOIN pacientes p ON p.id = gf.paciente_id
         WHERE p.clinica_id = ?`,
        [id]
      ),
      // Fotos de perfil de pacientes en Cloudinary
      pool.query(
        `SELECT COUNT(*) AS fotos_perfil_pacientes
         FROM pacientes
         WHERE clinica_id = ? AND foto_cloudinary_id IS NOT NULL AND foto_cloudinary_id != ''`,
        [id]
      ),
      // Fotos de perfil de usuarios en Cloudinary
      pool.query(
        `SELECT COUNT(*) AS fotos_perfil_usuarios
         FROM usuarios
         WHERE clinica_id = ?
           AND foto_cloudinary_id IS NOT NULL AND foto_cloudinary_id != ''`,
        [id]
      ).catch(() => [[{ fotos_perfil_usuarios: 0 }]]), // tabla puede no tener esa col aún
      // Documentos adjuntos de pacientes
      pool.query(
        `SELECT COUNT(*) AS total_documentos
         FROM paciente_documentos
         WHERE clinica_id = ?`,
        [id]
      ).catch(() => [[{ total_documentos: 0 }]]),
      // Fecha de la última cita registrada
      pool.query(
        "SELECT MAX(inicio) AS ultima_cita FROM citas WHERE clinica_id = ?",
        [id]
      ),
      // Top 5 usuarios por último acceso
      pool.query(
        `SELECT nombres, apellidos, tipo, ultimo_acceso
         FROM usuarios
         WHERE clinica_id = ? AND activo = 1 AND tipo != 'SUPER_ADMIN'
         ORDER BY ultimo_acceso DESC LIMIT 5`,
        [id]
      ),
    ]);

    // ── Estimación de almacenamiento en nube ─────────────────
    // Pesos promedio (KB): galería ~900, perfil paciente ~350, perfil usuario ~200, doc ~400
    const KB_GALERIA   = 900;
    const KB_PERF_PAC  = 350;
    const KB_PERF_USR  = 200;
    const KB_DOC       = 400;

    const total_archivos_nube =
      Number(fotos_galeria) +
      Number(fotos_perfil_pacientes) +
      Number(fotos_perfil_usuarios) +
      Number(total_documentos);

    const espacio_kb =
      Number(fotos_galeria)          * KB_GALERIA  +
      Number(fotos_perfil_pacientes) * KB_PERF_PAC +
      Number(fotos_perfil_usuarios)  * KB_PERF_USR +
      Number(total_documentos)       * KB_DOC;

    const formatBytes = (kb) => {
      if (kb < 1024)       return `${kb.toFixed(0)} KB`;
      if (kb < 1048576)    return `${(kb / 1024).toFixed(2)} MB`;
      return                      `${(kb / 1048576).toFixed(2)} GB`;
    };

    res.json({
      ok: true,
      data: {
        clinica,
        conteos: {
          total_pacientes:        Number(total_pacientes),
          total_usuarios:         Number(total_usuarios),
          total_citas:            Number(total_citas),
          fotos_galeria:          Number(fotos_galeria),
          fotos_perfil_pacientes: Number(fotos_perfil_pacientes),
          fotos_perfil_usuarios:  Number(fotos_perfil_usuarios),
          total_documentos:       Number(total_documentos),
          total_archivos_nube,
        },
        almacenamiento: {
          espacio_kb,
          espacio_legible:  formatBytes(espacio_kb),
          desglose: {
            galeria_fotos:    { cantidad: Number(fotos_galeria),          kb: Number(fotos_galeria) * KB_GALERIA },
            perfil_pacientes: { cantidad: Number(fotos_perfil_pacientes), kb: Number(fotos_perfil_pacientes) * KB_PERF_PAC },
            perfil_usuarios:  { cantidad: Number(fotos_perfil_usuarios),  kb: Number(fotos_perfil_usuarios)  * KB_PERF_USR },
            documentos:       { cantidad: Number(total_documentos),       kb: Number(total_documentos) * KB_DOC },
          },
        },
        ultima_cita:  ultima_cita || null,
        top_usuarios: top_usuarios || [],
      },
    });
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

    // Insertar clínica con trial automático de 14 días
    const [r] = await pool.query(
      `INSERT INTO clinicas (nombre, slug, tipo_id, es_pediatrica, email, telefono, direccion, ciudad, pais, ruc, plan_tipo, licencia_inicio, licencia_fin)
       VALUES (?,?,?,?,?,?,?,?,?,?, 'trial', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY))`,
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
//  LICENCIAS
// ══════════════════════════════════════════════════════════════════════════

// GET /api/clinicas/:id/licencia  → info de licencia de una clínica
router.get("/:id/licencia", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT plan_tipo, licencia_inicio, licencia_fin FROM clinicas WHERE id=? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const { plan_tipo, licencia_inicio, licencia_fin } = rows[0];
    const fin   = licencia_fin ? new Date(licencia_fin) : null;
    const ahora = new Date();
    const dias  = fin ? Math.ceil((fin - ahora) / 86400000) : null;

    // Historial
    const [historial] = await pool.query(
      `SELECT lh.plan_tipo, lh.inicio, lh.fin, lh.notas, lh.creado_en,
              u.nombres, u.apellidos
       FROM licencias_historial lh
       LEFT JOIN usuarios u ON u.id = lh.superadmin_id
       WHERE lh.clinica_id=?
       ORDER BY lh.creado_en DESC
       LIMIT 10`,
      [req.params.id]
    );

    res.json({
      ok: true,
      data: {
        plan_tipo:       plan_tipo || "trial",
        licencia_inicio: licencia_inicio || null,
        licencia_fin:    licencia_fin    || null,
        dias_restantes:  dias,
        vencida:         fin ? fin < ahora : false,
        historial,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/clinicas/:id/licencia  → asignar o renovar licencia (SUPER_ADMIN)
router.post("/:id/licencia", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { plan_tipo, inicio_manual, notas } = req.body;

    if (!["trial","semestral","anual"].includes(plan_tipo)) {
      return res.status(400).json({ ok: false, msg: "plan_tipo inválido. Use: trial, semestral, anual" });
    }

    // Calcular fechas
    const inicio = inicio_manual ? new Date(inicio_manual) : new Date();
    const fin    = new Date(inicio);
    if      (plan_tipo === "trial")     fin.setDate(fin.getDate() + 14);
    else if (plan_tipo === "semestral") fin.setMonth(fin.getMonth() + 6);
    else if (plan_tipo === "anual")     fin.setFullYear(fin.getFullYear() + 1);

    // Actualizar clínica
    await pool.query(
      `UPDATE clinicas SET plan_tipo=?, licencia_inicio=?, licencia_fin=?, activo=1 WHERE id=?`,
      [plan_tipo, inicio, fin, req.params.id]
    );

    // Registrar en historial
    await pool.query(
      `INSERT INTO licencias_historial (clinica_id, plan_tipo, inicio, fin, superadmin_id, notas)
       VALUES (?,?,?,?,?,?)`,
      [req.params.id, plan_tipo, inicio, fin, req.user.id, notas || null]
    );

    res.json({
      ok: true,
      data: {
        plan_tipo,
        licencia_inicio: inicio,
        licencia_fin:    fin,
        dias_restantes:  Math.ceil((fin - new Date()) / 86400000),
      },
    });
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

