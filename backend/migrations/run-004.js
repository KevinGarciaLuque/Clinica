/**
 * Ejecuta la migración 004  — Registro de pacientes
 * Uso:  node migrations/run-004.js
 */
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, "004_registro_pacientes.sql"),
    "utf8"
  );

  // Dividir en sentencias individuales (eliminar comentarios de línea)
  const statements = sql
    .split(";")
    .map(s => s.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);

  console.log(`\n🔄  Ejecutando ${statements.length} sentencias SQL...\n`);

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      const resumen = stmt.slice(0, 60).replace(/\s+/g, " ");
      console.log(`  ✅  ${resumen}…`);
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME" || e.code === "ER_TABLE_EXISTS_ERROR") {
        console.log(`  ⏭️  Ya existe (omitido): ${e.message.slice(0, 80)}`);
      } else {
        console.error(`  ❌  Error: ${e.message}`);
      }
    }
  }

  console.log("\n✅  Migración 004 finalizada.\n");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
