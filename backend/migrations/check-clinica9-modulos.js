const db = require('../db');
async function main() {
  const [clinica] = await db.query("SELECT id,nombre,tipo_id,es_pediatrica FROM clinicas WHERE id=9");
  console.log('Clínica 9:', JSON.stringify(clinica[0]));

  if (!clinica[0]?.tipo_id) {
    console.log('\n⚠️  La clínica NO tiene tipo_id asignado → usa módulos base de fallback');
    return process.exit(0);
  }

  const [tcm] = await db.query(
    "SELECT tcm.modulo_id, ms.clave, ms.nombre FROM tipo_clinica_modulos tcm JOIN modulos_sistema ms ON ms.id=tcm.modulo_id WHERE tcm.tipo_id=? ORDER BY ms.orden",
    [clinica[0].tipo_id]
  );
  console.log('\nMódulos asignados al tipo:', JSON.stringify(tcm, null, 2));

  const tieneConsulta = tcm.some(m => m.clave === 'consulta');
  console.log('\n¿Tiene módulo consulta?', tieneConsulta ? '✅ SÍ' : '❌ NO');

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
