const mysql = require('mysql2/promise');
require('dotenv').config();
async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  // Simular exactamente el endpoint GET /clinicas/modulos para Gina (clinica_id=15)
  const clinica_id = 15;
  const [clinRow] = await conn.query('SELECT es_pediatrica FROM clinicas WHERE id=?', [clinica_id]);
  const esPed = clinRow[0].es_pediatrica;
  const catFilter = esPed ? 'ms.para_pediatrica = 1' : 'ms.para_normal = 1';

  console.log('es_pediatrica:', esPed, '| filtro:', catFilter);

  const [rows] = await conn.query(
    'SELECT ms.clave, ms.nombre, ms.ruta, ms.orden' +
    ' FROM modulos_sistema ms' +
    ' INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id' +
    ' INNER JOIN clinicas c ON c.tipo_id = tcm.tipo_id' +
    ' WHERE c.id = ? AND ms.disponible = 1 AND ms.para_normal = 1' +
    ' ORDER BY ms.orden',
    [clinica_id]
  );

  console.log('\nMODULOS QUE DEVUELVE EL ENDPOINT PARA GINA (' + rows.length + '):');
  console.table(rows);

  if (rows.length === 0) {
    console.log('\n[FALLBACK] No hay tipo asignado, revisa tipo_id:');
    const [c] = await conn.query('SELECT id, tipo_id FROM clinicas WHERE id=?', [clinica_id]);
    console.table(c);
  }

  await conn.end();
}
check().catch(e => console.error('ERROR:', e.message));
