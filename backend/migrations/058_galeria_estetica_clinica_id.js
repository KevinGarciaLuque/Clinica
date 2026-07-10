/**
 * 058 — Galería Estética: agrega clinica_id a galeria_sesiones y galeria_fotos
 * y lo rellena a partir del paciente dueño de cada sesión/foto. Necesario para
 * poder filtrar por clínica en las rutas (antes no existían ni auth ni
 * aislamiento por clínica — cualquiera podía ver/editar fotos de cualquier
 * clínica). No borra ni pierde ningún dato existente, solo agrega la columna.
 * Ejecutar: node migrations/058_galeria_estetica_clinica_id.js
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
  if (!(await hasColumn("galeria_sesiones", "clinica_id"))) {
    await pool.query("ALTER TABLE galeria_sesiones ADD COLUMN clinica_id INT UNSIGNED NULL AFTER id");
    console.log("Columna clinica_id agregada a galeria_sesiones");
  } else {
    console.log("galeria_sesiones ya tiene clinica_id");
  }
  await pool.query(`
    UPDATE galeria_sesiones gs
    JOIN pacientes p ON p.id = gs.paciente_id
    SET gs.clinica_id = p.clinica_id
    WHERE gs.clinica_id IS NULL
  `);
  await pool.query("ALTER TABLE galeria_sesiones MODIFY COLUMN clinica_id INT UNSIGNED NOT NULL");
  const [[idxS]] = await pool.query(
    "SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='galeria_sesiones' AND INDEX_NAME='idx_gs_clinica'"
  );
  if (!idxS.c) await pool.query("ALTER TABLE galeria_sesiones ADD INDEX idx_gs_clinica (clinica_id)");
  console.log("galeria_sesiones: clinica_id relleno y con índice");

  if (!(await hasColumn("galeria_fotos", "clinica_id"))) {
    await pool.query("ALTER TABLE galeria_fotos ADD COLUMN clinica_id INT UNSIGNED NULL AFTER id");
    console.log("Columna clinica_id agregada a galeria_fotos");
  } else {
    console.log("galeria_fotos ya tiene clinica_id");
  }
  await pool.query(`
    UPDATE galeria_fotos gf
    JOIN pacientes p ON p.id = gf.paciente_id
    SET gf.clinica_id = p.clinica_id
    WHERE gf.clinica_id IS NULL
  `);
  await pool.query("ALTER TABLE galeria_fotos MODIFY COLUMN clinica_id INT UNSIGNED NOT NULL");
  const [[idxF]] = await pool.query(
    "SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='galeria_fotos' AND INDEX_NAME='idx_gf_clinica'"
  );
  if (!idxF.c) await pool.query("ALTER TABLE galeria_fotos ADD INDEX idx_gf_clinica (clinica_id)");
  console.log("galeria_fotos: clinica_id relleno y con índice");

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
