const express     = require("express");
const router      = express.Router();
const multer      = require("multer");
const path        = require("path");
const fs          = require("fs");
const pool        = require("../db");
const auth        = require("../middlewares/auth");
const cloudinary  = require("../utils/cloudinary");
const streamifier = require("streamifier");

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.includes(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error("Usa una imagen JPG, PNG, WEBP o GIF."), { code: "WRONG_TYPE" }));
  },
});

const LOCAL_DIR = path.join(__dirname, "../uploads/marketing-medico");

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_medico_items (
      id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      tipo               ENUM('post','video','plan') NOT NULL,
      titulo             VARCHAR(200) NOT NULL,
      descripcion        TEXT,
      media_url          VARCHAR(600),
      media_public_id    VARCHAR(255),
      enlace_url         VARCHAR(600),
      precio             VARCHAR(80),
      features           JSON,
      destacado          TINYINT(1) NOT NULL DEFAULT 0,
      orden              INT NOT NULL DEFAULT 0,
      activo             TINYINT(1) NOT NULL DEFAULT 1,
      creado_en          DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mmi_tipo (tipo, activo, orden)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  schemaReady = true;
}
ensureSchema().catch(() => {});

const jsonOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "string") { try { return JSON.stringify(JSON.parse(v)); } catch { return JSON.stringify([v]); } }
  return JSON.stringify(v);
};

async function subirImagen(file) {
  if (USE_CLOUDINARY) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "clinica/marketing-medico", resource_type: "image" },
        (err, r) => (err ? reject(err) : resolve(r))
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });
    return { url: result.secure_url, public_id: result.public_id };
  }
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const ext = file.mimetype === "image/png" ? ".png"
    : file.mimetype === "image/webp" ? ".webp"
    : file.mimetype === "image/gif" ? ".gif" : ".jpg";
  const name = `mm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  fs.writeFileSync(path.join(LOCAL_DIR, name), file.buffer);
  return { url: `/uploads/marketing-medico/${name}`, public_id: null };
}

async function borrarImagen(public_id, url) {
  if (public_id) { try { await cloudinary.uploader.destroy(public_id); } catch { /* ignorar */ } return; }
  if (url && url.startsWith("/uploads/marketing-medico/")) {
    const fp = path.join(__dirname, "..", url.replace(/^\//, ""));
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch { /* ignorar */ }
  }
}

function normaliza(row) {
  let features = [];
  if (row.features) { try { features = typeof row.features === "string" ? JSON.parse(row.features) : row.features; } catch { features = []; } }
  return { ...row, features, destacado: !!row.destacado, activo: !!row.activo };
}

// ── PÚBLICO ──────────────────────────────────────────────────────────────────
// GET /api/marketing-medico  → { posts:[], videos:[], planes:[] } solo activos
router.get("/", async (req, res) => {
  try {
    await ensureSchema();
    const [rows] = await pool.query(
      "SELECT * FROM marketing_medico_items WHERE activo = 1 ORDER BY orden ASC, id ASC"
    );
    const items = rows.map(normaliza);
    res.json({
      ok: true,
      data: {
        posts:  items.filter(i => i.tipo === "post"),
        videos: items.filter(i => i.tipo === "video"),
        planes: items.filter(i => i.tipo === "plan"),
      },
    });
  } catch (e) {
    console.error("[marketing-medico GET]", e);
    res.json({ ok: true, data: { posts: [], videos: [], planes: [] } });
  }
});

// ── ADMIN (SUPER_ADMIN) ──────────────────────────────────────────────────────
router.get("/admin", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureSchema();
    const [rows] = await pool.query("SELECT * FROM marketing_medico_items ORDER BY tipo ASC, orden ASC, id ASC");
    res.json({ ok: true, data: rows.map(normaliza) });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.post("/", auth("SUPER_ADMIN"), upload.single("imagen"), async (req, res) => {
  try {
    await ensureSchema();
    const { tipo, titulo } = req.body;
    if (!["post", "video", "plan"].includes(tipo)) return res.status(400).json({ ok: false, msg: "tipo inválido" });
    if (!titulo) return res.status(400).json({ ok: false, msg: "El título es obligatorio" });

    let media_url = req.body.media_url || null;
    let media_public_id = null;
    if (req.file) {
      const up = await subirImagen(req.file);
      media_url = up.url; media_public_id = up.public_id;
    }

    const [r] = await pool.query(
      `INSERT INTO marketing_medico_items
        (tipo, titulo, descripcion, media_url, media_public_id, enlace_url, precio, features, destacado, orden, activo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        tipo, titulo, req.body.descripcion || null,
        media_url, media_public_id, req.body.enlace_url || null,
        req.body.precio || null, jsonOrNull(req.body.features),
        req.body.destacado === "1" || req.body.destacado === "true" ? 1 : 0,
        Number(req.body.orden) || 0,
        req.body.activo === "0" || req.body.activo === "false" ? 0 : 1,
      ]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.put("/:id", auth("SUPER_ADMIN"), upload.single("imagen"), async (req, res) => {
  try {
    await ensureSchema();
    const [[row]] = await pool.query("SELECT * FROM marketing_medico_items WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrado" });

    let media_url = req.body.media_url !== undefined ? (req.body.media_url || null) : row.media_url;
    let media_public_id = row.media_public_id;
    if (req.file) {
      await borrarImagen(row.media_public_id, row.media_url);
      const up = await subirImagen(req.file);
      media_url = up.url; media_public_id = up.public_id;
    }

    await pool.query(
      `UPDATE marketing_medico_items SET
        tipo=?, titulo=?, descripcion=?, media_url=?, media_public_id=?, enlace_url=?,
        precio=?, features=?, destacado=?, orden=?, activo=?
       WHERE id=?`,
      [
        req.body.tipo || row.tipo,
        req.body.titulo ?? row.titulo,
        req.body.descripcion !== undefined ? (req.body.descripcion || null) : row.descripcion,
        media_url, media_public_id,
        req.body.enlace_url !== undefined ? (req.body.enlace_url || null) : row.enlace_url,
        req.body.precio !== undefined ? (req.body.precio || null) : row.precio,
        req.body.features !== undefined ? jsonOrNull(req.body.features) : row.features,
        req.body.destacado !== undefined ? (req.body.destacado === "1" || req.body.destacado === "true" ? 1 : 0) : row.destacado,
        req.body.orden !== undefined ? (Number(req.body.orden) || 0) : row.orden,
        req.body.activo !== undefined ? (req.body.activo === "0" || req.body.activo === "false" ? 0 : 1) : row.activo,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.delete("/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureSchema();
    const [[row]] = await pool.query("SELECT media_public_id, media_url FROM marketing_medico_items WHERE id=?", [req.params.id]);
    if (row) await borrarImagen(row.media_public_id, row.media_url);
    await pool.query("DELETE FROM marketing_medico_items WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
