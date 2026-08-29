/**
 * run-067.js — Columna usuarios.nombre_display (nombre para mostrar del médico)
 * Ejecutar: node migrations/run-067.js
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
  console.log("\n🚀 Migración 067 — usuarios.nombre_display...\n");
  const sqlFile = fs.readFileSync(path.join(__dirname, "067_usuario_nombre_display.sql"), "utf8");
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
  console.log("\n🎉 Migración 067 completada.\n");
}
run().catch(err => { console.error("\n💥 Error fatal:", err.message); process.exit(1); });
