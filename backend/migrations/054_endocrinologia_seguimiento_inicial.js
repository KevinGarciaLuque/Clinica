/**
 * 054 — Marca el primer seguimiento de cada paciente como "consulta inicial"
 * (junto con la Historia Clínica, forma la primera consulta completa).
 * Ejecutar: node migrations/054_endocrinologia_seguimiento_inicial.js
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
  if (!(await hasColumn("seguimientos_endocrinologia", "es_inicial"))) {
    await pool.query(
      "ALTER TABLE seguimientos_endocrinologia ADD COLUMN es_inicial TINYINT(1) NOT NULL DEFAULT 0 AFTER medico_id"
    );
    console.log("Columna es_inicial agregada");

    // Marca como inicial el seguimiento más antiguo de cada paciente
    await pool.query(`
      UPDATE seguimientos_endocrinologia se
      JOIN (
        SELECT clinica_id, paciente_id, MIN(id) AS primer_id
        FROM seguimientos_endocrinologia
        GROUP BY clinica_id, paciente_id
      ) t ON t.clinica_id = se.clinica_id AND t.paciente_id = se.paciente_id AND t.primer_id = se.id
      SET se.es_inicial = 1
    `);
    console.log("Seguimientos existentes marcados");
  } else {
    console.log("es_inicial ya existe");
  }

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
