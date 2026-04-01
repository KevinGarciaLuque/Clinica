/**
 * Ejecuta la migración 014 — catalogos_estudios
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "014_catalogos_estudios.sql"), "utf8");
    const stmts = sql.split(";").map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      await pool.query(stmt);
    }
    console.log("✓ Migración 014 ejecutada correctamente");
    process.exit(0);
  } catch (err) {
    console.error("✗ Error ejecutando migración 014:", err.message);
    process.exit(1);
  }
})();
