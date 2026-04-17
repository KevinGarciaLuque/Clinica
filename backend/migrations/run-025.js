// Ejecutar: node migrations/run-025.js  (desde /backend)
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, "025_medicamentos_favoritos.sql"),
    "utf8"
  );
  const stmts = sql.split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    console.log("Ejecutando:", stmt.slice(0, 80) + "…");
    await pool.query(stmt);
  }
  console.log("✅ Migración 025 completada");
  process.exit(0);
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
