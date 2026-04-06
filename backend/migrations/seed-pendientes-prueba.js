/**
 * seed-pendientes-prueba.js
 * Inserta una historia clínica con plan y estudios pendientes
 * para el primer paciente y médico disponibles en la clínica.
 * Uso: node migrations/seed-pendientes-prueba.js
 */
const pool = require("../db");

async function seed() {
  const conn = await pool.getConnection();
  try {
    // Tomar el primer paciente activo
    const [[paciente]] = await conn.query(
      "SELECT id, nombres, apellidos FROM pacientes ORDER BY id ASC LIMIT 1"
    );
    if (!paciente) { console.log("❌ No hay pacientes en la base de datos"); return; }

    // Tomar el primer médico activo
    const [[medico]] = await conn.query(
      "SELECT id, nombres, apellidos FROM usuarios WHERE tipo='MEDICO' ORDER BY id ASC LIMIT 1"
    );
    if (!medico) { console.log("❌ No hay médicos en la base de datos"); return; }

    // Tomar la clínica
    const [[clinica]] = await conn.query("SELECT id FROM clinicas ORDER BY id ASC LIMIT 1");
    if (!clinica) { console.log("❌ No hay clínicas en la base de datos"); return; }

    const clinicaId  = clinica.id;
    const pacienteId = paciente.id;
    const medicoId   = medico.id;

    console.log(`\n📋 Paciente: ${paciente.apellidos}, ${paciente.nombres} (id=${pacienteId})`);
    console.log(`👨‍⚕️  Médico:   Dr. ${medico.apellidos}, ${medico.nombres} (id=${medicoId})`);
    console.log(`🏥 Clínica:  id=${clinicaId}\n`);

    // ── Historia clínica de la consulta anterior con plan pendiente ──────────
    const [hRes] = await conn.query(
      `INSERT INTO historias_clinicas
         (clinica_id, paciente_id, medico_id, subjetivo, examen_fisico, plan, estado, creado_en)
       VALUES (?, ?, ?,
         'Paciente refiere cefalea persistente por 3 días, leve mareo al levantarse.',
         'PA 130/85, FC 78 lpm. Buena hidratación. Sin déficit neurológico focal.',
         'Control en 2 semanas. Tomar Losartán 50mg c/24h. Dieta hiposódica. Traer resultados de análisis de sangre y orina. Monitorear PA en casa dos veces por día.',
         'FIRMADA',
         DATE_SUB(NOW(), INTERVAL 14 DAY))`,
      [clinicaId, pacienteId, medicoId]
    );
    const historiaId = hRes.insertId;
    console.log(`✅ Historia clínica insertada (id=${historiaId})`);

    // ── Estudios pendientes vinculados a esa historia ─────────────────────────
    const [e1] = await conn.query(
      `INSERT INTO estudios_solicitudes
         (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
       VALUES (?, ?, ?, ?, 'LABORATORIO',
         'Hemograma completo, glucosa en ayunas, colesterol total, triglicéridos, creatinina, urea.',
         0, 'SOLICITADO', DATE_SUB(NOW(), INTERVAL 14 DAY))`,
      [clinicaId, pacienteId, medicoId, historiaId]
    );
    console.log(`✅ Estudio 1 insertado: Laboratorio (id=${e1.insertId})`);

    const [e2] = await conn.query(
      `INSERT INTO estudios_solicitudes
         (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
       VALUES (?, ?, ?, ?, 'IMAGENOLOGIA',
         'Radiografía de tórax PA y lateral. Descartar cardiomegalia.',
         0, 'SOLICITADO', DATE_SUB(NOW(), INTERVAL 14 DAY))`,
      [clinicaId, pacienteId, medicoId, historiaId]
    );
    console.log(`✅ Estudio 2 insertado: Imagenología (id=${e2.insertId})`);

    console.log(`\n🎉 Datos de prueba insertados correctamente.`);
    console.log(`   Paciente: ${paciente.apellidos}, ${paciente.nombres}`);
    console.log(`   Busca una cita de este paciente en la Agenda para ver los pendientes.\n`);

  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
