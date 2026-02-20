const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

// Directorio base de uploads
const BASE_DIR = path.join(__dirname, "../uploads");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(path.join(BASE_DIR, "pacientes"));

// ── Storage engine ───────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dest = path.join(BASE_DIR, "pacientes");
    ensureDir(dest);
    cb(null, dest);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10);
    cb(null, `${Date.now()}-${rand}${ext}`);
  },
});

// ── Tipos permitidos ─────────────────────────────────────
const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  cb(Object.assign(new Error("Tipo de archivo no permitido. Usa JPG, PNG, WEBP o PDF."), { code: "WRONG_TYPE" }));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter,
});

module.exports = upload;
