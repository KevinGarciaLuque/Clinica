/**
 * run-048.js — Agrega diagnostico_desc a historias para diagnósticos libres
 * Ejecutar: node migrations/run-048.js
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  console.log("\n🚀 Iniciando migración 048...\n");

  try {
    await conn.query("ALTER TABLE historias ADD COLUMN diagnostico_desc TEXT NULL AFTER diagnostico_cie");
    console.log("✅  Columna diagnostico_desc agregada a historias");
  } catch (e) {
    if (e.errno === 1060) console.log("⚠️  diagnostico_desc ya existe, saltando");
    else throw e;
  }

  await conn.end();
  console.log("\n🎉 Migración 048 completada.\n");
}

run().catch(err => { console.error("\n💥 Error fatal:", err.message); process.exit(1); });
