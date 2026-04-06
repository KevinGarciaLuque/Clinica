const db = require('../db');
async function main() {
  const [mod] = await db.query("SELECT * FROM modulos_sistema ORDER BY id");
  console.log('modulos_sistema:', JSON.stringify(mod, null, 2));

  const [tcm] = await db.query("SELECT * FROM tipo_clinica_modulos ORDER BY id LIMIT 30");
  console.log('tipo_clinica_modulos:', JSON.stringify(tcm, null, 2));

  // Ver cómo consulta el backend los módulos (buscar endpoint)
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
