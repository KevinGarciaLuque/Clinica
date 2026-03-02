// run-006.js — Ejecuta migración 006: tipos de clínica y módulos
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

async function main() {
  const raw = fs.readFileSync(
    path.join(__dirname, "006_tipos_clinica_modulos.sql"),
    "utf-8"
  );

  // Eliminar comentarios SQL (--) y dividir por ;
  const noComments = raw
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const stmts = noComments
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 3);

  console.log(`Ejecutando ${stmts.length} sentencias SQL...`);

  const SKIP_CODES = [
    "ER_DUP_ENTRY", "ER_TABLE_EXISTS_ERROR",
    "ER_DUP_KEYNAME", "ER_CANT_DROP_FIELD_OR_KEY", "ER_FK_DUP_NAME",
    "ER_DUP_FIELDNAME",
  ];

  let ok = 0, skip = 0;
  for (const stmt of stmts) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (e) {
      if (SKIP_CODES.includes(e.code)) {
        skip++;
      } else {
        console.error("✗ Error [" + e.code + "]:", e.message.slice(0, 120));
      }
    }
  }

  console.log(`\n✔ Migración 006 completada — ${ok} sentencias OK, ${skip} omitidas (ya existían)`);
  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

