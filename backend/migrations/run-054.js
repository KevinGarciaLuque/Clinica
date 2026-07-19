/**
 * run-054.js — Fase A: Anamnesis dinámica y configurable (HC-02)
 * Ejecuta cada sentencia por separado y tolera errores de "ya existe"
 * para que sea seguro re-ejecutar sin importar el estado previo de la BD.
 * Ejecutar: node migrations/run-054.js
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const TOLERABLE_CODES = new Set([
  "ER_DUP_FIELDNAME",
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_ENTRY",
  "ER_DUP_KEYNAME",
]);
const TOLERABLE_ERRNOS = new Set([1060, 1050, 1061, 1062]);

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT || 3306),
  });

  console.log("\n🚀 Iniciando migración 054 — Anamnesis dinámica (HC-02)...\n");

  const sqlFile = fs.readFileSync(
    path.join(__dirname, "054_anamnesis_condiciones.sql"),
    "utf8"
  );

  const statements = sqlFile
    .split("\n")
    .filter(line => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 90);
    try {
      await conn.query(stmt);
      console.log(`✅ ${preview}...`);
    } catch (e) {
      if (TOLERABLE_CODES.has(e.code) || TOLERABLE_ERRNOS.has(e.errno)) {
        console.log(`⚠️  ya aplicado (${e.code}): ${preview}...`);
      } else {
        console.error(`💥 Error en: ${preview}...`);
        throw e;
      }
    }
  }

  const [cols] = await conn.query("SHOW COLUMNS FROM historia_odontologica LIKE 'antecedentes'");
  console.log("✅ Columna antecedentes en historia_odontologica:", cols.length ? "OK" : "NO ENCONTRADA");

  const [tablas] = await conn.query("SHOW TABLES LIKE 'catalogo_condiciones_medicas'");
  console.log("✅ Tabla catalogo_condiciones_medicas:", tablas.length ? "OK" : "NO ENCONTRADA");

  const [[{ total }]] = await conn.query("SELECT COUNT(*) AS total FROM catalogo_condiciones_medicas");
  console.log("✅ Condiciones sembradas:", total);

  await conn.end();
  console.log("\n🎉 Migración 054 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
