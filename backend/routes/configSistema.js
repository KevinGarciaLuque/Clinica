const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const { uploadSistemaMemory } = require("../middlewares/upload");

const DEFAULTS = {
  nombre_sistema:      "Medic-KG",
  subtitulo:           "Sistema de gestión clínica",
  logo_url:            "",
  icono_bootstrap:     "bi-hospital",
  fondo_login_url:     "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1920&q=80",
  copyright_texto:     "Medic-KG · Todos los derechos reservados",
  color_primario:      "#3b82f6",
  color_nombre1:       "#ffffff",
  color_nombre2:       "#2D6BE8",
  inactividad_minutos: "20",
  // Landing page pública
  landing_color_primario:       "#0E1F3C",
  landing_activo:               "1",
  landing_tagline:              "Gestión clínica moderna y eficiente",
  landing_descripcion:          "Plataforma todo-en-uno para administrar tu clínica: citas, pacientes, historias clínicas, facturación y más.",
  landing_whatsapp:             "",
  landing_email_contacto:       "",
  landing_nosotros_texto:       "Somos un equipo apasionado por transformar la gestión médica mediante tecnología accesible y poderosa.",
  landing_instagram:            "",
  landing_facebook:             "",
  landing_tiktok:               "",
  landing_plan_trial_precio:    "",
  landing_plan_trial_duracion:  "Semestral / Anual",
  landing_plan_trial_features:  '["Hasta 2 usuarios: 1 médico + 1 recepcionista","Pacientes ilimitados con expediente digital","Agenda médica: vista diaria y semanal","Historia clínica en formato SOAP","Recetas digitales con QR verificable","Solicitud y registro de estudios","10 GB de almacenamiento","Soporte por WhatsApp en horario hábil"]',
  landing_plan_semestral_precio:"",
  landing_plan_semestral_features:'["Hasta 3 usuarios (Médico, Enfermera, Recepcionista)","Pacientes ilimitados con expediente completo","Agenda avanzada con sala de espera y recordatorios","Historia clínica SOAP + diagnósticos CIE-10","Recetas, constancias y documentos clínicos con firma digital","Reportes de citas, pacientes y consultas","Módulos opcionales: pediatría, psicología, estética u odontología","20 GB de almacenamiento","Soporte por WhatsApp + asistencia en configuración"]',
  landing_plan_anual_precio:    "",
  landing_plan_anual_features:  '["Desde 4 usuarios con roles configurables","Pacientes ilimitados con expediente avanzado","Agenda por médico, especialidad o consultorio","Historia clínica completa con plantillas por especialidad","Recetas, documentos, incapacidades y referencias médicas","Reportes por médico, especialidad y área","Múltiples especialidades y módulos personalizados","Portal público de citas online para pacientes","30 GB de almacenamiento","Soporte prioritario + capacitación del personal","Felicitaciones automáticas al paciente en su cumpleaños"]',
  // Directorio médico público (/agenda-tu-consulta)
  directorio_color_primario:    "#213665",
  directorio_color_tarjetas:    "#213665",
  directorio_badge_texto:       "Directorio médico",
  directorio_titulo:            "Agenda tu consulta médica",
  directorio_subtitulo:         "Los mejores médicos y especialistas los encuentras aquí. Compara perfiles y agenda tu cita en línea, sin llamadas ni esperas.",
  directorio_badge1_texto:      "Especialistas verificados",
  directorio_badge2_texto:      "Confirmación al instante",
  directorio_badge3_texto:      "Tus datos siempre protegidos",
  directorio_cta_badge:         "Para médicos y especialistas",
  directorio_cta_titulo:        "Haz crecer tu consulta con nosotros",
  directorio_cta_texto:         "Súmate a nuestro directorio y deja que nuevos pacientes te encuentren, agenden y confirmen citas en línea, sin esfuerzo adicional para tu clínica.",
  directorio_cta_boton:         "Quiero unirme",
};

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS config_sistema (
      clave   VARCHAR(80)  NOT NULL PRIMARY KEY,
      valor   MEDIUMTEXT   NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // Ampliar columna si la tabla ya existía con TEXT (< 64KB)
  await pool.query(`
    ALTER TABLE config_sistema MODIFY COLUMN valor MEDIUMTEXT NOT NULL
  `).catch(() => {});
  // Insertar defaults si no existen
  for (const [clave, valor] of Object.entries(DEFAULTS)) {
    await pool.query(
      `INSERT IGNORE INTO config_sistema (clave, valor) VALUES (?, ?)`,
      [clave, valor]
    );
  }
  schemaReady = true;
}

function rowsToObj(rows) {
  const obj = { ...DEFAULTS };
  for (const r of rows) {
    obj[r.clave] = r.valor;
  }
  return obj;
}

// ── GET /api/config-sistema  (público, sin auth) ─────────────────────────
router.get("/", async (req, res) => {
  try {
    await ensureSchema();
    const [rows] = await pool.query("SELECT clave, valor FROM config_sistema");
    res.json({ ok: true, data: rowsToObj(rows) });
  } catch (e) {
    console.error("[config-sistema GET]", e);
    res.json({ ok: true, data: DEFAULTS }); // fallback silencioso
  }
});

// ── PUT /api/config-sistema  (solo SUPER_ADMIN) ───────────────────────────
router.put("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureSchema();
    const campos = [
      "nombre_sistema", "subtitulo", "icono_bootstrap",
      "fondo_login_url", "copyright_texto", "color_primario",
      "color_nombre1", "color_nombre2", "inactividad_minutos",
      // Landing page
      "landing_activo", "landing_color_primario", "landing_tagline", "landing_descripcion",
      "landing_whatsapp", "landing_email_contacto", "landing_nosotros_texto",
      "landing_instagram", "landing_facebook", "landing_tiktok",
      "landing_plan_trial_precio", "landing_plan_trial_duracion", "landing_plan_trial_features",
      "landing_plan_semestral_precio", "landing_plan_semestral_features",
      "landing_plan_anual_precio", "landing_plan_anual_features",
      // Directorio médico público
      "directorio_color_primario", "directorio_color_tarjetas", "directorio_badge_texto", "directorio_titulo", "directorio_subtitulo",
      "directorio_badge1_texto", "directorio_badge2_texto", "directorio_badge3_texto",
      "directorio_cta_badge", "directorio_cta_titulo", "directorio_cta_texto", "directorio_cta_boton",
    ];
    for (const c of campos) {
      if (req.body[c] !== undefined) {
        await pool.query(
          `INSERT INTO config_sistema (clave, valor) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
          [c, String(req.body[c])]
        );
      }
    }
    const [rows] = await pool.query("SELECT clave, valor FROM config_sistema");
    res.json({ ok: true, data: rowsToObj(rows) });
  } catch (e) {
    console.error("[config-sistema PUT]", e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/config-sistema/upload-logo  (solo SUPER_ADMIN) ─────────────
router.post(
  "/upload-logo",
  auth("SUPER_ADMIN"),
  uploadSistemaMemory.single("logo"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });
      await ensureSchema();
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      await pool.query(
        `INSERT INTO config_sistema (clave, valor) VALUES ('logo_url', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [dataUrl]
      );
      res.json({ ok: true, url: dataUrl });
    } catch (e) {
      console.error("[config-sistema upload-logo]", e);
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── POST /api/config-sistema/upload-fondo  (solo SUPER_ADMIN) ────────────
router.post(
  "/upload-fondo",
  auth("SUPER_ADMIN"),
  uploadSistemaMemory.single("fondo"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });
      await ensureSchema();
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      await pool.query(
        `INSERT INTO config_sistema (clave, valor) VALUES ('fondo_login_url', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [dataUrl]
      );
      res.json({ ok: true, url: dataUrl });
    } catch (e) {
      console.error("[config-sistema upload-fondo]", e);
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── DELETE /api/config-sistema/logo  (solo SUPER_ADMIN) ─────────────────
router.delete("/logo", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO config_sistema (clave, valor) VALUES ('logo_url', '')
       ON DUPLICATE KEY UPDATE valor = ''`
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
