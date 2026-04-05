/**
 * run-018.js — Migración: Solicitudes de Activación de Licencia
 * node backend/migrations/run-018.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../db");
const fs   = require("fs");
const path = require("path");

async function run() {
  console.log("▶ Ejecutando migración 018_solicitudes_licencia...");
  const sql = fs.readFileSync(path.join(__dirname, "018_solicitudes_licencia.sql"), "utf8");
  const stmts = sql
    .split(";")
    .map(s =>
      s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim()
    )
    .filter(s => s.length > 0);

  for (const stmt of stmts) {
    try {
      await pool.query(stmt);
      console.log("  ✓", stmt.slice(0, 70).replace(/\n/g, " ") + "...");
    } catch (e) {
      if (e.code === "ER_TABLE_EXISTS_ERROR") {
        console.log("  (tabla ya existe, saltando)");
      } else {
        console.error("  ✗ Error:", e.message);
        throw e;
      }
    }
  }

  console.log("✅ Migración 018 completada.");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
