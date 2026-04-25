/**
 * Migración 033 — Crea la tabla verificaciones_email
 * Uso: node migrations/run-033.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../db");
const fs   = require("fs");
const path = require("path");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "033_verificaciones_email.sql"), "utf8");
    await pool.query(sql);
    console.log("✅ Tabla verificaciones_email creada (o ya existía)");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
