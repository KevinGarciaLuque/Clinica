const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const cron = require("node-cron");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();

// ===== CORS =====
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: true, // TEMPORAL: Permite todos los origins para debug
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-clinica-id",
    "x-clinica-slug",
  ],
  optionsSuccessStatus: 204,
};

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

app.use(morgan("dev", {
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
app.use("/api/auth", require("./routes/auth"));
app.use("/api/clinicas", require("./routes/clinicas"));
app.use("/api/usuarios", require("./routes/usuarios"));
app.use("/api/horarios", require("./routes/horarios"));
app.use("/api/servicios", require("./routes/servicios"));
app.use("/api/pacientes", require("./routes/pacientes"));
app.use("/api/pacientes/:pacienteId/documentos", require("./routes/documentos"));
app.use("/api/citas", require("./routes/citas"));
app.use("/api/ia", require("./routes/ia"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/historias", require("./routes/historias"));
app.use("/api/prescripciones", require("./routes/prescripciones"));
app.use("/api/estudios", require("./routes/estudios"));
app.use("/api/medicamentos", require("./routes/medicamentos"));
app.use("/api/catalogos-diagnostico", require("./routes/catalogosDiagnostico"));
app.use("/api/catalogos-estudios", require("./routes/catalogosEstudios"));
app.use("/api/registro", require("./routes/registro"));
app.use("/api/database", require("./routes/database"));
app.use("/api/galeria-estetica", require("./routes/galeriaEstetica"));
app.use("/api/recordatorios", require("./routes/recordatorios"));
app.use("/api/crecimiento", require("./routes/crecimiento"));
app.use("/api/setup",     require("./routes/setup"));
app.use("/api/reportes",  require("./routes/reportes"));
app.use("/api/vacunas",   require("./routes/vacunas"));
app.use("/api/soporte",   require("./routes/soporte"));
app.use("/rx",            require("./routes/rx"));

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
  } catch (e) {
    console.warn("⚠️  [auto-migrate] verificaciones_email:", e.message);
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