/**
 * run-074.js — Facturación de licencias (contrato + recibos mensuales)
 * Ejecutar: node migrations/run-074.js
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const TOLERABLE_CODES = new Set(["ER_DUP_FIELDNAME", "ER_TABLE_EXISTS_ERROR", "ER_DUP_ENTRY", "ER_DUP_KEYNAME"]);
const TOLERABLE_ERRNOS = new Set([1060, 1050, 1061, 1062]);

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, port: Number(process.env.DB_PORT || 3306),
  });
  console.log("\n🚀 Migración 074 — facturación de licencias...\n");
  const sqlFile = fs.readFileSync(path.join(__dirname, "074_pdf_error_licencias.sql"), "utf8");
  const statements = sqlFile.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 90);
    try {
      const [r] = await conn.query(stmt);
      console.log(`✅ ${preview}... (${r.affectedRows ?? 0} filas)`);
    } catch (e) {
      if (TOLERABLE_CODES.has(e.code) || TOLERABLE_ERRNOS.has(e.errno)) console.log(`⚠️  ya aplicado (${e.code}): ${preview}...`);
      else { console.error(`💥 Error en: ${preview}...`); throw e; }
    }
  }
  await conn.end();
  console.log("\n🎉 Migración 074 completada.\n");
}
run().catch(err => { console.error("\n💥 Error fatal:", err.message); process.exit(1); });
