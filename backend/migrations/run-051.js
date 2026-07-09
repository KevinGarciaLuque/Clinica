/**
 * run-051.js — Módulo "Control de Seguimiento" (Endocrinología / DM1)
 * Ejecutar: node migrations/run-051.js
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

  console.log("\n🚀 Iniciando migración 051 — Módulo Control de Seguimiento (Endocrinología)...\n");

  const sql = fs.readFileSync(path.join(__dirname, "051_modulo_endocrinologia.sql"), "utf8");
  await conn.query(sql);

  const [[modulo]] = await conn.query("SELECT * FROM modulos_sistema WHERE clave='control_seguimiento_dm1'");
  console.log("✅ Módulo registrado:", modulo ? modulo.nombre : "NO ENCONTRADO");

  const [tablas] = await conn.query("SHOW TABLES LIKE '%endocrinologia%'");
  console.log("✅ Tablas creadas:", tablas.map(t => Object.values(t)[0]).join(", "));

  await conn.end();
  console.log("\n🎉 Migración 051 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
