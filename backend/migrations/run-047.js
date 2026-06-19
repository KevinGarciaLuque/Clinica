/**
 * run-047.js — Corrige categoría de códigos CIE-10 renales/glomerulares
 * de 'Urología' a 'Nefrología'
 * Ejecutar: node migrations/run-047.js
 */
const mysql = require("mysql2/promise");
const fs    = require("fs");
const path  = require("path");
require("dotenv").config();

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT || 3306),
  });

  console.log("\n🚀 Iniciando migración 047 — fix categorías CIE-10 Nefrología...\n");

  const sql = fs.readFileSync(
    path.join(__dirname, "047_fix_cie10_nefrologia_categoria.sql"),
    "utf8"
  );

  const [result] = await conn.query(sql);
  console.log(`✅  Categorías actualizadas: ${result.affectedRows} códigos CIE-10 cambiados a 'Nefrología'`);

  await conn.end();
  console.log("\n🎉 Migración 047 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
