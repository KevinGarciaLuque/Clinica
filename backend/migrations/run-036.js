/**
 * run-036.js — Firma digital en historias clínicas
 * Ejecutar: node migrations/run-036.js
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

  console.log("\n🚀 Iniciando migración 036...\n");

  await step(
    "Agregar columna firma_digital_url a historias_clinicas",
    "ALTER TABLE historias_clinicas ADD COLUMN firma_digital_url VARCHAR(500) NULL COMMENT 'URL imagen firma digital del médico al momento de firmar'"
  );
  await step(
    "Agregar columna colegiatura_firmante a historias_clinicas",
    "ALTER TABLE historias_clinicas ADD COLUMN colegiatura_firmante VARCHAR(100) NULL COMMENT 'Número de colegiatura del médico al momento de firmar'"
  );

  await conn.end();
  console.log("\n🎉 Migración 036 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
