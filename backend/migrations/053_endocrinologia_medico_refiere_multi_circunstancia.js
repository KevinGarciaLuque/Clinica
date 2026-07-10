/**
 * 053 — Historia Endocrinología: agrega "médico que refiere" y convierte
 * "circunstancias del diagnóstico" en selección múltiple (JSON).
 * Ejecutar: node migrations/053_endocrinologia_medico_refiere_multi_circunstancia.js
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
  if (!(await hasColumn("historia_endocrinologia", "medico_refiere"))) {
    await pool.query("ALTER TABLE historia_endocrinologia ADD COLUMN medico_refiere VARCHAR(150) NULL AFTER medico");
    console.log("Columna medico_refiere agregada");
  } else {
    console.log("medico_refiere ya existe");
  }

  if (!(await hasColumn("historia_endocrinologia", "circunstancias_diagnostico"))) {
    await pool.query(
      "ALTER TABLE historia_endocrinologia ADD COLUMN circunstancias_diagnostico JSON NULL AFTER edad_diagnostico"
    );
    console.log("Columna circunstancias_diagnostico agregada");

    // Migra el valor único existente al nuevo formato { CLAVE: true }
    await pool.query(`
      UPDATE historia_endocrinologia
      SET circunstancias_diagnostico = JSON_OBJECT(circunstancia_diagnostico, TRUE)
      WHERE circunstancia_diagnostico IS NOT NULL AND circunstancia_diagnostico <> ''
    `);
    console.log("Datos existentes migrados a circunstancias_diagnostico");
  } else {
    console.log("circunstancias_diagnostico ya existe");
  }

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
