const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

const app = express();

// ===== CORS =====
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

console.log("🔍 CORS_ORIGINS configured:", allowedOrigins);

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

console.log("⚠️ CORS configurado en modo PERMISIVO (temporal)");

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ===== Seguridad =====
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(morgan("dev"));
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
app.use("/api/registro", require("./routes/registro"));
app.use("/api/database", require("./routes/database"));
app.use("/api/galeria-estetica", require("./routes/galeriaEstetica"));
app.use("/api/setup", require("./routes/setup"));

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
app.listen(PORT, () => {
  console.log("✅ Servidor corriendo en puerto", PORT);
});

console.log(import.meta.env.VITE_API_URL)