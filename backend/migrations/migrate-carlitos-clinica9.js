/**
 * Migra todos los datos de Carlitos Lopez (id=7)
 * de clinica_id=6 → clinica_id=9 (Clínica Estética Demo)
 * y medico_id=21 (Gina) → medico_id=23 (Juan Perez)
 */
const db = require('../db');

const PACIENTE_ID = 7;
const NEW_CLINICA  = 9;
const NEW_MEDICO   = 23;

async function run() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // pacientes (no tiene medico_id)
    await conn.query(
      'UPDATE pacientes SET clinica_id=? WHERE id=?',
      [NEW_CLINICA, PACIENTE_ID]
    );
    console.log('✅ pacientes actualizado');

    // historias_clinicas
    await conn.query(
      'UPDATE historias_clinicas SET clinica_id=?, medico_id=? WHERE paciente_id=?',
      [NEW_CLINICA, NEW_MEDICO, PACIENTE_ID]
    );
    console.log('✅ historias_clinicas actualizado');

    // antecedentes_paciente (sin medico_id)
    await conn.query(
      'UPDATE antecedentes_paciente SET clinica_id=? WHERE paciente_id=?',
      [NEW_CLINICA, PACIENTE_ID]
    );
    console.log('✅ antecedentes_paciente actualizado');

    // alergias_paciente (sin medico_id)
    await conn.query(
      'UPDATE alergias_paciente SET clinica_id=? WHERE paciente_id=?',
      [NEW_CLINICA, PACIENTE_ID]
    );
    console.log('✅ alergias_paciente actualizado');

    // estudios_solicitudes
    await conn.query(
      'UPDATE estudios_solicitudes SET clinica_id=?, medico_id=? WHERE paciente_id=?',
      [NEW_CLINICA, NEW_MEDICO, PACIENTE_ID]
    );
    console.log('✅ estudios_solicitudes actualizado');

    // prescripciones
    await conn.query(
      'UPDATE prescripciones SET clinica_id=?, medico_id=? WHERE paciente_id=?',
      [NEW_CLINICA, NEW_MEDICO, PACIENTE_ID]
    );
    console.log('✅ prescripciones actualizado');

    // mediciones_crecimiento (sin medico_id)
    await conn.query(
      'UPDATE mediciones_crecimiento SET clinica_id=? WHERE paciente_id=?',
      [NEW_CLINICA, PACIENTE_ID]
    );
    console.log('✅ mediciones_crecimiento actualizado');

    // citas
    await conn.query(
      'UPDATE citas SET clinica_id=?, medico_id=? WHERE paciente_id=?',
      [NEW_CLINICA, NEW_MEDICO, PACIENTE_ID]
    );
    console.log('✅ citas actualizado');

    await conn.commit();
    console.log('\n🎉 Carlitos Lopez migrado a Clínica Estética Demo (id=9), médico Juan Perez (id=23)');
    process.exit(0);
  } catch (e) {
    await conn.rollback();
    console.error('❌ ERROR - ROLLBACK:', e.message);
    process.exit(1);
  }
}

run();
