const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const morgan    = require("morgan");
const path      = require("path");
const cron      = require("node-cron");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();

// Railway (y la mayoría de PaaS) coloca al cliente real en X-Forwarded-For.
// Con trust proxy = 1, Express asigna ese valor a req.ip, lo que permite que
// express-rate-limit identifique correctamente al usuario y no a la IP del proxy.
app.set("trust proxy", 1);

// ===== CORS =====
const BASE_ORIGINS = [
  "https://clinica-nine-xi.vercel.app",
  "https://medickg.com",
  "https://www.medickg.com",
];

const allowedOrigins = [
  ...BASE_ORIGINS,
  ...(process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
];

const corsOptions = {
  origin: (origin, cb) => {
    // Permitir peticiones sin origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-clinica-id",
    "x-clinica-slug",
    "x-session-token",
  ],
  optionsSuccessStatus: 204,
};

// ===== Rate limiting =====
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // los logins correctos no consumen intentos
  standardHeaders: true,
  legacyHeaders: false,
  // req.ip ya es la IP real del cliente gracias a trust proxy
  message: {
    ok: false,
    msg: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
  },
});

const streamTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,             // tope razonable; cada reconexión pide un token
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes de token SSE. Intenta en un momento." },
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ===== Seguridad =====
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "frame-ancestors": ["*"],
      },
    },
  })
);

// Token personalizado que elimina sse_token de la URL registrada en los logs,
// evitando que un token de stream temporal quede expuesto aunque sea efímero.
morgan.token("url-safe", (req) =>
  (req.originalUrl || req.url).replace(/([?&])sse_token=[^&]*/g, "$1sse_token=[REDACTED]")
);

app.use(morgan(":method :url-safe :status :res[content-length] - :response-time ms", {
  skip: (req, res) => res.statusCode < 400,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== Archivos estáticos =====
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== Middleware Multi-clínica =====
app.use((req, res, next) => {
  const mode = process.env.TENANT_MODE || "header";

  if (mode === "subdomain") {
    const host = (req.headers.host || "").split(":")[0];
    const parts = host.split(".");
    const subdomain = parts.length >= 3 ? parts[0] : null;

    req.tenant = {
      slug: subdomain || null,
      clinica_id: null,
      source: "subdomain",
    };

    return next();
  }

  const clinica_id = req.headers["x-clinica-id"] || null;
  const slug = req.headers["x-clinica-slug"] || null;

  req.tenant = {
    clinica_id: clinica_id ? Number(clinica_id) : null,
    slug: slug ? String(slug) : null,
    source: "header",
  };

  next();
});

// ===== Ruta base =====
app.get("/", (req, res) => {
  res.json({
    ok: true,
    msg: "API Clínica funcionando",
    tenant: req.tenant,
  });
});

// ===== Rutas =====
app.post("/api/auth/login",           loginLimiter);
app.post("/api/soporte/stream-token", streamTokenLimiter);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/clinicas", require("./routes/clinicas"));
app.use("/api/usuarios", require("./routes/usuarios"));
app.use("/api/horarios", require("./routes/horarios"));
app.use("/api/ausencias", require("./routes/ausencias"));
app.use("/api/servicios", require("./routes/servicios"));
app.use("/api/pacientes", require("./routes/pacientes"));
app.use("/api/pacientes/:pacienteId/documentos", require("./routes/documentos"));
app.use("/api/documentos", require("./routes/documentosPdf"));
app.use("/api/citas", require("./routes/citas"));
app.use("/api/google", require("./routes/google"));
app.use("/api/ia", require("./routes/ia"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/estadisticas", require("./routes/estadisticas"));
app.use("/api/facturacion", require("./routes/facturacion"));
app.use("/api/caja", require("./routes/caja"));
app.use("/api/historias", require("./routes/historias"));
app.use("/api/prescripciones", require("./routes/prescripciones"));
app.use("/api/estudios", require("./routes/estudios"));
app.use("/api/recepcion", require("./routes/recepcion"));
app.use("/api/medicamentos", require("./routes/medicamentos"));
app.use("/api/catalogos-diagnostico", require("./routes/catalogosDiagnostico"));
app.use("/api/catalogos-estudios", require("./routes/catalogosEstudios"));
app.use("/api/catalogos-tipos-cita", require("./routes/catalogosTiposCita"));
app.use("/api/catalogos-condiciones-medicas", require("./routes/catalogosCondicionesMedicas"));
app.use("/api/catalogos-procedimientos", require("./routes/catalogosProcedimientos"));
app.use("/api/registro", require("./routes/registro"));
app.use("/api/planes-publicos", require("./routes/planesPublicos"));
app.use("/api/facturacion-licencias", require("./routes/facturacionLicencias"));
app.use("/api/resenas", require("./routes/resenas"));
app.use("/api/database", require("./routes/database"));
app.use("/api/galeria-estetica", require("./routes/galeriaEstetica"));
app.use("/api/biopsias",        require("./routes/biopsias"));
app.use("/api/inventario",      require("./routes/inventario"));
app.use("/api/recordatorios", require("./routes/recordatorios"));
app.use("/api/crecimiento", require("./routes/crecimiento"));
app.use("/api/setup",     require("./routes/setup"));
app.use("/api/reportes",  require("./routes/reportes"));
app.use("/api/vacunas",    require("./routes/vacunas"));
app.use("/api/soporte",        require("./routes/soporte"));
app.use("/api/cumpleanos",     require("./routes/cumpleanos"));
app.use("/api/config-sistema", require("./routes/configSistema"));
app.use("/api/marketing-medico", require("./routes/marketingMedico"));
app.use("/api/eventos-festivos", require("./routes/eventosFestivos"));
app.use("/api/psicologia",     require("./routes/psicologia"));
app.use("/api/odontologia",    require("./routes/odontologia"));
app.use("/api/nefrologia",     require("./routes/nefrologia"));
app.use("/api/endocrinologia", require("./routes/endocrinologia"));
app.use("/api/educacion-diabetes", require("./routes/educacionDiabetes"));
app.use("/rx",                 require("./routes/rx"));
app.use("/api/public",         require("./routes/public"));

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    msg: "Ruta no encontrada",
  });
});

// ===== Manejo de errores =====
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);

  // Error específico de CORS
  if (err.message && err.message.startsWith("CORS bloqueado:")) {
    return res.status(403).json({
      ok: false,
      msg: err.message,
    });
  }

  res.status(500).json({
    ok: false,
    msg: err.message || "Error interno del servidor",
  });
});

const PORT = process.env.PORT || 5000;

// ── Auto-migración de tablas que pueden faltar en producción ──────────
const pool = require("./db");
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verificaciones_email (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        paciente_id  INT UNSIGNED NOT NULL,
        clinica_id   INT UNSIGNED NOT NULL,
        token        VARCHAR(100) NOT NULL UNIQUE,
        expires_at   DATETIME     NOT NULL,
        usado        TINYINT(1)   DEFAULT 0,
        creado_en    DATETIME     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ve_token    (token),
        INDEX idx_ve_paciente (paciente_id),
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
        FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] verificaciones_email OK");

    // Tabla catálogo de tipos de cita por clínica
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalogos_tipos_cita (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id  INT UNSIGNED NOT NULL,
        nombre      VARCHAR(120) NOT NULL,
        descripcion VARCHAR(300) NULL,
        orden       TINYINT UNSIGNED DEFAULT 0,
        activo      TINYINT(1)   DEFAULT 1,
        creado_en   DATETIME     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ctc_clinica (clinica_id),
        FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] catalogos_tipos_cita OK");

    // Corrige la FK citas.servicio_id: debe apuntar a catalogos_tipos_cita
    // (tabla usada por el agendamiento público y de admin), no a "servicios"
    // (catálogo de precios). Con la FK apuntando a "servicios", agendar una
    // cita desde el portal público fallaba con:
    //   Cannot add or update a child row: a foreign key constraint fails
    //   (`citas`, CONSTRAINT `fk_citas_servicio` ...)
    const [fkServicio] = await pool.query(`
      SELECT REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'citas'
        AND CONSTRAINT_NAME = 'fk_citas_servicio'
    `);
    if (fkServicio.length && fkServicio[0].REFERENCED_TABLE_NAME !== 'catalogos_tipos_cita') {
      await pool.query(`ALTER TABLE citas DROP FOREIGN KEY fk_citas_servicio`);
      await pool.query(`
        UPDATE citas c
        LEFT JOIN catalogos_tipos_cita t ON t.id = c.servicio_id
        SET c.servicio_id = NULL
        WHERE c.servicio_id IS NOT NULL AND t.id IS NULL
      `);
      await pool.query(`
        ALTER TABLE citas
          ADD CONSTRAINT fk_citas_servicio
          FOREIGN KEY (servicio_id) REFERENCES catalogos_tipos_cita(id) ON DELETE SET NULL
      `);
      console.log("✅ [auto-migrate] fk_citas_servicio → catalogos_tipos_cita (corregida)");
    } else {
      console.log("✅ [auto-migrate] fk_citas_servicio OK");
    }

    // Notificaciones internas para usuarios de clínica (campanita navbar)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones_usuario (
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id  INT UNSIGNED NOT NULL,
        clinica_id  INT UNSIGNED NOT NULL,
        tipo        VARCHAR(50) NOT NULL,
        mensaje     VARCHAR(300) NOT NULL,
        paciente_id INT UNSIGNED NULL,
        cita_id     INT UNSIGNED NULL,
        leida       TINYINT(1) DEFAULT 0,
        creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
        leido_en    DATETIME NULL,
        INDEX idx_nu_usuario_leida (usuario_id, leida, creado_en),
        INDEX idx_nu_clinica (clinica_id, creado_en),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE SET NULL,
        FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] notificaciones_usuario OK");

    // Suscripciones Web Push por usuario
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id     INT UNSIGNED NOT NULL,
        clinica_id  INT UNSIGNED NOT NULL,
        endpoint    TEXT NOT NULL,
        p256dh      VARCHAR(255) NOT NULL,
        auth        VARCHAR(255) NOT NULL,
        user_agent  VARCHAR(255) NULL,
        activo      TINYINT(1) DEFAULT 1,
        creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ps_user_activo (user_id, activo),
        INDEX idx_ps_clinica_activo (clinica_id, activo),
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
        UNIQUE KEY uq_ps_endpoint (endpoint(255))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] push_subscriptions OK");

    // Configuración de correo saliente (SMTP), editable por el SUPER_ADMIN
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config_smtp (
        id           TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
        smtp_host    VARCHAR(150) NULL,
        smtp_port    SMALLINT UNSIGNED NULL,
        smtp_secure  TINYINT(1) DEFAULT 0,
        smtp_user    VARCHAR(150) NULL,
        smtp_pass_enc TEXT NULL,
        email_from   VARCHAR(200) NULL,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] config_smtp OK");

    // Configuración de pagos (cuenta bancaria + precios por plan), editable por el SUPER_ADMIN
    // y consultada públicamente desde /solicitar-plan
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config_pagos (
        id                TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
        banco             VARCHAR(120) NULL,
        titular           VARCHAR(150) NULL,
        numero_cuenta     VARCHAR(60)  NULL,
        numero_cci        VARCHAR(60)  NULL,
        moneda            CHAR(3) DEFAULT 'HNL',
        precio_trial      DECIMAL(10,2) NULL,
        precio_semestral  DECIMAL(10,2) NULL,
        precio_anual      DECIMAL(10,2) NULL,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] config_pagos OK");

    // Ampliar config_pagos: precio por nivel (básico/avanzado/empresarial) × duración (semestral/anual)
    const [colPrecioNivel] = await pool.query(`SHOW COLUMNS FROM config_pagos LIKE 'precio_avanzado_semestral'`);
    if (!colPrecioNivel.length) {
      await pool.query(`
        ALTER TABLE config_pagos
          ADD COLUMN precio_basico_semestral      DECIMAL(10,2) NULL AFTER moneda,
          ADD COLUMN precio_basico_anual          DECIMAL(10,2) NULL AFTER precio_basico_semestral,
          ADD COLUMN precio_avanzado_semestral    DECIMAL(10,2) NULL AFTER precio_basico_anual,
          ADD COLUMN precio_avanzado_anual        DECIMAL(10,2) NULL AFTER precio_avanzado_semestral,
          ADD COLUMN precio_empresarial_semestral DECIMAL(10,2) NULL AFTER precio_avanzado_anual,
          ADD COLUMN precio_empresarial_anual     DECIMAL(10,2) NULL AFTER precio_empresarial_semestral
      `);
      // Los precios semestral/anual previos correspondían al Plan Avanzado — se conservan ahí
      await pool.query(`
        UPDATE config_pagos
        SET precio_avanzado_semestral = precio_semestral,
            precio_avanzado_anual     = precio_anual
        WHERE id = 1
      `);
      console.log("✅ [auto-migrate] config_pagos → precios por nivel de plan agregados");
    }

    // Reseñas de médicos clientes (encuesta enviada por el SUPER_ADMIN, publicada en /inicio)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS resenas_medicos (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id    INT UNSIGNED NULL,
        usuario_id    INT UNSIGNED NULL,
        token         VARCHAR(64) NOT NULL UNIQUE,
        nombre_medico VARCHAR(150) NOT NULL,
        especialidad  VARCHAR(100) NULL,
        lugar         VARCHAR(150) NULL,
        estrellas     TINYINT UNSIGNED NULL,
        opinion       VARCHAR(600) NULL,
        estado        ENUM('pendiente','respondida') DEFAULT 'pendiente',
        activo        TINYINT(1) DEFAULT 1,
        enviada_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
        respondida_en DATETIME NULL,
        INDEX idx_resenas_estado_activo (estado, activo),
        FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE SET NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] resenas_medicos OK");

    // Solicitudes públicas de compra de plan (antes de que exista la clínica)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_plan_publico (
        id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nombres               VARCHAR(100) NOT NULL,
        apellidos             VARCHAR(100) NOT NULL,
        email                 VARCHAR(150) NOT NULL,
        telefono              VARCHAR(30)  NULL,
        nombre_clinica        VARCHAR(150) NOT NULL,
        nivel_plan            ENUM('basico','avanzado','empresarial') NOT NULL DEFAULT 'basico',
        plan_solicitado       ENUM('trial','semestral','anual') NOT NULL,
        mensaje               VARCHAR(500) NULL,
        comprobante_url       VARCHAR(500) NOT NULL,
        comprobante_public_id VARCHAR(200) NULL,
        monto                 DECIMAL(10,2) NULL,
        moneda                CHAR(3) DEFAULT 'HNL',
        estado                ENUM('pendiente','aprobada','rechazada') DEFAULT 'pendiente',
        motivo_rechazo        VARCHAR(300) NULL,
        clinica_id            INT UNSIGNED NULL,
        usuario_id            INT UNSIGNED NULL,
        atendida_por          INT UNSIGNED NULL,
        atendida_en           DATETIME NULL,
        creado_en             DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_spp_estado (estado, creado_en),
        FOREIGN KEY (clinica_id)   REFERENCES clinicas(id) ON DELETE SET NULL,
        FOREIGN KEY (usuario_id)   REFERENCES usuarios(id) ON DELETE SET NULL,
        FOREIGN KEY (atendida_por) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] solicitudes_plan_publico OK");

    // Si la tabla ya existía sin la columna nivel_plan, se agrega
    const [colNivelPlan] = await pool.query(`SHOW COLUMNS FROM solicitudes_plan_publico LIKE 'nivel_plan'`);
    if (!colNivelPlan.length) {
      await pool.query(`
        ALTER TABLE solicitudes_plan_publico
          ADD COLUMN nivel_plan ENUM('basico','avanzado','empresarial') NOT NULL DEFAULT 'basico' AFTER nombre_clinica
      `);
      console.log("✅ [auto-migrate] solicitudes_plan_publico.nivel_plan agregado");
    }

    // Tabla catálogo de procedimientos dermatológicos/estéticos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalogos_procedimientos (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id   INT UNSIGNED NOT NULL,
        nombre       VARCHAR(200) NOT NULL,
        categoria    ENUM('dermatologico','estetico') NOT NULL DEFAULT 'dermatologico',
        descripcion  VARCHAR(500) NULL,
        precio_ref   DECIMAL(10,2) NULL,
        duracion_min SMALLINT UNSIGNED NULL,
        orden        TINYINT UNSIGNED DEFAULT 0,
        activo       TINYINT(1)   DEFAULT 1,
        creado_en    DATETIME     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cp_clinica (clinica_id),
        FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] catalogos_procedimientos OK");

    // Columna datos_derma en historias_clinicas (JSON con campos dermatológicos específicos)
    const [colDerma] = await pool.query(`
      SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'historias_clinicas'
        AND COLUMN_NAME  = 'datos_derma'
    `);
    if (colDerma[0].n === 0) {
      await pool.query(`
        ALTER TABLE historias_clinicas
          ADD COLUMN datos_derma JSON NULL
          COMMENT 'Campos específicos de dermatología: fototipo, localización, antec. derma, etc.'
      `);
      console.log("✅ [auto-migrate] historias_clinicas.datos_derma agregada");
    } else {
      console.log("✅ [auto-migrate] historias_clinicas.datos_derma OK");
    }

    // Tabla biopsias (módulo Biopsias y Patología)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS biopsias (
        id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id               INT UNSIGNED NOT NULL,
        paciente_id              INT UNSIGNED NOT NULL,
        medico_id                INT UNSIGNED NOT NULL,
        historia_id              INT UNSIGNED NULL,
        tipo_biopsia             ENUM('incisional','excisional','shave','punch','aspirado','curetaje') NOT NULL,
        sitio_anatomico          VARCHAR(200) NOT NULL,
        sospecha_clinica         VARCHAR(500) NULL,
        diagnosticos_diferenciales TEXT NULL,
        fecha_toma               DATE NULL,
        laboratorio              VARCHAR(200) NULL,
        observaciones            TEXT NULL,
        resultado_texto          TEXT NULL,
        resultado_patologico     ENUM('benigno','maligno','atipia_leve','atipia_moderada','atipia_severa','pendiente','no_concluyente') NULL DEFAULT 'pendiente',
        margenes                 ENUM('libres','comprometidos','no_evaluables','no_aplica') NULL DEFAULT 'no_aplica',
        conducta_posterior       TEXT NULL,
        fecha_resultado          DATETIME NULL,
        estado                   ENUM('PENDIENTE','RESULTADO_RECIBIDO','CERRADO') NOT NULL DEFAULT 'PENDIENTE',
        creado_en                DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_biop_clinica   (clinica_id),
        INDEX idx_biop_paciente  (paciente_id),
        INDEX idx_biop_estado    (estado),
        FOREIGN KEY (clinica_id)   REFERENCES clinicas(id)  ON DELETE CASCADE,
        FOREIGN KEY (paciente_id)  REFERENCES pacientes(id) ON DELETE CASCADE,
        FOREIGN KEY (medico_id)    REFERENCES usuarios(id)  ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] biopsias OK");

    // Cambiar tipo_consulta de ENUM a VARCHAR(150) para soportar tipos personalizados
    const [colTipo] = await pool.query(`
      SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'citas'
        AND COLUMN_NAME  = 'tipo_consulta'
    `);
    if (colTipo.length && colTipo[0].DATA_TYPE === 'enum') {
      await pool.query(`
        ALTER TABLE citas
          MODIFY COLUMN tipo_consulta VARCHAR(150) NULL DEFAULT 'PRIMERA_VEZ'
      `);
      console.log("✅ [auto-migrate] citas.tipo_consulta → VARCHAR(150) OK");
    } else {
      console.log("✅ [auto-migrate] citas.tipo_consulta OK");
    }

    // Cambiar canal de ENUM a VARCHAR(50) para soportar APP, WEB, etc.
    const [colCanal] = await pool.query(`
      SELECT DATA_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'citas'
        AND COLUMN_NAME  = 'canal'
    `);
    if (colCanal.length && colCanal[0].DATA_TYPE === 'enum') {
      await pool.query(`
        ALTER TABLE citas
          MODIFY COLUMN canal VARCHAR(50) NULL DEFAULT 'RECEPCION'
      `);
      console.log("✅ [auto-migrate] citas.canal → VARCHAR(50) OK");
    } else {
      console.log("✅ [auto-migrate] citas.canal OK");
    }

    // Seed tipos de cita para la clínica de Gina Valladares (clinica_id = 17)
    {
      const gCid = 17;
      const [clinica] = await pool.query(
        `SELECT COUNT(*) AS n FROM clinicas WHERE id = ?`, [gCid]
      );
      if (clinica[0].n === 0) {
        console.log(`⚠️  [seed] Clínica ${gCid} no existe en la base de datos local, se omite seed de tipos de cita`);
      } else {
        const [existentes] = await pool.query(
          `SELECT COUNT(*) AS n FROM catalogos_tipos_cita WHERE clinica_id = ? AND activo = 1`, [gCid]
        );
        if (existentes[0].n === 0) {
          const tiposGina = [
            "Consulta dermatológica primera vez",
            "Consulta dermatológica control",
            "Consulta estética",
            "Consulta pediátrica dermatológica",
            "Consulta de urgencia dermatológica",
            "Consulta online",
            "Revisión postprocedimiento",
            "Retiro de puntos",
            "Curación postquirúrgica",
            "Evaluación preláser",
            "Evaluación postláser",
          ];
          for (let i = 0; i < tiposGina.length; i++) {
            await pool.query(
              `INSERT INTO catalogos_tipos_cita (clinica_id, nombre, orden) VALUES (?, ?, ?)`,
              [gCid, tiposGina[i], i + 1]
            );
          }
          console.log(`✅ [seed] ${tiposGina.length} tipos de cita insertados para clínica ${gCid} (Gina Valladares)`);
        } else {
          console.log(`✅ [seed] tipos de cita clínica ${gCid} ya existen, se omite`);
        }
      }
    }

    // Columna especialidad en catalogos_diagnostico (ADD solo si no existe)
    const [colEsp] = await pool.query(`
      SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'catalogos_diagnostico'
        AND COLUMN_NAME  = 'especialidad'
    `);
    if (colEsp[0].n === 0) {
      await pool.query(`
        ALTER TABLE catalogos_diagnostico
          ADD COLUMN especialidad VARCHAR(60) NULL
          COMMENT 'PEDIATRIA, MEDICINA_GENERAL, CARDIOLOGIA, etc. NULL = todas'
          AFTER nombre
      `);
      console.log("✅ [auto-migrate] catalogos_diagnostico.especialidad agregada");
    } else {
      console.log("✅ [auto-migrate] catalogos_diagnostico.especialidad OK");
    }

    // Seed diagnósticos globales (solo si no existen aún)
    const [countDx] = await pool.query(
      "SELECT COUNT(*) AS n FROM catalogos_diagnostico WHERE clinica_id IS NULL"
    );
    if (countDx[0].n === 0) {
      await pool.query(`
        INSERT IGNORE INTO catalogos_diagnostico
          (clinica_id, medico_id, nombre, especialidad, codigo_cie, descripcion_cie, diagnosticos_secundarios)
        VALUES
        (NULL,NULL,'Resfriado común (rinofaringitis aguda)','PEDIATRIA','J00','Rinofaringitis aguda',NULL),
        (NULL,NULL,'IRA alta no especificada','PEDIATRIA','J06.9','Infección aguda de vías respiratorias superiores, no especificada',NULL),
        (NULL,NULL,'Faringitis aguda','PEDIATRIA','J02.9','Faringitis aguda, no especificada','[{"cie":"J00","descripcion":"Rinofaringitis aguda"}]'),
        (NULL,NULL,'Amigdalitis aguda','PEDIATRIA','J03.9','Amigdalitis aguda, no especificada','[{"cie":"J02.9","descripcion":"Faringitis aguda"}]'),
        (NULL,NULL,'Otitis media aguda','PEDIATRIA','H66.9','Otitis media, no especificada','[{"cie":"J06.9","descripcion":"IRA alta"}]'),
        (NULL,NULL,'Bronquitis aguda','PEDIATRIA','J20.9','Bronquitis aguda, no especificada',NULL),
        (NULL,NULL,'Bronconeumonía','PEDIATRIA','J18.0','Bronconeumonía, no especificada',NULL),
        (NULL,NULL,'Neumonía no especificada','PEDIATRIA','J18.9','Neumonía, no especificada',NULL),
        (NULL,NULL,'Asma bronquial','PEDIATRIA','J45.9','Asma, no especificada','[{"cie":"J20.9","descripcion":"Bronquitis aguda"}]'),
        (NULL,NULL,'Rinitis alérgica','PEDIATRIA','J30.1','Rinitis alérgica debida al polen',NULL),
        (NULL,NULL,'Laringotraqueítis aguda (croup)','PEDIATRIA','J05.0','Laringitis obstructiva aguda [croup]',NULL),
        (NULL,NULL,'Bronquiolitis aguda por VRS','PEDIATRIA','J21.0','Bronquiolitis aguda debida a virus sincicial respiratorio',NULL),
        (NULL,NULL,'EDA (diarrea aguda infecciosa)','PEDIATRIA','A09','Otras gastroenteritis y colitis de origen infeccioso','[{"cie":"E86","descripcion":"Deshidratación"}]'),
        (NULL,NULL,'Enteritis por rotavirus','PEDIATRIA','A08.0','Enteritis debida a rotavirus',NULL),
        (NULL,NULL,'Estreñimiento funcional','PEDIATRIA','K59.0','Estreñimiento',NULL),
        (NULL,NULL,'Enfermedad por reflujo gastroesofágico','PEDIATRIA','K21.0','Enfermedad de reflujo gastroesofágico con esofagitis',NULL),
        (NULL,NULL,'Náuseas y vómitos','PEDIATRIA','R11','Náuseas y vómitos',NULL),
        (NULL,NULL,'Dolor abdominal recurrente','PEDIATRIA','R10.4','Otros dolores abdominales y los no especificados',NULL),
        (NULL,NULL,'Parasitosis intestinal','PEDIATRIA','B82.9','Parasitosis intestinal, no especificada',NULL),
        (NULL,NULL,'Varicela','PEDIATRIA','B01.9','Varicela sin complicaciones',NULL),
        (NULL,NULL,'Escarlatina','PEDIATRIA','A38','Escarlatina','[{"cie":"J02.0","descripcion":"Faringitis estreptocócica"}]'),
        (NULL,NULL,'Herpangina','PEDIATRIA','B08.5','Faringitis vesicular por enterovirus',NULL),
        (NULL,NULL,'Enfermedad mano-pie-boca','PEDIATRIA','B08.4','Estomatitis vesicular por enterovirus con exantema',NULL),
        (NULL,NULL,'Exantema súbito (roséola)','PEDIATRIA','B08.2','Exantema súbito [sexta enfermedad], no especificado',NULL),
        (NULL,NULL,'Fiebre sin foco','PEDIATRIA','R50.9','Fiebre, no especificada',NULL),
        (NULL,NULL,'Infección de vías urinarias','PEDIATRIA','N39.0','Infección de vías urinarias, sitio no especificado',NULL),
        (NULL,NULL,'Convulsión febril','PEDIATRIA','R56.0','Convulsiones febriles',NULL),
        (NULL,NULL,'Epilepsia no especificada','PEDIATRIA','G40.9','Epilepsia, no especificada',NULL),
        (NULL,NULL,'TDAH (trastorno de atención e hiperactividad)','PEDIATRIA','F90.0','Trastorno de actividad y atención',NULL),
        (NULL,NULL,'Trastorno del espectro autista','PEDIATRIA','F84.0','Autismo infantil',NULL),
        (NULL,NULL,'Retraso en el habla y lenguaje','PEDIATRIA','F80.9','Trastorno del desarrollo del habla y lenguaje, no especificado',NULL),
        (NULL,NULL,'Cefalea tensional','PEDIATRIA','G44.2','Cefalea tensional',NULL),
        (NULL,NULL,'Desnutrición leve','PEDIATRIA','E44.1','Desnutrición proteico-calórica leve',NULL),
        (NULL,NULL,'Desnutrición moderada','PEDIATRIA','E44.0','Desnutrición proteico-calórica moderada',NULL),
        (NULL,NULL,'Desnutrición grave','PEDIATRIA','E43','Desnutrición proteico-calórica grave, no especificada',NULL),
        (NULL,NULL,'Talla baja','PEDIATRIA','E34.3','Talla baja constitucional',NULL),
        (NULL,NULL,'Obesidad infantil','PEDIATRIA','E66.0','Obesidad debida a exceso de calorías',NULL),
        (NULL,NULL,'Déficit de vitamina D / raquitismo','PEDIATRIA','E55.0','Raquitismo activo',NULL),
        (NULL,NULL,'Anemia por deficiencia de hierro','PEDIATRIA','D50.9','Anemia por deficiencia de hierro, sin otra especificación',NULL),
        (NULL,NULL,'Dermatitis atópica','PEDIATRIA','L20.9','Dermatitis atópica, sin otra especificación',NULL),
        (NULL,NULL,'Dermatitis del pañal','PEDIATRIA','L22','Dermatitis del pañal',NULL),
        (NULL,NULL,'Urticaria alérgica','PEDIATRIA','L50.0','Urticaria alérgica',NULL),
        (NULL,NULL,'Impétigo','PEDIATRIA','L01.0','Impétigo [cualquier sitio] [cualquier organismo]',NULL),
        (NULL,NULL,'Hipertensión arterial esencial','MEDICINA_GENERAL','I10','Hipertensión esencial (primaria)',NULL),
        (NULL,NULL,'Diabetes mellitus tipo 2','MEDICINA_GENERAL','E11.9','Diabetes mellitus tipo 2, sin complicaciones',NULL),
        (NULL,NULL,'Diabetes mellitus tipo 1','MEDICINA_GENERAL','E10.9','Diabetes mellitus tipo 1, sin complicaciones',NULL),
        (NULL,NULL,'Infección respiratoria alta (adulto)','MEDICINA_GENERAL','J06.9','Infección aguda de vías respiratorias superiores, no especificada',NULL),
        (NULL,NULL,'Infección de vías urinarias (adulto)','MEDICINA_GENERAL','N39.0','Infección de vías urinarias, sitio no especificado',NULL),
        (NULL,NULL,'Lumbalgia mecánica','MEDICINA_GENERAL','M54.5','Dolor en la región lumbar baja',NULL),
        (NULL,NULL,'Cefalea tensional (adulto)','MEDICINA_GENERAL','G44.2','Cefalea tensional',NULL),
        (NULL,NULL,'Gastritis aguda','MEDICINA_GENERAL','K29.1','Otras gastritis agudas',NULL),
        (NULL,NULL,'Ansiedad generalizada','MEDICINA_GENERAL','F41.1','Trastorno de ansiedad generalizada',NULL),
        (NULL,NULL,'Depresión leve','MEDICINA_GENERAL','F32.0','Episodio depresivo leve',NULL),
        (NULL,NULL,'Obesidad (adulto)','MEDICINA_GENERAL','E66.0','Obesidad debida a exceso de calorías',NULL),
        (NULL,NULL,'Hipertensión arterial con cardiopatía','CARDIOLOGIA','I11.9','Cardiopatía hipertensiva sin insuficiencia cardíaca',NULL),
        (NULL,NULL,'Insuficiencia cardíaca congestiva','CARDIOLOGIA','I50.0','Insuficiencia cardíaca congestiva',NULL),
        (NULL,NULL,'Fibrilación auricular','CARDIOLOGIA','I48','Fibrilación y aleteo auricular',NULL),
        (NULL,NULL,'Cardiopatía congénita no especificada','CARDIOLOGIA','Q24.9','Malformación congénita del corazón, no especificada',NULL),
        (NULL,NULL,'Migraña con aura','NEUROLOGIA','G43.1','Migraña con aura [migraña clásica]',NULL),
        (NULL,NULL,'Migraña sin aura','NEUROLOGIA','G43.0','Migraña sin aura [migraña común]',NULL),
        (NULL,NULL,'Accidente cerebrovascular isquémico','NEUROLOGIA','I63.9','Infarto cerebral, no especificado',NULL),
        (NULL,NULL,'Neuropatía periférica','NEUROLOGIA','G62.9','Polineuropatía, no especificada',NULL),
        (NULL,NULL,'Control prenatal normal','GINECOLOGIA','Z34.0','Supervisión de embarazo normal, primigesta',NULL),
        (NULL,NULL,'Infección vaginal por Candida','GINECOLOGIA','B37.3','Candidiasis de la vulva y la vagina',NULL),
        (NULL,NULL,'Dismenorrea primaria','GINECOLOGIA','N94.4','Dismenorrea primaria',NULL),
        (NULL,NULL,'Síndrome de ovario poliquístico','GINECOLOGIA','E28.2','Síndrome de ovario poliquístico',NULL)
      `);
      console.log("✅ [auto-migrate] seed diagnósticos globales insertados");
    } else {
      console.log("✅ [auto-migrate] seed diagnósticos ya existen, omitido");
    }
    // Tablas inventario (módulo Inventario)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventario_items (
        id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id     INT UNSIGNED NOT NULL,
        nombre         VARCHAR(200) NOT NULL,
        descripcion    VARCHAR(500) NULL,
        categoria      VARCHAR(100) NULL,
        unidad_medida  VARCHAR(50)  NOT NULL DEFAULT 'unidad',
        stock_actual   DECIMAL(10,2) NOT NULL DEFAULT 0,
        stock_minimo   DECIMAL(10,2) NOT NULL DEFAULT 0,
        precio_costo   DECIMAL(10,2) NULL,
        proveedor      VARCHAR(200) NULL,
        codigo         VARCHAR(80)  NULL,
        activo         TINYINT(1)   DEFAULT 1,
        creado_en      DATETIME     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inv_clinica   (clinica_id),
        INDEX idx_inv_categoria (clinica_id, categoria),
        FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] inventario_items OK");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventario_movimientos (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id    INT UNSIGNED NOT NULL,
        item_id       INT UNSIGNED NOT NULL,
        usuario_id    INT UNSIGNED NOT NULL,
        tipo          ENUM('ENTRADA','SALIDA','AJUSTE') NOT NULL,
        cantidad      DECIMAL(10,2) NOT NULL,
        stock_antes   DECIMAL(10,2) NOT NULL,
        stock_despues DECIMAL(10,2) NOT NULL,
        motivo        VARCHAR(300) NULL,
        referencia    VARCHAR(150) NULL,
        creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_imov_clinica (clinica_id),
        INDEX idx_imov_item    (item_id),
        INDEX idx_imov_fecha   (creado_en),
        FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)    ON DELETE CASCADE,
        FOREIGN KEY (item_id)     REFERENCES inventario_items(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)    ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] inventario_movimientos OK");

    // Corregir default del país en pacientes: Peru → Honduras
    await pool.query(`
      ALTER TABLE pacientes MODIFY COLUMN pais VARCHAR(100) DEFAULT 'Honduras'
    `);
    await pool.query(`
      UPDATE pacientes SET pais = 'Honduras' WHERE pais IN ('Peru','Perú','PE')
    `);
    console.log("✅ [auto-migrate] pacientes.pais default → Honduras");

    // Agregar PENDIENTE_APROBACION al ENUM de citas.estado (citas desde portal público)
    const [colEstado] = await pool.query(`
      SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'citas'
        AND COLUMN_NAME  = 'estado'
    `);
    if (colEstado.length && !colEstado[0].COLUMN_TYPE.includes("PENDIENTE_APROBACION")) {
      await pool.query(`
        ALTER TABLE citas
          MODIFY COLUMN estado
            ENUM('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION','COMPLETADA','CANCELADA','NO_ASISTIO','PENDIENTE_APROBACION')
            NOT NULL DEFAULT 'PENDIENTE'
      `);
      console.log("✅ [auto-migrate] citas.estado → PENDIENTE_APROBACION agregado");
    } else {
      console.log("✅ [auto-migrate] citas.estado OK");
    }

    // Columna two_factor_enabled en usuarios (2FA por correo, opcional por usuario)
    const [col2fa] = await pool.query(`
      SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'usuarios'
        AND COLUMN_NAME  = 'two_factor_enabled'
    `);
    if (col2fa[0].n === 0) {
      await pool.query(`
        ALTER TABLE usuarios
          ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0
          COMMENT 'Verificación en dos pasos por correo, activada por el propio usuario'
      `);
      console.log("✅ [auto-migrate] usuarios.two_factor_enabled agregada");
    } else {
      console.log("✅ [auto-migrate] usuarios.two_factor_enabled OK");
    }

    // Columna timezone en clinicas (crons de recordatorios y cumpleaños la usan
    // para calcular "hoy"/"ahora" en la hora local de la clínica, no en UTC del servidor)
    const [colTz] = await pool.query(`
      SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'clinicas'
        AND COLUMN_NAME  = 'timezone'
    `);
    if (colTz[0].n === 0) {
      await pool.query(`
        ALTER TABLE clinicas
          ADD COLUMN timezone VARCHAR(60) DEFAULT 'America/Tegucigalpa'
          COMMENT 'Zona horaria IANA usada por crons y reportes'
      `);
      console.log("✅ [auto-migrate] clinicas.timezone agregada");
    } else {
      console.log("✅ [auto-migrate] clinicas.timezone OK");
    }

    // Calendario de eventos/banners festivos del dashboard (global, todas las clínicas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eventos_festivos (
        id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nombre           VARCHAR(120) NOT NULL,
        emoji            VARCHAR(10)  DEFAULT '🎉',
        mensaje          VARCHAR(200),
        color            VARCHAR(20)  DEFAULT '#1e40af',
        fecha_inicio     DATE NOT NULL,
        fecha_fin        DATE NOT NULL,
        recurrente_anual TINYINT(1)  NOT NULL DEFAULT 1 COMMENT 'Si es 1, se repite cada año usando solo mes/día',
        activo           TINYINT(1)  NOT NULL DEFAULT 1,
        creado_en        DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] eventos_festivos OK");

    // Seed inicial de feriados fijos de Honduras (solo si la tabla está vacía)
    const [[{ n: totalEventos }]] = await pool.query(
      "SELECT COUNT(*) AS n FROM eventos_festivos"
    );
    if (totalEventos === 0) {
      await pool.query(`
        INSERT INTO eventos_festivos
          (nombre, emoji, mensaje, color, fecha_inicio, fecha_fin, recurrente_anual, activo) VALUES
        ('Año Nuevo',                 '🎊', '¡Feliz Año Nuevo!',                '#2563eb', '2025-01-01', '2025-01-01', 1, 1),
        ('Día de las Américas',       '🕊️', 'Feliz Día de las Américas',        '#0ea5e9', '2025-04-14', '2025-04-14', 1, 1),
        ('Día del Trabajador',        '🛠️', 'Feliz Día del Trabajador',         '#f59e0b', '2025-05-01', '2025-05-01', 1, 1),
        ('Día de la Independencia',   '🇭🇳', '¡Feliz Día de la Independencia!',  '#2563eb', '2025-09-15', '2025-09-15', 1, 1),
        ('Día de Morazán',            '⚔️', 'Feliz Día de Morazán',             '#7c3aed', '2025-10-03', '2025-10-03', 1, 1),
        ('Día de la Raza',            '🌎', 'Feliz Día de la Raza',             '#16a34a', '2025-10-12', '2025-10-12', 1, 1),
        ('Día de las Fuerzas Armadas','🎖️', 'Feliz Día de las Fuerzas Armadas', '#475569', '2025-10-21', '2025-10-21', 1, 1),
        ('Navidad',                   '🎄', '¡Feliz Navidad!',                  '#dc2626', '2025-12-24', '2025-12-25', 1, 1)
      `);
      console.log("✅ [auto-migrate] eventos_festivos seed Honduras insertado");
    } else {
      console.log("✅ [auto-migrate] eventos_festivos seed ya existe, omitido");
    }

    // Códigos de un solo uso para 2FA por correo (login y activación)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuario_2fa_codigos (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id  INT UNSIGNED NOT NULL,
        codigo_hash VARCHAR(255) NOT NULL,
        proposito   ENUM('LOGIN','ACTIVAR') NOT NULL DEFAULT 'LOGIN',
        expira_en   DATETIME NOT NULL,
        usado       TINYINT(1) NOT NULL DEFAULT 0,
        creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_u2fa_usuario (usuario_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] usuario_2fa_codigos OK");

    // Tokens de recuperación de contraseña ("olvidé mi contraseña")
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuario_password_reset (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id  INT UNSIGNED NOT NULL,
        token_hash  VARCHAR(255) NOT NULL,
        expira_en   DATETIME NOT NULL,
        usado       TINYINT(1) NOT NULL DEFAULT 0,
        creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_upr_usuario (usuario_id),
        INDEX idx_upr_token (token_hash),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("✅ [auto-migrate] usuario_password_reset OK");

  } catch (e) {
    console.warn("⚠️  [auto-migrate]:", e.message);
  }
})();

app.listen(PORT, () => {
  console.log("✅ Servidor corriendo en puerto", PORT);
});

// ===== CRON: Recordatorios automáticos (cada hora) =====
const enviarRecordatorios = require("./scripts/enviar-recordatorios");
cron.schedule("0 * * * *", async () => {
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  console.log(`⏰ [CRON] ${horaActual} — Verificando recordatorios automáticos...`);
  try {
    await enviarRecordatorios();
  } catch (err) {
    console.error("❌ [CRON] Error en recordatorios:", err.message);
  }
});

// ===== CRON: Facturación mensual de licencias (diario 06:10) =====
const correrFacturacionMensual = require("./scripts/facturacion-mensual");
cron.schedule("10 6 * * *", async () => {
  console.log("💳 [CRON] Facturación mensual de licencias...");
  try {
    await correrFacturacionMensual();
  } catch (err) {
    console.error("❌ [CRON] Error en facturación mensual:", err.message);
  }
});
