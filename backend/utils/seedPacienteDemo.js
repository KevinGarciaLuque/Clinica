/**
 * seedPacienteDemo.js
 * Crea un paciente de demostración con datos completos (consulta, receta,
 * estudios, curva de crecimiento y vacunas) cuando se registra una nueva clínica.
 *
 * El paciente se etiqueta con notas="DEMO" para que pueda identificarse fácilmente.
 * Se respeta el flag es_pediatrica para insertar datos relevantes a cada tipo.
 *
 * Uso: await seedPacienteDemo(pool, clinicaId, medicoId, esPediatrica)
 */

async function seedPacienteDemo(pool, clinicaId, medicoId, esPediatrica = false) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    /* ──────────────────────────────────────────────────────
       1. PACIENTE DEMO
    ────────────────────────────────────────────────────── */
    const esPed = esPediatrica ? 1 : 0;

    // Datos diferentes según tipo de clínica
    const pacienteData = esPed
      ? {
          nombres: "Mateo",
          apellidos: "García Demo",
          dni: `DEMO-${clinicaId}-PED`,
          fechaNac: "2022-03-15", // ~3 años
          sexo: "M",
          telefono: "555-0100",
          grupoSanguineo: "O+",
          notas: "DEMO — Paciente de ejemplo creado automáticamente.",
        }
      : {
          nombres: "Ana Sofía",
          apellidos: "Ramírez Demo",
          dni: `DEMO-${clinicaId}-GEN`,
          fechaNac: "1990-06-22",
          sexo: "F",
          telefono: "555-0200",
          grupoSanguineo: "A+",
          notas: "DEMO — Paciente de ejemplo creado automáticamente.",
        };

    const [pRes] = await conn.query(
      `INSERT INTO pacientes
         (clinica_id, nombres, apellidos, dni, fecha_nacimiento, sexo,
          telefono, grupo_sanguineo, ciudad, pais, activo, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`,
      [
        clinicaId,
        pacienteData.nombres,
        pacienteData.apellidos,
        pacienteData.dni,
        pacienteData.fechaNac,
        pacienteData.sexo,
        pacienteData.telefono,
        pacienteData.grupoSanguineo,
        "Ciudad Demo",
        "HN",
        pacienteData.notas,
      ]
    );
    const pacienteId = pRes.insertId;

    /* ──────────────────────────────────────────────────────
       2. ANTECEDENTES
    ────────────────────────────────────────────────────── */
    if (esPed) {
      await conn.query(
        `INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES
         (?,?,'patologico',   'Rinitis alérgica estacional desde los 2 años'),
         (?,?,'familiar',     'Madre con asma bronquial. Padre sano.'),
         (?,?,'habitos',      'Lactancia materna exclusiva hasta los 6 meses. Vacunas al día.')`,
        [
          clinicaId, pacienteId,
          clinicaId, pacienteId,
          clinicaId, pacienteId,
        ]
      );
    } else {
      await conn.query(
        `INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES
         (?,?,'patologico',   'Hipertensión arterial en tratamiento con enalapril 10 mg desde 2021'),
         (?,?,'quirurgico',   'Apendicectomía laparoscópica (2019). Sin complicaciones.'),
         (?,?,'familiar',     'Padre diabético tipo 2. Madre con hipotiroidismo.'),
         (?,?,'habitos',      'No fuma. Alcohol ocasional. Actividad física moderada 2 veces/semana.')`,
        [
          clinicaId, pacienteId,
          clinicaId, pacienteId,
          clinicaId, pacienteId,
          clinicaId, pacienteId,
        ]
      );
    }

    /* ──────────────────────────────────────────────────────
       3. ALERGIAS
    ────────────────────────────────────────────────────── */
    if (esPed) {
      await conn.query(
        `INSERT INTO alergias_paciente (clinica_id, paciente_id, agente, tipo, severidad, reaccion) VALUES
         (?,?, 'Penicilina',  'MEDICAMENTO', 'MODERADA', 'Erupción urticariforme generalizada'),
         (?,?, 'Huevo',       'ALIMENTO',    'LEVE',     'Dermatitis atópica leve')`,
        [clinicaId, pacienteId, clinicaId, pacienteId]
      );
    } else {
      await conn.query(
        `INSERT INTO alergias_paciente (clinica_id, paciente_id, agente, tipo, severidad, reaccion) VALUES
         (?,?, 'Penicilina',                  'MEDICAMENTO', 'SEVERA',   'Anafilaxia — urticaria y broncoespasmo'),
         (?,?, 'Ácido Acetilsalicílico',       'MEDICAMENTO', 'MODERADA', 'Gastritis y epigastralgia intensa'),
         (?,?, 'Polen de gramíneas',           'AMBIENTAL',   'LEVE',     'Rinitis y estornudos en primavera')`,
        [
          clinicaId, pacienteId,
          clinicaId, pacienteId,
          clinicaId, pacienteId,
        ]
      );
    }

    /* ──────────────────────────────────────────────────────
       4. HISTORIA CLÍNICA (SOAP)
    ────────────────────────────────────────────────────── */
    const objetivo = JSON.stringify(
      esPed
        ? { peso: "14.2", talla: "92", temp: "37.1", fc: "102", fr: "24", spo2: "98" }
        : { pa: "138/88", fc: "76", fr: "16", temp: "36.6", peso: "65", talla: "1.63", spo2: "97" }
    );

    const dxSecundarios = JSON.stringify(
      esPed
        ? [{ cie: "J30.1", descripcion: "Rinitis alérgica debida a polen" }]
        : [
            { cie: "I10",   descripcion: "Hipertensión arterial esencial" },
            { cie: "E78.5", descripcion: "Hiperlipidemia no especificada"  },
          ]
    );

    const subjPed =
      "Madre refiere que el niño presenta tos seca de 5 días de evolución, " +
      "rinorrea clara y febrícula de 37.4 °C. Niega vómitos ni diarrea. " +
      "Apetito conservado. Vacunas al día según carnet.";

    const subjGen =
      "Paciente refiere cefalea occipital de 3 días, mareo leve y sensación " +
      "de palpitaciones. Niega disnea en reposo. Toma enalapril 10 mg/día " +
      "sin adherencia regular los últimos 15 días.";

    const planPed =
      "1. Loratadina jarabe 5 mg/5 ml — 5 ml cada 12 h por 7 días.\n" +
      "2. Paracetamol suspensión 160 mg/5 ml — 5 ml c/6 h si fiebre > 38 °C.\n" +
      "3. Lavados nasales con SF 0.9 % 3 veces al día.\n" +
      "4. Hemograma completo y PCR urgente.\n" +
      "5. Control en 5 días o antes si persiste la fiebre.";

    const planGen =
      "1. Ajustar enalapril a 20 mg/día.\n" +
      "2. Iniciar amlodipino 5 mg/día.\n" +
      "3. Solicitar perfil lipídico completo y función renal.\n" +
      "4. Electrocardiograma de 12 derivaciones.\n" +
      "5. Dieta hiposódica e hipocalórica. Control en 2 semanas.";

    const exFisicoPed =
      "General: REHEN, activo, reactivo. Orofaringe: leve eritema. " +
      "ORL: narinas con secreción serosa. Tórax: murmullo vesicular conservado, " +
      "sin sibilancias. Abdomen: blando, no doloroso.";

    const exFisicoGen =
      "Cabeza y cuello: sin adenomegalias. Tórax: ruidos cardiacos rítmicos. " +
      "Pulmones: murmullo vesicular conservado. Abdomen: blando, depresible. " +
      "Extremidades: no edemas, pulsos periféricos presentes.";

    const [hRes] = await conn.query(
      `INSERT INTO historias_clinicas
         (clinica_id, paciente_id, medico_id, cita_id,
          subjetivo, objetivo, diagnostico_cie,
          diagnosticos_secundarios, plan, examen_fisico, estado, creado_en)
       VALUES (?,?,?,NULL, ?,?,?, ?,?,?, 'FIRMADA', NOW())`,
      [
        clinicaId,
        pacienteId,
        medicoId,
        esPed ? subjPed : subjGen,
        objetivo,
        esPed ? "J06.9" : "R51",
        dxSecundarios,
        esPed ? planPed : planGen,
        esPed ? exFisicoPed : exFisicoGen,
      ]
    );
    const historiaId = hRes.insertId;

    /* ──────────────────────────────────────────────────────
       5. PRESCRIPCIÓN + MEDICAMENTOS
    ────────────────────────────────────────────────────── */
    const [rxRes] = await conn.query(
      `INSERT INTO prescripciones
         (clinica_id, historia_id, paciente_id, medico_id, notas, estado, creado_en)
       VALUES (?,?,?,?, ?,  'ACTIVA', NOW())`,
      [
        clinicaId,
        historiaId,
        pacienteId,
        medicoId,
        esPed
          ? "Administrar con alimentos. Consultar si aparece exantema."
          : "Tomar medicamentos con el desayuno. Monitorear PA en casa.",
      ]
    );
    const prescripcionId = rxRes.insertId;

    // Medicamentos — insertar si no existen (globales, sin clinica_id)
    if (esPed) {
      await conn.query(
        `INSERT IGNORE INTO medicamentos
           (nombre_generico, nombre_comercial, presentacion, via_administracion)
         VALUES
           ('Loratadina',   'Clarityne',  'Jarabe 5 mg/5 ml',       'Oral'),
           ('Paracetamol',  'Tempra',     'Suspensión 160 mg/5 ml', 'Oral')`
      );
      const [[lorat]] = await conn.query(
        "SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Loratadina%' LIMIT 1"
      );
      const [[parac]] = await conn.query(
        "SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Paracetamol%' LIMIT 1"
      );
      await conn.query(
        `INSERT INTO prescripcion_items
           (prescripcion_id, medicamento_id, dosis, duracion, cantidad, instrucciones)
         VALUES
           (?,?, '5 ml cada 12 horas',          '7 días',  '1 frasco', 'Tomar con o sin alimentos'),
           (?,?, '5 ml cada 6 horas si fiebre', '5 días',  '1 frasco', 'Solo si temperatura > 38 °C')`,
        [prescripcionId, lorat.id, prescripcionId, parac.id]
      );
    } else {
      await conn.query(
        `INSERT IGNORE INTO medicamentos
           (nombre_generico, nombre_comercial, presentacion, via_administracion)
         VALUES
           ('Enalapril',     'Renitec',  'Tableta 20 mg', 'Oral'),
           ('Amlodipino',    'Norvasc',  'Tableta 5 mg',  'Oral'),
           ('Atorvastatina', 'Lipitor',  'Tableta 20 mg', 'Oral')`
      );
      const [[enal]] = await conn.query(
        "SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Enalapril%' LIMIT 1"
      );
      const [[amlo]] = await conn.query(
        "SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Amlodipino%' LIMIT 1"
      );
      const [[ator]] = await conn.query(
        "SELECT id FROM medicamentos WHERE nombre_generico LIKE '%Atorvastatina%' LIMIT 1"
      );
      await conn.query(
        `INSERT INTO prescripcion_items
           (prescripcion_id, medicamento_id, dosis, duracion, cantidad, instrucciones)
         VALUES
           (?,?, '20 mg — 1 vez al día',  '30 días', '30 tabletas', 'Tomar en la mañana'),
           (?,?, '5 mg — 1 vez al día',   '30 días', '30 tabletas', 'Tomar en la noche'),
           (?,?, '20 mg — 1 vez al día',  '30 días', '30 tabletas', 'Tomar con la cena')`,
        [
          prescripcionId, enal.id,
          prescripcionId, amlo.id,
          prescripcionId, ator.id,
        ]
      );
    }

    /* ──────────────────────────────────────────────────────
       6. ESTUDIOS SOLICITADOS + RESULTADOS
    ────────────────────────────────────────────────────── */
    const [estRes] = await conn.query(
      `INSERT INTO estudios_solicitudes
         (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
       VALUES
         (?,?,?,?, 'LABORATORIO', ?, ?, 'COMPLETADO', NOW())`,
      [
        clinicaId,
        pacienteId,
        medicoId,
        historiaId,
        esPed
          ? "Hemograma completo, PCR cuantitativa"
          : "Hemograma completo, perfil lipídico, función renal (creatinina, urea), glucosa en ayunas",
        esPed ? 1 : 0,
      ]
    );
    const solicitudId = estRes.insertId;

    // Resultados de laboratorio
    const resultados = esPed
      ? [
          { nombre: "Leucocitos",    valor: "8.5",  refMin: 4.5,  refMax: 13.5, unidad: "x10³/μL", anormal: 0 },
          { nombre: "Hemoglobina",   valor: "12.1", refMin: 11.0, refMax: 14.5, unidad: "g/dL",    anormal: 0 },
          { nombre: "PCR",           valor: "14.3", refMin: 0,    refMax: 10.0, unidad: "mg/L",    anormal: 1 },
          { nombre: "Plaquetas",     valor: "245",  refMin: 150,  refMax: 400,  unidad: "x10³/μL", anormal: 0 },
        ]
      : [
          { nombre: "Hemoglobina",    valor: "13.8", refMin: 12.0, refMax: 16.0, unidad: "g/dL",    anormal: 0 },
          { nombre: "Leucocitos",     valor: "7.2",  refMin: 4.5,  refMax: 11.0, unidad: "x10³/μL", anormal: 0 },
          { nombre: "Glucosa ayunas", valor: "102",  refMin: 70,   refMax: 99,   unidad: "mg/dL",   anormal: 1 },
          { nombre: "Colesterol LDL", valor: "148",  refMin: 0,    refMax: 130,  unidad: "mg/dL",   anormal: 1 },
          { nombre: "Colesterol HDL", valor: "42",   refMin: 40,   refMax: 60,   unidad: "mg/dL",   anormal: 0 },
          { nombre: "Creatinina",     valor: "0.9",  refMin: 0.5,  refMax: 1.1,  unidad: "mg/dL",   anormal: 0 },
        ];

    for (const r of resultados) {
      await conn.query(
        `INSERT INTO estudios_resultados
           (solicitud_id, clinica_id, nombre_examen, valor_resultado,
            valor_referencia_min, valor_referencia_max, unidad, anormal, cargado_en)
         VALUES (?,?,?,?, ?,?,?,?, NOW())`,
        [solicitudId, clinicaId, r.nombre, r.valor, r.refMin, r.refMax, r.unidad, r.anormal]
      );
    }

    // Estudio de imagenología (solo adulto)
    if (!esPed) {
      await conn.query(
        `INSERT INTO estudios_solicitudes
           (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
         VALUES (?,?,?,?, 'IMAGENOLOGIA', 'Electrocardiograma de 12 derivaciones en reposo', 0, 'SOLICITADO', NOW())`,
        [clinicaId, pacienteId, medicoId, historiaId]
      );
    }

    /* ──────────────────────────────────────────────────────
       7. CURVA DE CRECIMIENTO (solo pediátrico)
    ────────────────────────────────────────────────────── */
    if (esPed) {
      // 5 mediciones en los últimos 24 meses
      const mediciones = [
        { meses: 12, peso: 9.6,  talla: 74.0, pc: 46.0, zsP: -0.3, zsT: -0.2, percP: 38, percT: 42 },
        { meses: 18, peso: 11.2, talla: 81.5, pc: 47.0, zsP: -0.1, zsT:  0.1, percP: 46, percT: 54 },
        { meses: 24, peso: 12.5, talla: 87.0, pc: 48.0, zsP:  0.2, zsT:  0.3, percP: 58, percT: 62 },
        { meses: 30, peso: 13.4, talla: 91.0, pc: 48.8, zsP:  0.1, zsT:  0.2, percP: 54, percT: 58 },
        { meses: 36, peso: 14.2, talla: 92.0, pc: 49.0, zsP:  0.0, zsT:  0.0, percP: 50, percT: 50 },
      ];
      for (const m of mediciones) {
        const imc = parseFloat((m.peso / Math.pow(m.talla / 100, 2)).toFixed(2));
        await conn.query(
          `INSERT INTO mediciones_crecimiento
             (clinica_id, paciente_id, usuario_id, fecha_medicion, edad_meses,
              peso_kg, talla_cm, perimetro_cefalico_cm, imc,
              zscore_peso_edad, zscore_talla_edad,
              percentil_peso_edad, percentil_talla_edad)
           VALUES (?,?,?,DATE_SUB(CURDATE(), INTERVAL ? MONTH),?,  ?,?,?,?,  ?,?,  ?,?)`,
          [
            clinicaId, pacienteId, medicoId,
            36 - m.meses, // meses hacia atrás desde hoy
            m.meses,
            m.peso, m.talla, m.pc, imc,
            m.zsP, m.zsT,
            m.percP, m.percT,
          ]
        );
      }
    }

    /* ──────────────────────────────────────────────────────
       8. VACUNAS (solo pediátrico)
    ────────────────────────────────────────────────────── */
    if (esPed) {
      const vacunas = [
        { codigo: "BCG",     nombre: "BCG",                   dosis: "Única",   orden: 1, mesAtraso: 35 },
        { codigo: "HEP_B_RN",nombre: "Hepatitis B (RN)",      dosis: "Única",   orden: 1, mesAtraso: 34 },
        { codigo: "PENTA",   nombre: "Pentavalente",          dosis: "Primera", orden: 1, mesAtraso: 33 },
        { codigo: "PENTA",   nombre: "Pentavalente",          dosis: "Segunda", orden: 2, mesAtraso: 31 },
        { codigo: "PENTA",   nombre: "Pentavalente",          dosis: "Tercera", orden: 3, mesAtraso: 29 },
        { codigo: "ROTAVIRUS",nombre: "Rotavirus",            dosis: "Primera", orden: 1, mesAtraso: 33 },
        { codigo: "ROTAVIRUS",nombre: "Rotavirus",            dosis: "Segunda", orden: 2, mesAtraso: 31 },
        { codigo: "NEUMOCOCO",nombre: "Neumococo (PCV13)",    dosis: "Primera", orden: 1, mesAtraso: 33 },
        { codigo: "NEUMOCOCO",nombre: "Neumococo (PCV13)",    dosis: "Segunda", orden: 2, mesAtraso: 31 },
        { codigo: "NEUMOCOCO",nombre: "Neumococo (PCV13)",    dosis: "Refuerzo",orden: 3, mesAtraso: 24 },
        { codigo: "SRP",     nombre: "SRP (Triple viral)",    dosis: "Primera", orden: 1, mesAtraso: 24 },
        { codigo: "VARICELA",nombre: "Varicela",              dosis: "Primera", orden: 1, mesAtraso: 22 },
      ];
      for (const v of vacunas) {
        await conn.query(
          `INSERT INTO vacunas_aplicadas
             (clinica_id, paciente_id, usuario_id,
              vacuna_codigo, vacuna_nombre, dosis_nombre, dosis_orden,
              fecha_aplicacion, nombre_vacunador)
           VALUES (?,?,?,?,?,?,?,  DATE_SUB(CURDATE(), INTERVAL ? MONTH),  'Dr. Demo')`,
          [
            clinicaId, pacienteId, medicoId,
            v.codigo, v.nombre, v.dosis, v.orden,
            v.mesAtraso,
          ]
        );
      }
    }

    await conn.commit();
    console.log(
      `✅ [seedPacienteDemo] Paciente demo creado (id=${pacienteId}) ` +
      `para clínica ${clinicaId} (${esPed ? "Pediátrica" : "General"})`
    );
    return pacienteId;
  } catch (err) {
    await conn.rollback();
    console.error("[seedPacienteDemo] Error:", err.message);
    // No relanzamos para no bloquear la creación de la clínica
    return null;
  } finally {
    conn.release();
  }
}

module.exports = { seedPacienteDemo };
