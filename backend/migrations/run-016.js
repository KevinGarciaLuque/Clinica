/**
 * Migración 016 — Agregar campos de responsable, aseguradora y datos complementarios
 */
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

async function run() {
  console.log("⏳ Ejecutando migración 016 — Datos del Responsable...");
  const sql = fs.readFileSync(path.join(__dirname, "016_datos_responsable.sql"), "utf8");
  const statements = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      console.log("  ✅", stmt.substring(0, 60) + "...");
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME" || e.message.includes("Duplicate column")) {
        console.log("  ⚠️ Columna ya existe, saltando...");
      } else {
        console.error("  ❌ Error:", e.message);
      }
    }
  }

  console.log("✅ Migración 016 completada");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
