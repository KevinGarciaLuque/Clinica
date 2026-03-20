/**
 * DATOS DE PRUEBA - Historia clínica completa para carlitos lopez (paciente_id=7)
 * - Antecedentes médicos y alergias
 * - Historia clínica (consulta SOAP)
 * - Prescripción con medicamentos
 * - Estudios de laboratorio
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../db");

async function seed() {
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    
    const pacienteId = 7;  // carlitos lopez
    const medicoId = 21;   // Dra. Gina Valladares
    const clinicaId = 6;   // Cardiologia
    
    console.log("🔍 Verificando paciente...");
    const [[paciente]] = await conn.query("SELECT * FROM pacientes WHERE id = ?", [pacienteId]);
    if (!paciente) {
      console.log("❌ Paciente no encontrado. Verifica el ID.");
      return;
    }
    console.log(`✅ Paciente: ${paciente.nombres} ${paciente.apellidos}`);
    
    console.log("\n📋 1. Insertando ANTECEDENTES...");
    await conn.query(`
      INSERT INTO antecedentes_paciente 
        (clinica_id, paciente_id, tipo, descripcion)
      VALUES 
        (?, ?, 'patologico', 'Hipertensión arterial controlada con enalapril 10mg desde 2020'),
        (?, ?, 'quirurgico', 'Apendicectomía (2018)'),
        (?, ?, 'habitos', 'No fuma. Consume alcohol ocasionalmente. Sedentario.'),
        (?, ?, 'familiar', 'Padre con diabetes tipo 2, madre con hipotiroidismo')
      ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)
    `, [clinicaId, pacienteId, clinicaId, pacienteId, clinicaId, pacienteId, clinicaId, pacienteId]);
    console.log("✅ Antecedentes insertados");
    
    console.log("\n🚨 2. Insertando ALERGIAS...");
    await conn.query(`
      INSERT INTO alergias_paciente 
        (clinica_id, paciente_id, agente, tipo, severidad, reaccion)
      VALUES 
        (?, ?, 'Penicilina', 'MEDICAMENTO', 'SEVERA', 'Reacción anafiláctica - urticaria generalizada y dificultad respiratoria'),
        (?, ?, 'Ácido Acetilsalicílico', 'MEDICAMENTO', 'MODERADA', 'Gastritis y epigastralgia intensa'),
        (?, ?, 'Polen de gramíneas', 'AMBIENTAL', 'LEVE', 'Rinitis y estornudos en primavera')
      ON DUPLICATE KEY UPDATE severidad = VALUES(severidad)
    `, [clinicaId, pacienteId, clinicaId, pacienteId, clinicaId, pacienteId]);
    console.log("✅ Alergias insertadas");
    
    console.log("\n📝 3. Insertando HISTORIA CLÍNICA (Consulta)...");
    
    // Preparar JSON para signos vitales y diagnósticos secundarios
    const objetivo = JSON.stringify({
      pa: "140/90",
      fc: "78",
      fr: "16",
      temp: "36.5",
      peso: "70",
      talla: "1.70",
      spo2: "98"
    });
    
    const diagnosticosSecundarios = JSON.stringify([
      { cie: "I10", descripcion: "Hipertensión arterial esencial" },
      { cie: "E78.5", descripcion: "Hiperlipidemia no especificada" }
    ]);
    
    const [histResult] = await conn.query(`
      INSERT INTO historias_clinicas 
        (clinica_id, paciente_id, medico_id, cita_id, 
         subjetivo, objetivo, diagnostico_cie, plan, 
         examen_fisico, diagnosticos_secundarios, estado, creado_en)
      VALUES 
        (?, ?, ?, NULL,
         ?,
         ?,
         'I20.9',
         'Plan: 1. Solicitar electrocardiograma de esfuerzo. 2. Perfil lipídico completo. 3. Iniciar atorvastatina 20mg/día. 4. Ajustar dosis de enalapril a 20mg/día. 5. Control en 2 semanas con resultados.',
         'Cabeza y cuello: Normal. Tórax: Murmullo vesicular conservado, no soplos. Ruidos cardiacos rítmicos. Abdomen: Blando, depresible, no doloroso. Extremidades: Pulsos periféricos presentes, no edemas.',
         ?,
         'FIRMADA',
         NOW())
    `, [
      clinicaId, pacienteId, medicoId,
      'Paciente refiere dolor torácico opresivo que aparece con el esfuerzo, cede con el reposo. Refiere episodios de palpitaciones ocasionales. Niega disnea en reposo. No fiebre.',
      objetivo,
      diagnosticosSecundarios
    ]);
    
    const historiaId = histResult.insertId;
    console.log(`✅ Historia clínica ID: ${historiaId}`);
    
    console.log("\n💊 4. Insertando PRESCRIPCIÓN (Receta)...");
    const [rxResult] = await conn.query(`
      INSERT INTO prescripciones 
        (historia_id, clinica_id, paciente_id, medico_id, 
         notas, estado, creado_en)
      VALUES 
        (?, ?, ?, ?,
         'Tomar medicamentos con alimentos. Evitar alcohol. Control de presión arterial en casa.',
         'ACTIVA',
         NOW())
    `, [historiaId, clinicaId, pacienteId, medicoId]);
    
    const prescripcionId = rxResult.insertId;
    console.log(`✅ Prescripción ID: ${prescripcionId}`);
    
    console.log("\n💊 5. Insertando MEDICAMENTOS de la prescripción...");
    
    // Verificar que existan los medicamentos, si no, insertarlos
    await conn.query(`
      INSERT IGNORE INTO medicamentos (nombre_generico, nombre_comercial, presentacion, via_administracion)
      VALUES 
        ('Atorvastatina', 'Lipitor',  'Tableta 20mg', 'Oral'),
        ('Enalapril', 'Renitec', 'Tableta 20mg', 'Oral'),
        ('Omeprazol', 'Losec', 'Cápsula 20mg', 'Oral'),
        ('Ácido Acetilsalicílico', 'Aspirina', 'Tableta 100mg', 'Oral')
    `);
    
    const [[atorva]] = await conn.query("SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Atorvastatina%' LIMIT 1");
    const [[enalapril]] = await conn.query("SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Enalapril%' LIMIT 1");
    const [[omeprazol]] = await conn.query("SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Omeprazol%' LIMIT 1");
    const [[asa]] = await conn.query("SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Acetilsalicílico%' LIMIT 1");
    
    await conn.query(`
      INSERT INTO prescripcion_items 
        (prescripcion_id, medicamento_id, dosis, duracion, instrucciones)
      VALUES 
        (?, ?, '20 mg - 1 vez al día', '30 días', 'Tomar por la noche después de la cena'),
        (?, ?, '20 mg - 1 vez al día', '30 días', 'Tomar en la mañana en ayunas'),
        (?, ?, '20 mg - 1 vez al día', '30 días', 'Tomar 30 minutos antes del desayuno'),
        (?, ?, '100 mg - 1 vez al día', '30 días', 'Tomar después del desayuno con protector gástrico')
    `, [
      prescripcionId, atorva.id,
      prescripcionId, enalapril.id,
      prescripcionId, omeprazol.id,
      prescripcionId, asa.id
    ]);
    console.log("✅ 4 medicamentos insertados en la prescripción");
    
    // console.log("\n🔬 6. Insertando ESTUDIOS DE LABORATORIO...");
    // NOTA: La tabla 'estudios' no existe en este esquema
    // Si quieres estudios, deberás crearla primero
    
    await conn.commit();
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ DATOS DE PRUEBA INSERTADOS CORRECTAMENTE");
    console.log("=".repeat(60));
    console.log(`📋 Historia Clínica ID: ${historiaId}`);
    console.log(`💊 Prescripción ID: ${prescripcionId} (con 4 medicamentos)`);
    console.log(`👤 Paciente: ${paciente.nombres} ${paciente.apellidos} (ID: ${pacienteId})`);
    console.log(`🏥 Clínica ID: ${clinicaId}`);
    console.log(`\n📍 Datos insertados:`);
    console.log(`   ✅ 4 Antecedentes médicos`);
    console.log(`   ✅ 3 Alergias`);
    console.log(`   ✅ 1 Historia clínica (SOAP completa)`);
    console.log(`   ✅ 1 Prescripción con 4 medicamentos`);
    console.log("\n📍 Para ver la consulta, ve a:");
    console.log(`   http://localhost:5173/consulta?historia_id=${historiaId}`);
    console.log("\n📍 Para ver el historial del paciente:");
    console.log(`   http://localhost:5173/historia/${pacienteId}`);
    console.log(`   http://localhost:5173/pacientes/${pacienteId}/perfil`);
    
  } catch (err) {
    await conn.rollback();
    console.error("❌ Error:", err.message);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(console.error);
