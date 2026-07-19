/**
 * run-053.js — Módulos "Estadísticas" y "Facturación" (CAI Honduras)
 * Ejecuta cada sentencia por separado y tolera errores de "ya existe"
 * (columna duplicada, tabla duplicada, valor ENUM ya vigente, etc.)
 * para que sea seguro re-ejecutar sin importar el estado previo de la BD.
 * Ejecutar: node migrations/run-053.js
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

  console.log("\n🚀 Iniciando migración 053 — Estadísticas + Facturación...\n");

  const sqlFile = fs.readFileSync(
    path.join(__dirname, "053_modulo_estadisticas_facturacion.sql"),
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

  const [[estMod]] = await conn.query("SELECT * FROM modulos_sistema WHERE clave='estadisticas'");
  const [[factMod]] = await conn.query("SELECT * FROM modulos_sistema WHERE clave='facturacion'");
  console.log("\n✅ Módulo Estadísticas:", estMod ? estMod.nombre : "NO ENCONTRADO");
  console.log("✅ Módulo Facturación:", factMod ? factMod.nombre : "NO ENCONTRADO");

  const [tablas] = await conn.query("SHOW TABLES LIKE 'facturas'");
  console.log("✅ Tabla facturas:", tablas.length ? "OK" : "NO ENCONTRADA");

  const [cols] = await conn.query("SHOW COLUMNS FROM catalogos_tipos_cita LIKE 'precio'");
  console.log("✅ Columna precio en catalogos_tipos_cita:", cols.length ? "OK" : "NO ENCONTRADA");

  await conn.end();
  console.log("\n🎉 Migración 053 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
