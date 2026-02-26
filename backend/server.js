const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const path    = require("path");
require("dotenv").config();

const app = express();

// ===== CORS preparado para dominio =====
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, cb) {
      // Permite requests sin origin (Postman) o localhost
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS bloqueado: " + origin));
    },
    credentials: true,
  })
);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== Archivos estáticos de uploads =====
// Protegido: sólo cuando el usuario tiene sesión (el frontend usa /api/pacientes/:id/documentos/:docId/view)
// La carpeta uploads/ NO se expone directamente al público
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== Middleware Multi-clínica SIMPLE =====
// Hoy: por header (x-clinica-id o x-clinica-slug)
// Mañana: por subdominio cuando tengas dominio
app.use((req, res, next) => {
  const mode = process.env.TENANT_MODE || "header";

  if (mode === "subdomain") {
    const host = (req.headers.host || "").split(":")[0]; // sin puerto
    const parts = host.split(".");
    const subdomain = parts.length >= 3 ? parts[0] : null; // clinica1.tudominio.com
    req.tenant = {
      slug: subdomain || null,
      clinica_id: null,
      source: "subdomain",
    };
    return next();
  }

  // header mode (ideal en dev)
  const clinica_id = req.headers["x-clinica-id"] || null;
  const slug = req.headers["x-clinica-slug"] || null;

  req.tenant = {
    clinica_id: clinica_id ? Number(clinica_id) : null,
    slug: slug ? String(slug) : null,
    source: "header",
  };

  next();
});

// ===== Rutas =====
app.get("/", (req, res) => {
  res.json({
    ok: true,
    msg: "API Clínica funcionando",
    tenant: req.tenant,
  });
});

app.use("/api/auth",           require("./routes/auth"));
app.use("/api/clinicas",       require("./routes/clinicas"));
app.use("/api/usuarios",       require("./routes/usuarios"));
app.use("/api/horarios",       require("./routes/horarios"));
app.use("/api/servicios",      require("./routes/servicios"));
app.use("/api/pacientes",      require("./routes/pacientes"));
// Documentos anidados bajo pacientes
app.use("/api/pacientes/:pacienteId/documentos", require("./routes/documentos"));
app.use("/api/citas",          require("./routes/citas"));
app.use("/api/ia",             require("./routes/ia"));
app.use("/api/dashboard",      require("./routes/dashboard"));
app.use("/api/historias",      require("./routes/historias"));
app.use("/api/prescripciones", require("./routes/prescripciones"));
app.use("/api/estudios",       require("./routes/estudios"));
app.use("/api/medicamentos",   require("./routes/medicamentos"));
// Registro público self-service (sin auth)
app.use("/api/registro",       require("./routes/registro"));

// ===== Manejo de errores =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, msg: err.message || "Error interno" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Servidor corriendo en puerto", PORT));
