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