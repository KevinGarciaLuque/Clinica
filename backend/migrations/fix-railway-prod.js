const mysql = require('mysql2/promise');

// URL pública del MySQL de Railway
const RAILWAY = {
  host: 'turntable.proxy.rlwy.net',
  port: 55414,
  user: 'root',
  password: 'tTQwOaxQOSBcTkNdZnIaYuGdlkJiykhJ',
  database: 'railway',
};

async function fix() {
  const conn = await mysql.createConnection(RAILWAY);
  console.log('Conectado al MySQL de Railway (producción)\n');

  // 1. Buscar la clínica de Gina por usuario
  const [usuario] = await conn.query(
    "SELECT u.id, u.nombres, u.apellidos, u.email, u.clinica_id, c.nombre, c.slug, c.tipo_id, c.es_pediatrica " +
    "FROM usuarios u JOIN clinicas c ON c.id = u.clinica_id " +
    "WHERE u.email = 'dra.gina.valladares@gmail.com'"
  );
  console.log('Usuario Gina y su clínica:'); console.table(usuario);

  if (!usuario.length) {
    console.log('No se encontró el usuario dra.gina.valladares@gmail.com');
    await conn.end(); return;
  }

  const clinica_id = usuario[0].clinica_id;
  const tipo_id = usuario[0].tipo_id;
  console.log('clinica_id:', clinica_id, '| tipo_id:', tipo_id);

  // 2. Ver todos los tipos en producción
  const [tipos] = await conn.query('SELECT id, clave, nombre FROM tipos_clinica ORDER BY id');
  console.log('\nTipos disponibles:'); console.table(tipos);

  // 3. Verificar si ya hay módulos estéticos asignados al tipo de la clínica
  if (tipo_id) {
    const [existing] = await conn.query(
      'SELECT t.clave AS tipo, m.clave AS modulo, m.para_normal FROM tipo_clinica_modulos tcm ' +
      'JOIN tipos_clinica t ON t.id = tcm.tipo_id ' +
      'JOIN modulos_sistema m ON m.id = tcm.modulo_id ' +
      'WHERE tcm.tipo_id = ?',
      [tipo_id]
    );
    console.log('\nMódulos asignados al tipo_id=' + tipo_id + ':'); console.table(existing);
  }

  // 4. Ver módulos que ve la clínica de Gina
  const [mods] = await conn.query(
    'SELECT ms.clave, ms.ruta ' +
    'FROM modulos_sistema ms ' +
    'INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id ' +
    'INNER JOIN clinicas c ON c.tipo_id = tcm.tipo_id ' +
    'WHERE c.id = ? AND ms.disponible = 1 AND ms.para_normal = 1 ' +
    'ORDER BY ms.orden',
    [clinica_id]
  );
  console.log('\nMódulos actuales para clínica de Gina (' + mods.length + '):');
  mods.forEach(m => console.log(' -', m.clave, m.ruta));

  await conn.end();
}
fix().catch(e => console.error('ERROR:', e.message));
