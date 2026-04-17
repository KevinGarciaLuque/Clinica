// Ejecuta la migración 023: seed de medicamentos comunes en Honduras
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, "023_medicamentos_honduras_seed.sql"),
    "utf8"
  );
  // Dividir por ";" y ejecutar cada sentencia
  const statements = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith("--"));

  let ok = 0, skip = 0;
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY" || e.message.includes("Duplicate")) {
        skip++;
      } else {
        console.error("Error en sentencia:", e.message.slice(0, 120));
      }
    }
  }
  console.log(`✅ Migración 023 completa: ${ok} sentencias OK, ${skip} duplicadas ignoradas`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
