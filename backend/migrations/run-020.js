// Ejecutar migración 020 - Módulo Vacunas
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const fs   = require("fs");
const pool = require("../db");

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, "020_modulo_vacunas.sql"), "utf8");
  const statements = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      console.log("✅ OK:", stmt.substring(0, 60).replace(/\n/g, " ") + "...");
    } catch (e) {
      if (e.code === "ER_TABLE_EXISTS_ERROR") {
        console.log("⚠️  Tabla ya existe, continuando...");
      } else {
        console.error("❌ Error:", e.message);
        console.error("   SQL:", stmt.substring(0, 100));
      }
    }
  }

  console.log("\n✅ Migración 020 completada");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
