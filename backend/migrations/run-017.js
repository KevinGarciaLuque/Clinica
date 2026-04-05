/**
 * run-017.js — Migración: Sistema de Licencias por Clínica
 * node backend/migrations/run-017.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../db");
const fs   = require("fs");
const path = require("path");

async function run() {
  console.log("▶ Ejecutando migración 017_licencias...");
  const sql = fs.readFileSync(path.join(__dirname, "017_licencias.sql"), "utf8");
  const stmts = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  for (const stmt of stmts) {
    try {
      await pool.query(stmt);
      console.log("  ✓", stmt.slice(0, 60).replace(/\n/g, " ") + "...");
    } catch (e) {
      // Ignorar "column already exists"
      if (e.code === "ER_DUP_FIELDNAME" || e.code === "ER_TABLE_EXISTS_ERROR") {
        console.log("  (ya existe, saltando)");
      } else {
        console.error("  ✗ Error:", e.message);
        throw e;
      }
    }
  }

  console.log("✅ Migración 017 completada.");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
