const pool = require("../db");
async function check() {
  const [r1] = await pool.query("SHOW TABLES LIKE 'vacunas_aplicadas'");
  const [r2] = await pool.query("SHOW TABLES LIKE 'vitamina_a_suplementacion'");
  console.log("vacunas_aplicadas:", r1.length > 0 ? "✅ EXISTE" : "❌ NO EXISTE");
  console.log("vitamina_a_suplementacion:", r2.length > 0 ? "✅ EXISTE" : "❌ NO EXISTE");
  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
