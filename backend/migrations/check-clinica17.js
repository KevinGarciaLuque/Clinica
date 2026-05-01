const mysql = require('mysql2/promise');
require('dotenv').config();
async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  const [clinicas] = await conn.query(
    "SELECT id, nombre, slug, tipo_id, es_pediatrica FROM clinicas WHERE id IN (15,17) OR slug LIKE '%gina%'"
  );
  console.log('\nCLINICAS:'); console.table(clinicas);

  const [tipos] = await conn.query(
    "SELECT id, clave, nombre FROM tipos_clinica WHERE clave IN ('estetica','dermatologia')"
  );
  console.log('\nTIPOS ESTETICA/DERMATOLOGIA:'); console.table(tipos);

  const [tcm] = await conn.query(
    `SELECT t.clave AS tipo, m.clave AS modulo, m.para_normal
     FROM tipo_clinica_modulos tcm
     JOIN tipos_clinica t ON t.id = tcm.tipo_id
     JOIN modulos_sistema m ON m.id = tcm.modulo_id
     WHERE t.clave IN ('estetica','dermatologia')
       AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop')
     ORDER BY t.clave, m.clave`
  );
  console.log('\nMODULOS ESTETICOS ASIGNADOS A TIPOS:'); console.table(tcm);

  // Rutas de todos los módulos (incluyendo estéticos)
  const [rutas] = await conn.query(
    `SELECT id, clave, nombre, ruta, icono, para_normal, orden
     FROM modulos_sistema
     WHERE clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop','consulta','dashboard','pacientes','citas')
     ORDER BY orden`
  );
  console.log('\nRUTAS EN BD (modulos_sistema):'); console.table(rutas);

  await conn.end();
}
check().catch(e => console.error('ERROR:', e.message));
