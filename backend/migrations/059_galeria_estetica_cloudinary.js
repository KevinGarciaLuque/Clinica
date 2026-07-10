/**
 * 059 — Galería Estética: agrega cloudinary_public_id a galeria_fotos para que
 * las fotos nuevas se puedan subir a Cloudinary (persisten entre redeploys)
 * en vez de solo al disco local del contenedor (que se borra en cada deploy).
 * No modifica ni borra las fotos ya existentes.
 * Ejecutar: node migrations/059_galeria_estetica_cloudinary.js
 */
const pool = require("../db");

async function hasColumn(table, column) {
  const [rows] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
    [table, column]
  );
  return rows.length > 0;
}

async function run() {
  if (!(await hasColumn("galeria_fotos", "cloudinary_public_id"))) {
    await pool.query("ALTER TABLE galeria_fotos ADD COLUMN cloudinary_public_id VARCHAR(255) NULL AFTER archivo_nombre");
    console.log("Columna cloudinary_public_id agregada a galeria_fotos");
  } else {
    console.log("galeria_fotos ya tiene cloudinary_public_id");
  }
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
