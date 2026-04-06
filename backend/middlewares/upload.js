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

// ── Storage engine para pacientes ───────────────────────────────────────
const storagePacientes = multer.diskStorage({
  destination(req, file, cb) {
    const dest = path.join(BASE_DIR, "pacientes");
    ensureDir(dest);
    cb(null, dest);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const now  = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, "0");
    const dd   = String(now.getDate()).padStart(2, "0");
    const hh   = String(now.getHours()).padStart(2, "0");
    const min  = String(now.getMinutes()).padStart(2, "0");
    const ss   = String(now.getSeconds()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 6);
    cb(null, `${yyyy}-${mm}-${dd}_${hh}${min}${ss}-${rand}${ext}`);
  },
});

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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB máximo para logos
  fileFilter: imageFilter,
});

module.exports = uploadPacientes;
module.exports.uploadPacientes = uploadPacientes;
module.exports.uploadClinicas = uploadClinicas;
