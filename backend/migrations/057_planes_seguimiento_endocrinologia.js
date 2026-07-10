/**
 * 057 — Planes de Seguimiento (Endocrinología): formulario imprimible de
 * tratamiento (insulina / medicamentos orales / suplementación), uno por visita.
 * Ejecutar: node migrations/057_planes_seguimiento_endocrinologia.js
 */
const pool = require("../db");

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS planes_endocrinologia (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id  INT UNSIGNED NOT NULL,
      paciente_id INT UNSIGNED NOT NULL,
      medico_id   INT UNSIGNED NOT NULL,
      fecha       DATE NOT NULL,
      plan        JSON,
      creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pe_clinica  (clinica_id),
      INDEX idx_pe_paciente (paciente_id),
      INDEX idx_pe_medico   (medico_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("Tabla planes_endocrinologia lista");
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
