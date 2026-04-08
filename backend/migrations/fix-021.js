require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../db');

async function run() {
  // Corregir typo
  await pool.query("UPDATE tipos_clinica SET nombre='Nefrología' WHERE clave='nefrologia'");
  console.log('✅ Typo corregido: Nefrología');

  // Asignar módulos base a los nuevos tipos
  const claves = ['endocrinologia','gastroenterologia','inmunologia','nefrologia',
                  'neurologia','otorrinolaringologia','fisioterapia','trabajo_social'];
  const placeholders = claves.map(() => '?').join(',');
  const [r] = await pool.query(`
    INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
    SELECT t.id, m.id
    FROM tipos_clinica t
    CROSS JOIN modulos_sistema m
    WHERE t.clave IN (${placeholders})
    AND m.clave IN ('dashboard','pacientes','citas','historia_clinica','chat_ia','estudios')
  `, claves);
  console.log('✅ Módulos base asignados:', r.affectedRows, 'relaciones');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
