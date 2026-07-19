/**
 * run-prod.js — Ejecuta una o más migraciones SQL contra la base de datos
 * indicada por MYSQL_PUBLIC_URL (inyectada vía `railway run --service MySQL`).
 * Uso: node migrations/run-prod.js 053 054 055 056 057
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const TOLERABLE_CODES = new Set([
  "ER_DUP_FIELDNAME",
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_ENTRY",
  "ER_DUP_KEYNAME",
]);
const TOLERABLE_ERRNOS = new Set([1060, 1050, 1061, 1062]);

async function runFile(conn, numero) {
  const files = fs.readdirSync(__dirname).filter(f => f.startsWith(`${numero}_`) && f.endsWith(".sql"));
  if (!files.length) {
    console.log(`⚠️  No se encontró archivo .sql para ${numero}, se omite`);
    return;
  }
  const file = files[0];
  console.log(`\n🚀 Migración ${numero} — ${file}`);
  const sqlFile = fs.readFileSync(path.join(__dirname, file), "utf8");
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
      console.log(`  ✅ ${preview}...`);
    } catch (e) {
      if (TOLERABLE_CODES.has(e.code) || TOLERABLE_ERRNOS.has(e.errno)) {
        console.log(`  ⚠️  ya aplicado (${e.code}): ${preview}...`);
      } else {
        console.error(`  💥 Error en: ${preview}...`);
        throw e;
      }
    }
  }
}

async function run() {
  const url = process.env.MYSQL_PUBLIC_URL;
  if (!url) throw new Error("MYSQL_PUBLIC_URL no está definida en el entorno");

  const numeros = process.argv.slice(2);
  if (!numeros.length) throw new Error("Especifica los números de migración, ej: node run-prod.js 053 054");

  const conn = await mysql.createConnection(url);
  console.log("🔌 Conectado a la base de datos de producción");

  for (const numero of numeros) {
    await runFile(conn, numero);
  }

  await conn.end();
  console.log("\n🎉 Migraciones de producción completadas.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
