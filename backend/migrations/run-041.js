/**
 * run-041.js — Firma digital persistida en recetas y estudios
 * Ejecutar: node migrations/run-041.js
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT || 3306),
  });

  const step = async (desc, sql) => {
    try {
      const [r] = await conn.query(sql);
      console.log(`✅  ${desc} (${r.affectedRows ?? "ok"})`);
    } catch (e) {
      if ([1060, 1061, 1050].includes(e.errno)) {
        console.log(`⚠️  ${desc} — ya existe, saltando`);
      } else {
        console.error(`❌  ${desc}:`, e.message);
        throw e;
      }
    }
  };

  console.log("\n🚀 Iniciando migración 041...\n");

  await step(
    "Agregar columna firma_digital_url a prescripciones",
    "ALTER TABLE prescripciones ADD COLUMN firma_digital_url VARCHAR(500) NULL COMMENT 'Firma digital usada al generar la receta'"
  );
  await step(
    "Agregar columna firma_digital_url a estudios_solicitudes",
    "ALTER TABLE estudios_solicitudes ADD COLUMN firma_digital_url VARCHAR(500) NULL COMMENT 'Firma digital usada al generar la solicitud'"
  );

  await conn.end();
  console.log("\n🎉 Migración 041 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
