require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, "024_recetas_favoritas.sql"),
    "utf8"
  );
  const statements = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      console.log("OK:", stmt.slice(0, 60).replace(/\s+/g, " "));
    } catch (e) {
      if (e.message.includes("Duplicate column") || e.message.includes("already exists")) {
        console.log("SKIP (ya existe):", stmt.slice(0, 60).replace(/\s+/g, " "));
      } else {
        console.error("Error:", e.message);
      }
    }
  }
  console.log("✅ Migración 024 completa");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
