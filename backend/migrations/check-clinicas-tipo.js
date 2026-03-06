// check-clinicas-tipo.js — Verifica clinicas con su tipo
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../db");

async function main() {
  console.log("\n=== CLÍNICAS CON SU TIPO ===");
  const [clinicas] = await pool.query(`
    SELECT c.id, c.nombre, c.slug, c.tipo_id,
           t.clave AS tipo_clave, t.nombre AS tipo_nombre
    FROM clinicas c
    LEFT JOIN tipos_clinica t ON t.id = c.tipo_id
    ORDER BY c.id
  `);
  console.table(clinicas);

  // Ver módulos de cada clínica que tiene tipo
  for (const c of clinicas) {
    if (c.tipo_id) {
      console.log(`\n=== MÓDULOS DE: ${c.nombre} (${c.tipo_nombre}) ===`);
      const [modulos] = await pool.query(`
        SELECT ms.clave, ms.nombre, ms.ruta
        FROM modulos_sistema ms
        INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id
        WHERE tcm.tipo_id = ?
        ORDER BY ms.clave
      `, [c.tipo_id]);
      console.table(modulos);
    }
  }

  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
