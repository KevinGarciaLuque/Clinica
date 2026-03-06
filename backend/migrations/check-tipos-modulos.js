// check-tipos-modulos.js — Verifica tipos de clínica y módulos
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../db");

async function main() {
  console.log("\n=== TIPOS DE CLÍNICA ===");
  const [tipos] = await pool.query("SELECT id, clave, nombre FROM tipos_clinica ORDER BY nombre");
  console.table(tipos);

  console.log("\n=== MÓDULOS DEL SISTEMA ===");
  const [modulos] = await pool.query("SELECT id, clave, nombre, ruta FROM modulos_sistema ORDER BY clave");
  console.table(modulos);

  console.log("\n=== MÓDULOS DE CIRUGÍA ESTÉTICA ===");
  const [estetica] = await pool.query(`
    SELECT ms.clave, ms.nombre, ms.ruta
    FROM modulos_sistema ms
    INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id
    INNER JOIN tipos_clinica t ON t.id = tcm.tipo_id
    WHERE t.clave = 'estetica'
    ORDER BY ms.clave
  `);
  console.table(estetica);

  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
