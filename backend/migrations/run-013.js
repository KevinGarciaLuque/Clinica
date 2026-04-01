/**
 * Migración 013: Catálogos de diagnóstico y campos default en medicamentos
 * Ejecutar: node backend/migrations/run-013.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "013_catalogos.sql"), "utf8");
    const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        console.log("✓ Ejecutado:", stmt.substring(0, 60) + "…");
      } catch (e) {
        if (e.code === "ER_DUP_COLUMN" || e.code === "ER_TABLE_EXISTS_ERROR") {
          console.log("⊘ Ya existe:", stmt.substring(0, 60) + "…");
        } else {
          throw e;
        }
      }
    }
    console.log("\n✅ Migración 013 completada");
  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    process.exit(0);
  }
}

run();
