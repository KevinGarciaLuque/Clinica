/**
 * run-056.js — Fase D: Plan de tratamiento por fases (con subtotales)
 * Ejecuta cada sentencia por separado y tolera errores de "ya existe".
 * Además migra los planes existentes: si tenían `items` planos (formato
 * anterior sin fases), los envuelve en una fase "Plan general (migrado)"
 * para no perder datos ya capturados.
 * Ejecutar: node migrations/run-056.js
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

  console.log("\n🚀 Iniciando migración 056 — Plan de tratamiento por fases...\n");

  const sqlFile = fs.readFileSync(
    path.join(__dirname, "056_plan_tratamiento_fases.sql"),
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

  // Backfill: envolver items antiguos (formato plano) en una fase única
  const [rows] = await conn.query(
    `SELECT id, items FROM plan_tratamiento_odontologia WHERE fases IS NULL`
  );
  let migrados = 0;
  for (const row of rows) {
    let items = [];
    try { items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []); } catch { items = []; }
    if (!Array.isArray(items) || items.length === 0) continue;

    const fase = {
      id: 'migrado',
      nombre: 'Plan general (migrado)',
      objetivo: 'Procedimientos capturados antes de la reestructuración por fases.',
      items: items.map(it => ({
        id: it.id || Date.now() + Math.random(),
        pieza: it.diente || it.pieza || '',
        procedimiento: it.procedimiento || '',
        material: it.material || '',
        costo_estimado: it.costo_estimado || 0,
        completado: !!it.completado,
      })),
    };
    await conn.query(
      `UPDATE plan_tratamiento_odontologia SET fases=? WHERE id=?`,
      [JSON.stringify([fase]), row.id]
    );
    migrados++;
  }
  console.log(`✅ Planes migrados a formato de fases: ${migrados}`);

  const [cols] = await conn.query("SHOW COLUMNS FROM plan_tratamiento_odontologia LIKE 'fases'");
  console.log("✅ Columna fases en plan_tratamiento_odontologia:", cols.length ? "OK" : "NO ENCONTRADA");

  await conn.end();
  console.log("\n🎉 Migración 056 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
