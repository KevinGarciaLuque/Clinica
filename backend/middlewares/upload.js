const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

// Directorio base de uploads
const BASE_DIR = path.join(__dirname, "../uploads");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(path.join(BASE_DIR, "pacientes"));
ensureDir(path.join(BASE_DIR, "clinicas"));
ensureDir(path.join(BASE_DIR, "sistema"));

// ── Storage engine para pacientes (memory → Cloudinary) ─────────────────
const storagePacientes = multer.memoryStorage();

// ── Storage engine para logos de clínica ───────────────────────────────
const storageClinicas = multer.diskStorage({
  destination(req, file, cb) {
    const dest = path.join(BASE_DIR, "clinicas");
    ensureDir(dest);
    cb(null, dest);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10);
    cb(null, `logo-${Date.now()}-${rand}${ext}`);
  },
});

// ── Tipos permitidos ─────────────────────────────────────
const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
];

const ALLOWED_IMAGE_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  cb(Object.assign(new Error("Tipo de archivo no permitido. Usa JPG, PNG, WEBP o PDF."), { code: "WRONG_TYPE" }));
};

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIME.includes(file.mimetype)) return cb(null, true);
  cb(Object.assign(new Error("Tipo de archivo no permitido. Usa JPG, PNG, WEBP o GIF."), { code: "WRONG_TYPE" }));
};

const uploadPacientes = multer({
  storage: storagePacientes,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo
  fileFilter,
});

const uploadClinicas = multer({
  storage: storageClinicas,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// ── Storage engine para comprobantes de transferencia (memory → Cloudinary) ──
const uploadComprobante = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo
  fileFilter,
});

// ── Storage engine para assets del sistema (logo, fondo login) ────────────
const storageSistema = multer.diskStorage({
  destination(req, file, cb) {
    const dest = path.join(BASE_DIR, "sistema");
    ensureDir(dest);
    cb(null, dest);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10);
    cb(null, `sistema-${Date.now()}-${rand}${ext}`);
  },
});

const uploadSistema = multer({
  storage: storageSistema,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB para fondos/logos
  fileFilter: imageFilter,
});

// Memory storage para logo/fondo del sistema → se guarda como base64 en la BD
const uploadSistemaMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

module.exports = uploadPacientes;
module.exports.uploadPacientes     = uploadPacientes;
module.exports.uploadClinicas      = uploadClinicas;
module.exports.uploadSistema       = uploadSistema;
module.exports.uploadSistemaMemory = uploadSistemaMemory;
module.exports.uploadComprobante   = uploadComprobante;
