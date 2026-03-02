/**
 * routes/database.js
 * Exportar / Importar la base de datos en formato .sql
 * Solo accesible por SUPER_ADMIN
 */

const router = require("express").Router();
const auth   = require("../middlewares/auth");
const pool   = require("../db");
const { exec, execSync } = require("child_process");
const multer = require("multer");
const path   = require("path");
const fs     = require("fs");
const os     = require("os");
require("dotenv").config();

/* ── Detectar ruta de mysqldump/mysql ─────────────────────────────
   Orden: variable de entorno → PATH → rutas comunes en Windows
──────────────────────────────────────────────────────────────────── */
const MYSQL_COMMON_PATHS = [
  "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin",
  "C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin",
  "C:\\xampp\\mysql\\bin",
  "C:\\wamp64\\bin\\mysql\\mysql8.0\\bin",
  "C:\\laragon\\bin\\mysql\\mysql-8.0\\bin",
  "C:\\Program Files\\MySQL\\MySQL Server 9.3\\bin",
  "/usr/bin",
  "/usr/local/bin",
  "/opt/homebrew/bin",
];

function findMysqlBin(exe) {
  // 1. Variable de entorno MYSQL_BIN_PATH
  if (process.env.MYSQL_BIN_PATH) {
    return path.join(process.env.MYSQL_BIN_PATH, exe);
  }
  // 2. En el PATH del sistema
  try {
    const cmd = os.platform() === "win32" ? `where ${exe}` : `which ${exe}`;
    const result = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (result) return result.split(/\r?\n/)[0].trim();
  } catch {}
  // 3. Rutas comunes
  for (const dir of MYSQL_COMMON_PATHS) {
    const full = path.join(dir, os.platform() === "win32" ? `${exe}.exe` : exe);
    if (fs.existsSync(full)) return full;
  }
  return exe; // fallback, dejará que el OS intente resolverlo
}

/* ── Storage temporal para los archivos .sql subidos ── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename:    (req, file, cb) => cb(null, `import_${Date.now()}.sql`),
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB máx
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/sql" || path.extname(file.originalname).toLowerCase() === ".sql") {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos .sql"));
    }
  },
});

/* ─────────────────────────────────────────────────────────
   GET /api/database/info
   Devuelve metadatos: tamaño de tablas, conteos, versión
──────────────────────────────────────────────────────────── */
router.get("/info", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const db = process.env.DB_NAME;

    const [version]    = await pool.query("SELECT VERSION() AS ver");
    const [tableStats] = await pool.query(`
      SELECT
        TABLE_NAME        AS name,
        TABLE_ROWS        AS rows_approx,
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 2) AS size_kb,
        CREATE_TIME       AS created_at
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY DATA_LENGTH + INDEX_LENGTH DESC
    `, [db]);

    const [[{ total_size_kb }]] = await pool.query(`
      SELECT ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024, 2) AS total_size_kb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
    `, [db]);

    res.json({
      ok: true,
      data: {
        database: db,
        mysql_version: version[0].ver,
        total_size_kb: total_size_kb ?? 0,
        tables: tableStats,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/database/export
   Genera y descarga un volcado completo en .sql
──────────────────────────────────────────────────────────── */
router.get("/export", auth("SUPER_ADMIN"), (req, res) => {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  // Construir nombre de archivo con fecha legible: DBClinica_2026-02-26_21-30.sql
  const now   = new Date();
  const fecha = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const hora  = `${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}`;
  const filename = `DBClinica_${fecha}_${hora}.sql`;
  const outPath  = path.join(os.tmpdir(), filename);

  /* mysqldump opciones profesionales */
  const mysqldumpBin = findMysqlBin("mysqldump");
  console.log("[DB Export] Using mysqldump:", mysqldumpBin);
  const cmd = [
    `"${mysqldumpBin}"`,
    `--host=${DB_HOST || "127.0.0.1"}`,
    `--port=${DB_PORT || 3306}`,
    `--user=${DB_USER}`,
    "--single-transaction",
    "--routines",
    "--triggers",
    "--add-drop-table",
    "--create-options",
    "--set-charset",
    "--comments",
    "--column-statistics=0",
    "--no-tablespaces",
    `--result-file="${outPath}"`,
    DB_NAME,
  ].join(" ");

  // Pasar contraseña por variable de entorno (evita problemas de comillas en Windows)
  const execEnv = { ...process.env, MYSQL_PWD: DB_PASSWORD || "" };

  exec(cmd, { shell: true, env: execEnv }, (err, _stdout, stderr) => {
    if (err) {
      console.error("mysqldump error:", err.message, stderr);
      return res.status(500).json({ ok: false, msg: "Error al generar el backup: " + (stderr || err.message) });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/sql");

    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on("end", () => {
      fs.unlink(outPath, () => {}); // limpiar temporal
    });
    stream.on("error", (e) => {
      console.error("Error al leer dump:", e);
      if (!res.headersSent) res.status(500).json({ ok: false, msg: "Error al leer el archivo" });
    });
  });
});

/* ─────────────────────────────────────────────────────────
   POST /api/database/import
   Recibe un .sql y lo ejecuta sobre la BD actual
──────────────────────────────────────────────────────────── */
router.post("/import", auth("SUPER_ADMIN"), upload.single("sql_file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, msg: "No se recibió ningún archivo .sql" });
  }

  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  const sqlPath = req.file.path;

  const mysqlBin = findMysqlBin("mysql");
  const cmd = [
    `"${mysqlBin}"`,
    `--host=${DB_HOST || "127.0.0.1"}`,
    `--port=${DB_PORT || 3306}`,
    `--user=${DB_USER}`,
    "--default-character-set=utf8mb4",
    DB_NAME,
    `< "${sqlPath}"`,
  ].join(" ");

  const execEnv = { ...process.env, MYSQL_PWD: DB_PASSWORD || "" };

  exec(cmd, { shell: true, env: execEnv }, (err, _stdout, stderr) => {
    fs.unlink(sqlPath, () => {}); // limpiar siempre

    if (err) {
      console.error("mysql import error:", stderr || err.message);
      return res.status(500).json({ ok: false, msg: "Error al importar: " + (stderr || err.message) });
    }

    res.json({ ok: true, msg: "Base de datos importada correctamente." });
  });
});

/* ─────────────────────────────────────────────────────────
   POST /api/database/truncate
   Vacía todos los datos EXCEPTO usuarios ADMIN y SUPER_ADMIN
──────────────────────────────────────────────────────────── */
router.post("/truncate", auth("SUPER_ADMIN"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const db = process.env.DB_NAME;

    // 1. Obtener todas las tablas excepto 'usuarios'
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME != 'usuarios'
       ORDER BY TABLE_NAME`,
      [db]
    );

    await conn.beginTransaction();

    // 2. Deshabilitar FK para truncar sin restricciones
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    // 3. Truncar todas las tablas (excepto usuarios)
    for (const { TABLE_NAME } of tables) {
      await conn.query(`TRUNCATE TABLE \`${TABLE_NAME}\``);
    }

    // 4. En usuarios: eliminar solo los que NO son ADMIN ni SUPER_ADMIN
    await conn.query(
      `DELETE FROM usuarios WHERE tipo NOT IN ('ADMIN', 'SUPER_ADMIN')`
    );

    // 5. Rehabilitar FK
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    await conn.commit();

    res.json({
      ok: true,
      msg: `Base de datos vaciada correctamente. Se eliminaron ${tables.length} tablas de datos. Los usuarios administradores fueron conservados.`,
      tables_cleared: tables.length,
    });
  } catch (e) {
    await conn.rollback().catch(() => {});
    await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
    console.error("truncate error:", e);
    res.status(500).json({ ok: false, msg: "Error al vaciar la base de datos: " + e.message });
  } finally {
    conn.release();
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/database/backups/history  (historial en memoria)
──────────────────────────────────────────────────────────── */
// Simple registro en memoria (se pierde al reiniciar — extensión futura: guardar en BD)
const backupLog = [];
router.get("/history", auth("SUPER_ADMIN"), (req, res) => {
  res.json({ ok: true, data: backupLog.slice().reverse() });
});

module.exports = router;
