const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const argon2 = require("argon2");
const crypto = require("crypto");
const { seedPacienteDemo } = require("../utils/seedPacienteDemo");
const cloudinary  = require("../utils/cloudinary");
const multer      = require("multer");
const streamifier = require("streamifier");
const fs          = require("fs");
const path        = require("path");
const { enviarEmail, templateCredenciales } = require("../utils/mailer");

function generarPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

const USE_CLOUDINARY = !!(process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL);

const uploadFotoDoctor = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg","image/png","image/webp"].includes(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error("Solo JPG, PNG o WEBP"), { code: "WRONG_TYPE" }));
  },
});

let moduloPermisosSchemaReady = false;

// Garantiza que exista clinicas.titulo_medico (migración 066). Se auto-aplica en
// caliente la primera vez que se necesita, para no depender de correr la migración
// manualmente en cada entorno. Mismo patrón que ensureModuloPermisosSchema.
let tituloMedicoColReady = false;
async function ensureTituloMedicoColumn() {
  if (tituloMedicoColReady) return;
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM clinicas LIKE 'titulo_medico'");
    if (!cols.length) {
      await pool.query(
        "ALTER TABLE clinicas ADD COLUMN titulo_medico TINYINT(1) NOT NULL DEFAULT 1"
      );
    }
    tituloMedicoColReady = true;
  } catch (e) {
    // Si falla el ALTER (permisos, carrera), no marcamos ready para reintentar luego.
    console.error("ensureTituloMedicoColumn:", e.message);
  }
}
const DEFAULT_STORAGE_QUOTA_GB = 25;
const DEFAULT_STORAGE_PRICE_PER_GB_LPS = 120;

function getQuotaFromConfigRows(configRows = []) {
  const raw = configRows.find((r) => r.clave === "storage_quota_gb")?.valor;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_STORAGE_QUOTA_GB;
  return Math.round(num * 100) / 100;
}

function getPricePerGbFromConfigRows(configRows = []) {
  const raw = configRows.find((r) => r.clave === "storage_price_per_gb_lps")?.valor;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return DEFAULT_STORAGE_PRICE_PER_GB_LPS;
  return Math.round(num * 100) / 100;
}

async function ensureModuloPermisosSchema() {
  if (moduloPermisosSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinica_modulos (
      clinica_id INT UNSIGNED NOT NULL,
      modulo_id INT UNSIGNED NOT NULL,
      habilitado TINYINT(1) NOT NULL DEFAULT 1,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (clinica_id, modulo_id)
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario_modulos (
      usuario_id INT UNSIGNED NOT NULL,
      modulo_id INT UNSIGNED NOT NULL,
      habilitado TINYINT(1) NOT NULL,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (usuario_id, modulo_id)
    ) ENGINE=InnoDB
  `);
  moduloPermisosSchemaReady = true;
}

async function aplicarPresetModulosClinica(clinicaId, tipoId, esPediatrica) {
  const [[tipo]] = await pool.query("SELECT clave FROM tipos_clinica WHERE id=? LIMIT 1", [tipoId || null]);
  const tipoClave = String(tipo?.clave || "").toLowerCase();
  const esDerma  = tipoClave.includes("derma") || tipoClave.includes("estetica");
  const esPedia  = Boolean(esPediatrica) || tipoClave.includes("pedi");
  const esPsico  = tipoClave.includes("psico");
  const esDental = tipoClave.includes("dental") || tipoClave.includes("odonto");
  const esEndo   = tipoClave.includes("endocrino");

  const [mods] = await pool.query("SELECT id, clave FROM modulos_sistema WHERE disponible=1");
  const base  = ["dashboard", "pacientes", "citas", "plantillas"];
  const derma = ["consulta", "historia_clinica", "estudios", "ficha_estetica", "galeria_estetica", "presupuestos", "consentimientos_esteticos", "seguimiento_postop", "biopsias_patologia", "recordatorios"];
  const pedia = ["consulta", "historia_clinica", "estudios", "curva_crecimiento", "vacunas"];
  const psico = ["consulta_psicologica"];
  const dental = ["consulta_odontologica", "historia_clinica", "estudios", "inventario", "recordatorios"];
  const endocrino = ["consulta", "historia_clinica", "estudios", "control_seguimiento_dm1", "educacion_diabetes", "recordatorios"];
  const generalExtras = ["consulta", "historia_clinica", "estudios", "inventario"];

  const enabled = new Set(base);
  if (esDerma)       derma.forEach((k) => enabled.add(k));
  else if (esPedia)  pedia.forEach((k) => enabled.add(k));
  else if (esPsico)  psico.forEach((k) => enabled.add(k));
  else if (esDental) dental.forEach((k) => enabled.add(k));
  else if (esEndo)   endocrino.forEach((k) => enabled.add(k));
  else               generalExtras.forEach((k) => enabled.add(k));

  for (const m of mods) {
    await pool.query(
      `INSERT INTO clinica_modulos (clinica_id, modulo_id, habilitado)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE habilitado = VALUES(habilitado)`,
      [clinicaId, m.id, enabled.has(m.clave) ? 1 : 0]
    );
  }
}

// ──────────────────────────────────────────────
//  GET /api/clinicas/tipos  → catálogo de tipos de clínica
// ──────────────────────────────────────────────
router.get("/tipos", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
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
router.get("/modulos", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    await ensureModuloPermisosSchema();
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
    const catFilter     = esPed ? "ms.para_pediatrica = 1" : "ms.para_normal = 1";
    const catFilterBase = esPed ? "para_pediatrica = 1"    : "para_normal = 1";

    // Para usuarios de clínica: módulos según el tipo de su clínica + categoría
    const [rows] = await pool.query(`
      SELECT ms.clave, ms.nombre, ms.icono, ms.ruta, ms.orden
      FROM modulos_sistema ms
      INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id
      INNER JOIN clinicas c ON c.tipo_id = tcm.tipo_id
      WHERE c.id = ? AND ms.disponible = 1 AND ${catFilter}
      ORDER BY ms.orden
    `, [req.user.clinica_id]);

    // helper: garantiza curva_crecimiento en clínicas pediátricas
    // (por si el tipo fue creado después de la migración 015 y no tiene el módulo asignado)
    const agregarCurvaSiPed = async (lista) => {
      if (!esPed || lista.some(r => r.clave === "curva_crecimiento")) return lista;
      const [[curva]] = await pool.query(
        "SELECT clave, nombre, icono, ruta, orden FROM modulos_sistema WHERE clave='curva_crecimiento' AND disponible=1 LIMIT 1"
      );
      if (!curva) return lista;
      const resultado = [...lista, curva];
      resultado.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
      return resultado;
    };

    // Si la clínica no tiene tipo asignado, devolver módulos base filtrados
    if (!rows.length) {
      const [base] = await pool.query(
        `SELECT clave, nombre, icono, ruta, orden FROM modulos_sistema
         WHERE clave IN (?,?,?,?,?,?,?) AND disponible=1 AND ${catFilterBase}
         ORDER BY orden`,
        ["dashboard","pacientes","citas","consulta","historia_clinica","chat_ia","estudios"]
      );
      return res.json({ ok: true, data: await agregarCurvaSiPed(base) });
    }

    const baseRows = await agregarCurvaSiPed(rows);

    // Aplicar override por clínica y por usuario
    const [overrides] = await pool.query(
      `
      SELECT
        ms.clave,
        cm.habilitado AS habilitado_clinica,
        um.habilitado AS habilitado_usuario
      FROM modulos_sistema ms
      LEFT JOIN clinica_modulos cm
        ON cm.clinica_id = ? AND cm.modulo_id = ms.id
      LEFT JOIN usuario_modulos um
        ON um.usuario_id = ? AND um.modulo_id = ms.id
      `,
      [req.user.clinica_id, req.user.id]
    );
    const mapOverride = new Map(overrides.map(o => [o.clave, o]));

    const efectivos = baseRows.filter((m) => {
      const o = mapOverride.get(m.clave);
      if (!o) return true;
      if (o.habilitado_usuario !== null && o.habilitado_usuario !== undefined) {
        return Number(o.habilitado_usuario) === 1;
      }
      if (o.habilitado_clinica !== null && o.habilitado_clinica !== undefined) {
        return Number(o.habilitado_clinica) === 1;
      }
      return true;
    });

    res.json({ ok: true, data: efectivos });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/clinicas/tiene-recepcionista
// Indica si la clínica del usuario tiene al menos un RECEPCIONISTA activo,
// para que el frontend muestre u oculte el flujo de "enviar a recepción".
router.get("/tiene-recepcionista", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.json({ ok: true, data: false });
    const [[row]] = await pool.query(
      "SELECT COUNT(*) AS total FROM usuarios WHERE clinica_id=? AND tipo='RECEPCIONISTA' AND activo=1",
      [clinicaId]
    );
    res.json({ ok: true, data: row.total > 0 });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/clinicas/preferencias
// Preferencias de presentación de la clínica del usuario (se cargan tras login).
// titulo_medico: 1 = mostrar "Dr./Dra." + especialidad junto al nombre del médico;
//                0 = mostrar solo "Nombre Apellido".
router.get("/preferencias", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    await ensureTituloMedicoColumn();
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.json({ ok: true, data: { titulo_medico: 1 } });
    const [[row]] = await pool.query(
      "SELECT titulo_medico FROM clinicas WHERE id=?",
      [clinicaId]
    );
    res.json({ ok: true, data: { titulo_medico: row ? Number(row.titulo_medico) : 1 } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/clinicas/:id/modulos-permisos
router.get("/:id/modulos-permisos", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureModuloPermisosSchema();
    const clinicaId = Number(req.params.id);
    const [[clinica]] = await pool.query(
      "SELECT id, nombre, tipo_id, es_pediatrica FROM clinicas WHERE id=? LIMIT 1",
      [clinicaId]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const [modulos] = await pool.query(
      `
      SELECT
        ms.id, ms.clave, ms.nombre, ms.icono, ms.ruta, ms.orden,
        IFNULL(cm.habilitado, 1) AS habilitado_clinica
      FROM modulos_sistema ms
      INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id AND tcm.tipo_id = ?
      LEFT JOIN clinica_modulos cm ON cm.clinica_id = ? AND cm.modulo_id = ms.id
      WHERE ms.disponible = 1
        AND (? = 1 AND ms.para_pediatrica = 1 OR ? = 0 AND ms.para_normal = 1)
      ORDER BY ms.orden
      `,
      [clinica.tipo_id, clinicaId, clinica.es_pediatrica ? 1 : 0, clinica.es_pediatrica ? 1 : 0]
    );

    // Fallback: curva_crecimiento se sirve al sidebar en clínicas pediátricas aunque
    // el tipo de clínica no la tenga asignada en tipo_clinica_modulos (ver GET /modulos).
    // La incluimos aquí también para que sea visible y se pueda desactivar.
    if (clinica.es_pediatrica && !modulos.some(m => m.clave === "curva_crecimiento")) {
      const [[curva]] = await pool.query(
        `SELECT ms.id, ms.clave, ms.nombre, ms.icono, ms.ruta, ms.orden,
                IFNULL(cm.habilitado, 1) AS habilitado_clinica
         FROM modulos_sistema ms
         LEFT JOIN clinica_modulos cm ON cm.clinica_id=? AND cm.modulo_id=ms.id
         WHERE ms.clave='curva_crecimiento' AND ms.disponible=1 LIMIT 1`,
        [clinicaId]
      );
      if (curva) {
        modulos.push(curva);
        modulos.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
      }
    }

    const [usuarios] = await pool.query(
      `
      SELECT u.id, u.nombres, u.apellidos, u.tipo, u.email
      FROM usuarios u
      WHERE u.clinica_id = ? AND u.activo = 1 AND u.tipo IN ('ADMIN','MEDICO','PSICOLOGO','ENFERMERA','RECEPCIONISTA')
      ORDER BY u.tipo, u.apellidos, u.nombres
      `,
      [clinicaId]
    );

    res.json({ ok: true, data: { clinica, modulos, usuarios } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/clinicas/:id/modulos-permisos/clinica
router.put("/:id/modulos-permisos/clinica", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureModuloPermisosSchema();
    const clinicaId = Number(req.params.id);
    const { modulo_id, habilitado } = req.body || {};
    if (!modulo_id || habilitado === undefined) {
      return res.status(400).json({ ok: false, msg: "modulo_id y habilitado son obligatorios" });
    }
    await pool.query(
      `
      INSERT INTO clinica_modulos (clinica_id, modulo_id, habilitado)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE habilitado = VALUES(habilitado)
      `,
      [clinicaId, modulo_id, habilitado ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/clinicas/:id/modulos-permisos/usuario/:usuarioId
router.get("/:id/modulos-permisos/usuario/:usuarioId", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureModuloPermisosSchema();
    const clinicaId = Number(req.params.id);
    const usuarioId = Number(req.params.usuarioId);

    const [[usuario]] = await pool.query(
      "SELECT id, clinica_id, nombres, apellidos, tipo FROM usuarios WHERE id=? LIMIT 1",
      [usuarioId]
    );
    if (!usuario || Number(usuario.clinica_id) !== clinicaId) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado en esta clínica" });
    }

    const [[clinica]] = await pool.query(
      "SELECT tipo_id, es_pediatrica FROM clinicas WHERE id=? LIMIT 1",
      [clinicaId]
    );

    const [rows] = await pool.query(
      `
      SELECT
        ms.id AS modulo_id,
        ms.clave,
        ms.nombre,
        IFNULL(cm.habilitado, 1) AS habilitado_clinica,
        um.habilitado AS habilitado_usuario
      FROM modulos_sistema ms
      INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id AND tcm.tipo_id = ?
      LEFT JOIN clinica_modulos cm ON cm.clinica_id = ? AND cm.modulo_id = ms.id
      LEFT JOIN usuario_modulos um ON um.usuario_id = ? AND um.modulo_id = ms.id
      WHERE ms.disponible = 1
        AND (? = 1 AND ms.para_pediatrica = 1 OR ? = 0 AND ms.para_normal = 1)
      ORDER BY ms.orden
      `,
      [clinica.tipo_id, clinicaId, usuarioId, clinica.es_pediatrica ? 1 : 0, clinica.es_pediatrica ? 1 : 0]
    );

    // Mismo fallback que en /modulos-permisos: curva_crecimiento puede llegar al
    // sidebar aunque el tipo de clínica no la tenga asignada; la exponemos aquí
    // también para poder desactivarla por usuario.
    if (clinica.es_pediatrica && !rows.some(m => m.clave === "curva_crecimiento")) {
      const [[curva]] = await pool.query(
        `SELECT ms.id AS modulo_id, ms.clave, ms.nombre,
                IFNULL(cm.habilitado, 1) AS habilitado_clinica,
                um.habilitado AS habilitado_usuario
         FROM modulos_sistema ms
         LEFT JOIN clinica_modulos cm ON cm.clinica_id=? AND cm.modulo_id=ms.id
         LEFT JOIN usuario_modulos um ON um.usuario_id=? AND um.modulo_id=ms.id
         WHERE ms.clave='curva_crecimiento' AND ms.disponible=1 LIMIT 1`,
        [clinicaId, usuarioId]
      );
      if (curva) rows.push(curva);
    }

    res.json({ ok: true, data: { usuario, modulos: rows } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/clinicas/:id/modulos-permisos/usuario/:usuarioId
router.put("/:id/modulos-permisos/usuario/:usuarioId", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureModuloPermisosSchema();
    const clinicaId = Number(req.params.id);
    const usuarioId = Number(req.params.usuarioId);
    const { modulo_id, habilitado } = req.body || {};
    if (!modulo_id || habilitado === undefined) {
      return res.status(400).json({ ok: false, msg: "modulo_id y habilitado son obligatorios" });
    }

    const [[usuario]] = await pool.query(
      "SELECT id, clinica_id FROM usuarios WHERE id=? LIMIT 1",
      [usuarioId]
    );
    if (!usuario || Number(usuario.clinica_id) !== clinicaId) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado en esta clínica" });
    }

    await pool.query(
      `
      INSERT INTO usuario_modulos (usuario_id, modulo_id, habilitado)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE habilitado = VALUES(habilitado)
      `,
      [usuarioId, modulo_id, habilitado ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/clinicas/:id/modulos-permisos/reaplicar-preset
router.post("/:id/modulos-permisos/reaplicar-preset", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureModuloPermisosSchema();
    const clinicaId = Number(req.params.id);
    const [[clinica]] = await pool.query(
      "SELECT id, tipo_id, es_pediatrica FROM clinicas WHERE id=? LIMIT 1",
      [clinicaId]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    await aplicarPresetModulosClinica(clinicaId, clinica.tipo_id, clinica.es_pediatrica ? 1 : 0);
    res.json({ ok: true, msg: "Preset reaplicado correctamente" });
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
router.get("/", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    if (req.user.super) {
      const [rows] = await pool.query(`
        SELECT c.id, c.nombre, c.slug, c.tipo_id, c.es_pediatrica, c.logo_url, c.email, c.telefono,
               c.direccion, c.ciudad, c.pais, c.ruc, c.activo, c.bloqueada, c.creado_en,
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
             c.direccion, c.ciudad, c.pais, c.ruc, c.activo, c.bloqueada, c.creado_en,
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
  auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
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
router.get("/:id/detalles", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.user.super && Number(req.user.clinica_id) !== id) {
      return res.status(403).json({ ok: false, msg: "No autorizado para ver esta clínica" });
    }

    // ── Info base de la clínica ──────────────────────────────
    const [[clinica]] = await pool.query(
      `SELECT c.id, c.nombre, c.slug, c.creado_en, c.activo, c.plan_tipo,
              c.licencia_inicio, c.licencia_fin, c.es_pediatrica,
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
      [cfgStorage],
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
      pool.query(
        "SELECT clave, valor FROM clinica_config WHERE clinica_id = ? AND clave IN ('storage_quota_gb','storage_price_per_gb_lps')",
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
    const cuota_gb = getQuotaFromConfigRows(cfgStorage);
    const precio_por_gb_lps = getPricePerGbFromConfigRows(cfgStorage);
    const cuota_kb = cuota_gb * 1024 * 1024;
    const uso_pct = cuota_kb > 0 ? Math.min((espacio_kb / cuota_kb) * 100, 999.99) : 0;

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
          cuota_gb,
          cuota_kb,
          cuota_legible: formatBytes(cuota_kb),
          uso_pct: Number(uso_pct.toFixed(2)),
          precio_por_gb_lps,
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

// PUT /api/clinicas/:id/storage-pricing -> define precio por GB para ampliaciones
router.put("/:id/storage-pricing", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const precio = Number(req.body?.storage_price_per_gb_lps);
    if (!Number.isFinite(precio) || precio < 0 || precio > 100000) {
      return res.status(400).json({ ok: false, msg: "storage_price_per_gb_lps debe ser un número entre 0 y 100000" });
    }
    const normalized = Math.round(precio * 100) / 100;
    await pool.query(
      `INSERT INTO clinica_config (clinica_id, clave, valor)
       VALUES (?, 'storage_price_per_gb_lps', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [id, String(normalized)]
    );
    res.json({ ok: true, data: { storage_price_per_gb_lps: normalized } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/clinicas/:id/storage-quota  -> define cuota de almacenamiento por clínica (GB)
router.put("/:id/storage-quota", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const gb = Number(req.body?.storage_quota_gb);
    if (!Number.isFinite(gb) || gb <= 0 || gb > 5000) {
      return res.status(400).json({ ok: false, msg: "storage_quota_gb debe ser un número entre 0.01 y 5000" });
    }
    const normalized = Math.round(gb * 100) / 100;
    await pool.query(
      `INSERT INTO clinica_config (clinica_id, clave, valor)
       VALUES (?, 'storage_quota_gb', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [id, String(normalized)]
    );
    res.json({ ok: true, data: { storage_quota_gb: normalized } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/clinicas/:id
router.get("/:id", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), async (req, res) => {
  try {
    await ensureTituloMedicoColumn();
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const [rows] = await pool.query(
      "SELECT id, nombre, slug, tipo_id, logo_url, email, telefono, direccion, ciudad, pais, ruc, datos_fiscales, activo, timezone, titulo_medico FROM clinicas WHERE id=?",
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

// POST /api/clinicas/:id/reenviar-credenciales  (SUPER_ADMIN)
// Genera una contraseña nueva para el admin de la clínica y se la reenvía por correo.
router.post("/:id/reenviar-credenciales", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.params.id;

    const [[clinica]] = await pool.query(
      "SELECT id, nombre FROM clinicas WHERE id=? LIMIT 1",
      [clinicaId]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const [[admin]] = await pool.query(
      `SELECT id, nombres, apellidos, email FROM usuarios
       WHERE clinica_id=? AND tipo='ADMIN' ORDER BY id ASC LIMIT 1`,
      [clinicaId]
    );
    if (!admin || !admin.email) {
      return res.status(409).json({ ok: false, msg: "Esta clínica no tiene un usuario administrador con correo registrado" });
    }

    const password = generarPassword();
    const hash = await argon2.hash(password);
    await pool.query("UPDATE usuarios SET password_hash=? WHERE id=?", [hash, admin.id]);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    await enviarEmail({
      to: admin.email,
      subject: "🔑 Tus credenciales de acceso",
      html: templateCredenciales({
        nombres: `${admin.nombres} ${admin.apellidos}`,
        email: admin.email,
        password,
        loginUrl: `${frontendUrl}/login`,
        clinicaNombre: clinica.nombre,
      }),
    });

    res.json({ ok: true, msg: "Credenciales reenviadas" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/clinicas  → solo SUPER_ADMIN puede crear clínicas
router.post("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureModuloPermisosSchema();
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

    await aplicarPresetModulosClinica(clinicaId, tipoIdFinal, es_pediatrica ? 1 : 0);

    // Crear admin de la clínica si viene en el body
    let adminId = null;
    if (admin_email && admin_password) {
      const hash = await argon2.hash(admin_password);
      const [uRes] = await pool.query(
        `INSERT INTO usuarios (clinica_id, nombres, apellidos, email, password_hash, tipo)
         VALUES (?,?,?,?,?,?)`,
        [clinicaId, admin_nombres||"Admin", admin_apellidos||"Clínica",
         admin_email, hash, "ADMIN"]
      );
      adminId = uRes.insertId;
    }

    // Paciente demo (fire-and-forget, no bloquea la respuesta)
    const medicoIdParaDemo = adminId || req.user.id;
    setImmediate(() => {
      seedPacienteDemo(pool, clinicaId, medicoIdParaDemo, es_pediatrica ? true : false)
        .catch(err => console.error("[seedPacienteDemo] Error inesperado:", err.message));
    });

    res.status(201).json({ ok: true, id: clinicaId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/clinicas/:id  → SUPER_ADMIN, ADMIN o MEDICO de esa clínica
router.put("/:id", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), async (req, res) => {
  try {
    await ensureTituloMedicoColumn();
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { nombre, slug, tipo_id, es_pediatrica, email, telefono, direccion, ciudad, pais, ruc, logo_url, activo, timezone, titulo_medico } = req.body;

    if (req.user.super) {
      const [[cl]] = await pool.query("SELECT bloqueada FROM clinicas WHERE id=? LIMIT 1", [id]);
      if (cl && cl.bloqueada) {
        return res.status(409).json({ ok: false, msg: "Clínica protegida con candado. Desbloquéala para editarla." });
      }
    }

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
         logo_url=COALESCE(?,logo_url), activo=COALESCE(?,activo),
         timezone=COALESCE(?,timezone),
         titulo_medico=COALESCE(?,titulo_medico)
       WHERE id=?`,
      [nombre||null, slug||null,
       tipoIdFinal, tipoIdFinal,
       es_pediatrica !== undefined ? (es_pediatrica ? 1 : 0) : null,
       email||null, telefono||null, direccion||null,
       ciudad||null, pais||null, ruc||null, logo_url||null,
       activo !== undefined ? activo : null, timezone||null,
       titulo_medico !== undefined ? (titulo_medico ? 1 : 0) : null, id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/clinicas/:id/config  → guardar pares clave-valor de config
router.put("/:id/config", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), async (req, res) => {
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

    const [[cl]] = await pool.query("SELECT bloqueada FROM clinicas WHERE id=? LIMIT 1", [req.params.id]);
    if (cl && cl.bloqueada) {
      return res.status(409).json({ ok: false, msg: "Clínica protegida con candado. Desbloquéala antes de eliminar o desactivar." });
    }

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

// PUT /api/clinicas/:id/bloqueo  → candado de protección (solo SUPER_ADMIN)
router.put("/:id/bloqueo", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const bloqueada = req.body.bloqueada ? 1 : 0;
    await pool.query("UPDATE clinicas SET bloqueada=? WHERE id=?", [bloqueada, req.params.id]);
    res.json({ ok: true, bloqueada });
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

    const [[clBloq]] = await pool.query("SELECT bloqueada FROM clinicas WHERE id=? LIMIT 1", [req.params.id]);
    if (clBloq && clBloq.bloqueada) {
      return res.status(409).json({ ok: false, msg: "Clínica protegida con candado. Desbloquéala para gestionar su licencia." });
    }

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

async function ensurePlantillasPredeterminadaColumn() {
  const [col] = await pool.query(
    "SHOW COLUMNS FROM plantillas_documentos LIKE 'es_predeterminada'"
  );
  if (!col.length) {
    await pool.query(
      "ALTER TABLE plantillas_documentos ADD COLUMN es_predeterminada TINYINT(1) DEFAULT 0 AFTER activo"
    );
  }
}

// GET /api/clinicas/:id/plantillas  → obtener todas las plantillas de la clínica
router.get("/:id/plantillas", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    await ensurePlantillasPredeterminadaColumn();
    const [rows] = await pool.query(
      `SELECT id, tipo, nombre, contenido, activo, es_predeterminada
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
router.get("/:id/plantillas/:tipo", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { tipo } = req.params;
    await ensurePlantillasPredeterminadaColumn();
    const [rows] = await pool.query(
      `SELECT id, tipo, nombre, contenido, activo, es_predeterminada
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
router.post("/:id/plantillas", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), async (req, res) => {
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

// POST /api/clinicas/:id/plantillas/predeterminada  → establecer plantilla predeterminada
router.post("/:id/plantillas/predeterminada", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), async (req, res) => {
  try {
    const id = req.user.super ? req.params.id : req.user.clinica_id;
    const { tipo } = req.body;
    await ensurePlantillasPredeterminadaColumn();

    if (!tipo) {
      return res.status(400).json({ ok: false, msg: "tipo es obligatorio" });
    }

    // Verificar que existe la plantilla
    const [exist] = await pool.query(
      "SELECT id FROM plantillas_documentos WHERE clinica_id=? AND tipo=? AND activo=1",
      [id, tipo]
    );

    if (!exist.length) {
      return res.status(404).json({ ok: false, msg: "Plantilla no encontrada" });
    }

    // Primero desmarcar todas las recetas predeterminadas de esta clinica
    await pool.query(
      "UPDATE plantillas_documentos SET es_predeterminada = 0 WHERE clinica_id=? AND tipo='receta'",
      [id]
    );

    // Luego marcar esta como predeterminada
    await pool.query(
      "UPDATE plantillas_documentos SET es_predeterminada = 1 WHERE clinica_id=? AND tipo=?",
      [id, tipo]
    );

    res.json({ ok: true, msg: "Plantilla predeterminada establecida" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  UPLOAD DE LOGO
// ══════════════════════════════════════════════════════════════════════════

// POST /api/clinicas/:id/upload-logo  → subir logo de la clínica
// Producción (CLOUDINARY_CLOUD_NAME definido): sube a Cloudinary (persiste entre despliegues)
// Desarrollo  (sin credenciales):              guarda en uploads/clinicas/
router.post("/:id/upload-logo", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), uploadFotoDoctor.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, msg: "No se recibió ningún archivo" });
    }

    const id = req.user.super ? req.params.id : req.user.clinica_id;
    let logoUrl;

    if (USE_CLOUDINARY) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "clinica/clinicas/logo", resource_type: "image" },
          (err, r) => (err ? reject(err) : resolve(r))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      logoUrl = result.secure_url;
    } else {
      const dir = path.join(__dirname, "../uploads/clinicas");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const ext = req.file.mimetype === "image/png" ? ".png"
                : req.file.mimetype === "image/webp" ? ".webp" : ".jpg";
      const filename = `logo-${id}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(dir, filename), req.file.buffer);
      logoUrl = `/uploads/clinicas/${filename}`;
    }

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

// POST /api/clinicas/:id/upload-foto-doctor  → subir foto pública del doctor
// Producción (CLOUDINARY_CLOUD_NAME definido): sube a Cloudinary (persiste entre despliegues)
// Desarrollo  (sin credenciales):              guarda en uploads/clinicas/
router.post("/:id/upload-foto-doctor", auth("SUPER_ADMIN","ADMIN","MEDICO","PSICOLOGO"), uploadFotoDoctor.single("foto"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, msg: "No se recibió ningún archivo" });
    }

    const id = req.user.super ? req.params.id : req.user.clinica_id;
    let fotoUrl;

    if (USE_CLOUDINARY) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "clinica/clinicas/perfil-doctor", resource_type: "image",
            transformation: [{ width: 500, height: 500, crop: "fill", gravity: "face" }] },
          (err, r) => (err ? reject(err) : resolve(r))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      fotoUrl = result.secure_url;
    } else {
      const dir = path.join(__dirname, "../uploads/clinicas");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const ext = req.file.mimetype === "image/png" ? ".png"
                : req.file.mimetype === "image/webp" ? ".webp" : ".jpg";
      const filename = `doctor-${id}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(dir, filename), req.file.buffer);
      fotoUrl = `/uploads/clinicas/${filename}`;
    }

    await pool.query(
      `INSERT INTO clinica_config (clinica_id, clave, valor) VALUES (?,'perfil_foto_doctor',?)
       ON DUPLICATE KEY UPDATE valor=VALUES(valor)`,
      [id, fotoUrl]
    );

    res.json({
      ok: true,
      foto_url: fotoUrl,
      msg: "Foto subida correctamente",
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  GET /api/clinicas/:id/bitacora  → accesos registrados (solo SUPER_ADMIN)
//  Query params: pagina (default 1), limite (default 50), tipo, exito, busqueda
// ──────────────────────────────────────────────
router.get("/:id/bitacora", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.params.id;
    const pagina    = Math.max(1, parseInt(req.query.pagina)  || 1);
    const limite    = Math.min(100, parseInt(req.query.limite) || 50);
    const offset    = (pagina - 1) * limite;
    const { tipo, exito, busqueda } = req.query;

    const condiciones = ["clinica_id = ?"];
    const params      = [clinicaId];

    if (tipo)     { condiciones.push("tipo = ?");    params.push(tipo); }
    if (exito !== undefined && exito !== "") {
      condiciones.push("exito = ?");
      params.push(exito === "1" || exito === "true" ? 1 : 0);
    }
    if (busqueda) {
      condiciones.push("(nombres LIKE ? OR apellidos LIKE ? OR email LIKE ?)");
      const like = `%${busqueda}%`;
      params.push(like, like, like);
    }

    const where = "WHERE " + condiciones.join(" AND ");

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM bitacora_accesos ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT id, usuario_id, nombres, apellidos, email, tipo, ip, user_agent, exito, creado_en
       FROM bitacora_accesos ${where}
       ORDER BY creado_en DESC
       LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );

    res.json({
      ok: true,
      data: rows,
      paginacion: { total, pagina, limite, paginas: Math.ceil(total / limite) },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
module.exports.aplicarPresetModulosClinica = aplicarPresetModulosClinica;

