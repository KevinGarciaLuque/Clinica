/**
 * 055 — Historia Endocrinología:
 *  - Agrega antecedentes_patologicos_estado ("" | SIN_ANTECEDENTES | PRESENTA).
 *  - Amplía tabaquismo/alcohol/drogas para admitir "EXPOSICION_PASIVA".
 * Ejecutar: node migrations/055_endocrinologia_antecedentes_estado_y_habitos_width.js
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
  if (!(await hasColumn("historia_endocrinologia", "antecedentes_patologicos_estado"))) {
    await pool.query(
      "ALTER TABLE historia_endocrinologia ADD COLUMN antecedentes_patologicos_estado VARCHAR(20) NULL AFTER antecedentes_patologicos"
    );
    console.log("Columna antecedentes_patologicos_estado agregada");
  } else {
    console.log("antecedentes_patologicos_estado ya existe");
  }

  await pool.query("ALTER TABLE historia_endocrinologia MODIFY COLUMN tabaquismo VARCHAR(20)");
  await pool.query("ALTER TABLE historia_endocrinologia MODIFY COLUMN alcohol VARCHAR(20)");
  await pool.query("ALTER TABLE historia_endocrinologia MODIFY COLUMN drogas VARCHAR(20)");
  console.log("Columnas tabaquismo/alcohol/drogas ampliadas a VARCHAR(20)");

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
