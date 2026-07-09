/**
 * run-052.js — Módulo "Educación en Diabetes"
 * Ejecutar: node migrations/run-052.js
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
  });

  console.log("\n🚀 Iniciando migración 052 — Módulo Educación en Diabetes...\n");

  const sql = fs.readFileSync(path.join(__dirname, "052_modulo_educacion_diabetes.sql"), "utf8");
  await conn.query(sql);

  const [[modulo]] = await conn.query("SELECT * FROM modulos_sistema WHERE clave='educacion_diabetes'");
  console.log("✅ Módulo registrado:", modulo ? `${modulo.nombre} (para_normal=${modulo.para_normal})` : "NO ENCONTRADO");

  const [tablas] = await conn.query("SHOW TABLES LIKE '%educacion_diabetes%'");
  console.log("✅ Tablas creadas:", tablas.map(t => Object.values(t)[0]).join(", "));

  await conn.end();
  console.log("\n🎉 Migración 052 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
