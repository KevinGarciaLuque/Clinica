const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
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

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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

app.use("/api/auth", require("./routes/auth"));
app.use("/api/clinicas", require("./routes/clinicas"));
app.use("/api/pacientes", require("./routes/pacientes"));
app.use("/api/citas", require("./routes/citas"));
app.use("/api/ia", require("./routes/ia"));

// ===== Manejo de errores =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, msg: err.message || "Error interno" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Servidor corriendo en puerto", PORT));
