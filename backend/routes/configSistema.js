const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const { uploadSistemaMemory } = require("../middlewares/upload");

const DEFAULTS = {
  nombre_sistema:   "KG-Medic",
  subtitulo:        "Sistema de gestión clínica",
  logo_url:         "",
  icono_bootstrap:  "bi-hospital",
  fondo_login_url:  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1920&q=80",
  copyright_texto:  "KG-Medic · Todos los derechos reservados",
  color_primario:   "#3b82f6",
  color_nombre1:    "#ffffff",
  color_nombre2:    "#2D6BE8",
};

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS config_sistema (
      clave   VARCHAR(80)  NOT NULL PRIMARY KEY,
      valor   MEDIUMTEXT   NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // Ampliar columna si la tabla ya existía con TEXT (< 64KB)
  await pool.query(`
    ALTER TABLE config_sistema MODIFY COLUMN valor MEDIUMTEXT NOT NULL
  `).catch(() => {});
  // Insertar defaults si no existen
  for (const [clave, valor] of Object.entries(DEFAULTS)) {
    await pool.query(
      `INSERT IGNORE INTO config_sistema (clave, valor) VALUES (?, ?)`,
      [clave, valor]
    );
  }
  schemaReady = true;
}

function rowsToObj(rows) {
  const obj = { ...DEFAULTS };
  for (const r of rows) {
    obj[r.clave] = r.valor;
  }
  return obj;
}

// ── GET /api/config-sistema  (público, sin auth) ─────────────────────────
router.get("/", async (req, res) => {
  try {
    await ensureSchema();
    const [rows] = await pool.query("SELECT clave, valor FROM config_sistema");
    res.json({ ok: true, data: rowsToObj(rows) });
  } catch (e) {
    console.error("[config-sistema GET]", e);
    res.json({ ok: true, data: DEFAULTS }); // fallback silencioso
  }
});

// ── PUT /api/config-sistema  (solo SUPER_ADMIN) ───────────────────────────
router.put("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureSchema();
    const campos = [
      "nombre_sistema", "subtitulo", "icono_bootstrap",
      "fondo_login_url", "copyright_texto", "color_primario",
      "color_nombre1", "color_nombre2",
    ];
    for (const c of campos) {
      if (req.body[c] !== undefined) {
        await pool.query(
          `INSERT INTO config_sistema (clave, valor) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
          [c, String(req.body[c])]
        );
      }
    }
    const [rows] = await pool.query("SELECT clave, valor FROM config_sistema");
    res.json({ ok: true, data: rowsToObj(rows) });
  } catch (e) {
    console.error("[config-sistema PUT]", e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/config-sistema/upload-logo  (solo SUPER_ADMIN) ─────────────
router.post(
  "/upload-logo",
  auth("SUPER_ADMIN"),
  uploadSistemaMemory.single("logo"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });
      await ensureSchema();
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      await pool.query(
        `INSERT INTO config_sistema (clave, valor) VALUES ('logo_url', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [dataUrl]
      );
      res.json({ ok: true, url: dataUrl });
    } catch (e) {
      console.error("[config-sistema upload-logo]", e);
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── POST /api/config-sistema/upload-fondo  (solo SUPER_ADMIN) ────────────
router.post(
  "/upload-fondo",
  auth("SUPER_ADMIN"),
  uploadSistemaMemory.single("fondo"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });
      await ensureSchema();
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      await pool.query(
        `INSERT INTO config_sistema (clave, valor) VALUES ('fondo_login_url', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [dataUrl]
      );
      res.json({ ok: true, url: dataUrl });
    } catch (e) {
      console.error("[config-sistema upload-fondo]", e);
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── DELETE /api/config-sistema/logo  (solo SUPER_ADMIN) ─────────────────
router.delete("/logo", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO config_sistema (clave, valor) VALUES ('logo_url', '')
       ON DUPLICATE KEY UPDATE valor = ''`
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
