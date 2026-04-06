/**
 * seed-carlitos-completo.js
 * Rellena el historial completo de Carlitos Lopez (id=7):
 *  - Antecedentes (heredo-familiares, patológicos, no patológicos)
 *  - Alergias
 *  - 4 consultas SOAP con diagnóstico CIE-10
 *  - Prescripciones con medicamentos reales
 *  - Estudios solicitados + resultados de laboratorio
 *  - Mediciones antropométricas (curva de crecimiento/peso adulto joven)
 * NOTA: Carlitos nació el 2003-02-10 → ~23 años. Es varón.
 */
const pool = require("../db");

const PACIENTE_ID = 7;
const MEDICO_ID   = 21;
const CLINICA_ID  = 6;

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ────────────────────────────────────────────────────────────────
    // 1. ACTUALIZAR DATOS BÁSICOS DEL PACIENTE
    // ────────────────────────────────────────────────────────────────
    await conn.query(
      `UPDATE pacientes SET
        contacto_emergencia_nombre   = 'María Lopez (Madre)',
        contacto_emergencia_telefono = '99887766',
        ocupacion     = 'Estudiante universitario',
        estado_civil  = 'Soltero',
        escolaridad   = 'Universitario',
        religion      = 'Católico',
        lugar_nacimiento = 'Tegucigalpa, Honduras',
        nacionalidad  = 'Hondureño',
        notas         = 'Paciente colaborador, no cumple dieta. Practica fútbol 2 veces/semana.'
       WHERE id = ?`,
      [PACIENTE_ID]
    );
    console.log("✅ Datos básicos del paciente actualizados");

    // ────────────────────────────────────────────────────────────────
    // 2. ANTECEDENTES (limpiar los existentes y reinsertar)
    // ────────────────────────────────────────────────────────────────
    await conn.query("DELETE FROM antecedentes_paciente WHERE paciente_id=? AND clinica_id=?", [PACIENTE_ID, CLINICA_ID]);

    const antecedentes = [
      { tipo: "patologico",
        descripcion: "Hipertensión arterial diagnosticada a los 20 años. Bajo control médico con Losartán 50mg. Sin crisis hipertensivas desde hace 2 años." },
      { tipo: "patologico",
        descripcion: "Gastritis crónica diagnosticada hace 1 año. Tratada con Omeprazol 20mg. Mejoría parcial." },
      { tipo: "quirurgico",
        descripcion: "Apendicectomía a los 15 años (2018). Sin complicaciones postoperatorias. Cicatriz normoevolutiva en FID." },
      { tipo: "familiar",
        descripcion: "Padre con DM tipo 2 diagnosticado a los 45 años. Abuelo paterno falleció de IAM a los 68 años. Madre hipertensa desde los 50 años." },
      { tipo: "habitos",
        descripcion: "Tabaquismo: niega. Alcohol: consumo social ocasional (fines de semana, máx 2 cervezas). Actividad física: fútbol 2 veces/semana. Dieta irregular, alto consumo de carbohidratos refinados y comida rápida. Sueño 6-7 horas/noche." },
      { tipo: "ginecobstetrico",
        descripcion: "N/A (sexo masculino)" },
    ];

    for (const a of antecedentes) {
      await conn.query(
        "INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES (?,?,?,?)",
        [CLINICA_ID, PACIENTE_ID, a.tipo, a.descripcion]
      );
    }
    console.log(`✅ ${antecedentes.length} antecedentes insertados`);

    // ────────────────────────────────────────────────────────────────
    // 3. ALERGIAS
    // ────────────────────────────────────────────────────────────────
    await conn.query("DELETE FROM alergias_paciente WHERE paciente_id=? AND clinica_id=?", [PACIENTE_ID, CLINICA_ID]);

    const alergias = [
      { agente: "Penicilina (Amoxicilina)", tipo: "MEDICAMENTO", severidad: "MODERADA", reaccion: "Urticaria generalizada y angioedema facial. Episodio a los 12 años." },
      { agente: "AINES (Ibuprofeno, Naproxeno)", tipo: "MEDICAMENTO", severidad: "LEVE",     reaccion: "Gastralgia intensa y náuseas. Tolera Paracetamol sin problema." },
      { agente: "Camarones y mariscos",       tipo: "ALIMENTO",    severidad: "MODERADA", reaccion: "Prurito generalizado, eritema. No ha tenido anafilaxia." },
    ];

    for (const al of alergias) {
      await conn.query(
        "INSERT INTO alergias_paciente (clinica_id, paciente_id, agente, tipo, severidad, reaccion) VALUES (?,?,?,?,?,?)",
        [CLINICA_ID, PACIENTE_ID, al.agente, al.tipo, al.severidad, al.reaccion]
      );
    }
    console.log(`✅ ${alergias.length} alergias insertadas`);

    // ────────────────────────────────────────────────────────────────
    // 4. CONSULTAS SOAP (Historias Clínicas)
    //    Eliminar los duplicados del seed anterior (id 14 y 15 fueron de prueba)
    // ────────────────────────────────────────────────────────────────
    await conn.query("DELETE FROM estudios_solicitudes WHERE id IN (4,5,6,7)");
    await conn.query("DELETE FROM historias_clinicas WHERE id IN (14,15)");
    console.log("🧹 Historias y estudios de prueba previos eliminados");

    // ---- CONSULTA 1 (hace 6 meses - primera vez hipertensión) ----
    const [h1] = await conn.query(
      `INSERT INTO historias_clinicas
        (clinica_id, paciente_id, medico_id, cita_id,
         subjetivo, objetivo, examen_fisico,
         diagnostico_cie, diagnosticos_secundarios, plan, estado, creado_en)
       VALUES (?,?,?,11,?,?,?,?,?,?,'FIRMADA', DATE_SUB(NOW(), INTERVAL 6 MONTH))`,
      [
        CLINICA_ID, PACIENTE_ID, MEDICO_ID,
        // Subjetivo
        "Paciente masculino de 23 años que acude por primera vez por cefalea occipital de 1 semana de evolución, pulsátil, intensidad 6/10, acompañada de visión borrosa transitoria y sensación de calor en el cuello. Refiere que su padre tiene HTA. Niega dolor torácico, disnea o edema de miembros inferiores.",
        // Objetivo (signos vitales JSON)
        JSON.stringify({ pa: "148/94", fc: "82", fr: "18", temp: "36.5", peso: "78", talla: "175", spo2: "98%" }),
        // Examen físico
        "Paciente consciente, orientado, normohidratado. Facies sin particularidades. Cuello: sin ingurgitación yugular, tiroides no palpable. Cardiopulmonar: ruidos cardíacos rítmicos, sin soplos, murmullo vesicular conservado bilateral. Abdomen: blando, depresible, no doloroso, sin HSM. Extremidades: sin edemas, pulsos periféricos conservados. Neurológico: sin déficit focal.",
        // Diagnóstico CIE
        "I10",
        // Diagnósticos secundarios
        JSON.stringify([{ cie: "R51", descripcion: "Cefalea" }]),
        // Plan
        "1. Iniciar Losartán 50mg c/24h en la mañana.\n2. Dieta hiposódica estricta (<2g NaCl/día).\n3. Reducir consumo de alcohol.\n4. Actividad física aeróbica 30 min/día, 5 días/semana.\n5. Monitorear PA en casa 2 veces/día, llevar registro.\n6. Solicitar BHC, química sanguínea, EGO, ECG de reposo.\n7. Control en 4 semanas con resultados."
      ]
    );
    const h1id = h1.insertId;
    console.log(`✅ Consulta 1 (HTA - control inicial) id=${h1id}`);

    // Prescripción consulta 1
    const [p1] = await conn.query(
      "INSERT INTO prescripciones (clinica_id, historia_id, paciente_id, medico_id, estado, notas, creado_en) VALUES (?,?,?,?,'ACTIVA','Paciente alérgico a Penicilina y AINES. No prescribir.', DATE_SUB(NOW(), INTERVAL 6 MONTH))",
      [CLINICA_ID, h1id, PACIENTE_ID, MEDICO_ID]
    );
    // Losartan (buscar id o usar texto libre)
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?)",
      [p1.insertId, "Losartán 50mg tab", "50mg", "Indefinido (crónico)", "30 tabletas", "Tomar 1 tableta cada 24 horas en la mañana, con o sin alimentos. No suspender sin indicación médica."]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?,?)",
      [p1.insertId, 1, "Paracetamol 500mg", "500mg", "Condicional", "20 tabletas", "Tomar 1-2 tabletas cada 8 horas SÍ SOLO en caso de cefalea intensa. Máximo 3g/día."]
    );
    console.log("✅ Prescripción 1 creada");

    // Estudios solicitud 1 (laboratorio)
    const [es1] = await conn.query(
      `INSERT INTO estudios_solicitudes
        (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
       VALUES (?,?,?,?,'LABORATORIO',
         'BHC (biometría hemática completa): Hb, Hto, leucocitos, plaquetas.\nQuímica sanguínea: Glucosa en ayunas, colesterol total, HDL, LDL, triglicéridos, creatinina, BUN, ácido úrico, TGO, TGP.\nEGO (examen general de orina).\nElectrólitos séricos: Na, K, Cl.',
         0, 'COMPLETADO', DATE_SUB(NOW(), INTERVAL 6 MONTH))`,
      [CLINICA_ID, PACIENTE_ID, MEDICO_ID, h1id]
    );
    const es1id = es1.insertId;
    const es2 = await conn.query(
      `INSERT INTO estudios_solicitudes
        (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
       VALUES (?,?,?,?,'OTRO',
         'Electrocardiograma de 12 derivaciones en reposo. Evaluar hipertrofia ventricular izquierda.',
         0, 'COMPLETADO', DATE_SUB(NOW(), INTERVAL 6 MONTH))`,
      [CLINICA_ID, PACIENTE_ID, MEDICO_ID, h1id]
    );
    const es2id = es2[0].insertId;

    // Resultados de laboratorio (consulta 1)
    const resultados1 = [
      { nombre: "Hemoglobina",         val: "15.2",  min: 13.5,  max: 17.5,  unidad: "g/dL",     anormal: 0 },
      { nombre: "Hematocrito",         val: "46",    min: 41,    max: 53,    unidad: "%",         anormal: 0 },
      { nombre: "Leucocitos",          val: "7800",  min: 4500,  max: 11000, unidad: "cel/mm³",  anormal: 0 },
      { nombre: "Plaquetas",           val: "245000",min: 150000,max: 400000,unidad: "cel/mm³",  anormal: 0 },
      { nombre: "Glucosa en ayunas",   val: "102",   min: 70,    max: 100,   unidad: "mg/dL",    anormal: 1 },
      { nombre: "Colesterol total",    val: "218",   min: 0,     max: 200,   unidad: "mg/dL",    anormal: 1 },
      { nombre: "HDL colesterol",      val: "38",    min: 40,    max: 999,   unidad: "mg/dL",    anormal: 1 },
      { nombre: "LDL colesterol",      val: "142",   min: 0,     max: 130,   unidad: "mg/dL",    anormal: 1 },
      { nombre: "Triglicéridos",       val: "195",   min: 0,     max: 150,   unidad: "mg/dL",    anormal: 1 },
      { nombre: "Creatinina",          val: "0.98",  min: 0.7,   max: 1.3,   unidad: "mg/dL",    anormal: 0 },
      { nombre: "BUN (Urea nitrógeno)",val: "14",    min: 7,     max: 20,    unidad: "mg/dL",    anormal: 0 },
      { nombre: "TGO (AST)",           val: "34",    min: 10,    max: 40,    unidad: "U/L",      anormal: 0 },
      { nombre: "TGP (ALT)",           val: "42",    min: 10,    max: 40,    unidad: "U/L",      anormal: 1 },
      { nombre: "Ácido úrico",         val: "6.8",   min: 3.4,   max: 7.0,   unidad: "mg/dL",    anormal: 0 },
      { nombre: "Sodio (Na)",          val: "140",   min: 136,   max: 145,   unidad: "mEq/L",    anormal: 0 },
      { nombre: "Potasio (K)",         val: "4.1",   min: 3.5,   max: 5.0,   unidad: "mEq/L",    anormal: 0 },
    ];
    for (const r of resultados1) {
      await conn.query(
        "INSERT INTO estudios_resultados (solicitud_id, clinica_id, nombre_examen, valor_resultado, valor_referencia_min, valor_referencia_max, unidad, anormal) VALUES (?,?,?,?,?,?,?,?)",
        [es1id, CLINICA_ID, r.nombre, r.val, r.min, r.max, r.unidad, r.anormal]
      );
    }
    console.log(`✅ ${resultados1.length} resultados de laboratorio insertados (consulta 1)`);

    // ---- CONSULTA 2 (hace 2 meses - control HTA + lumbalgia) ----
    const [h2] = await conn.query(
      `INSERT INTO historias_clinicas
        (clinica_id, paciente_id, medico_id,
         subjetivo, objetivo, examen_fisico,
         diagnostico_cie, diagnosticos_secundarios, plan, estado, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,'FIRMADA', DATE_SUB(NOW(), INTERVAL 2 MONTH))`,
      [
        CLINICA_ID, PACIENTE_ID, MEDICO_ID,
        "Paciente acude a control de HTA. Refiere que viene tomando el Losartán regularmente. PA en casa 130-140/85-90. Trae resultados de laboratorio. Adicionalmente refiere lumbalgia de 3 semanas de evolución, inicio gradual, relacionada con estar sentado muchas horas estudiando, EVA 5/10, sin irradiación, mejora con reposo. Niega parestesias en MMII.",
        JSON.stringify({ pa: "138/88", fc: "76", fr: "17", temp: "36.4", peso: "79", talla: "175", spo2: "99%" }),
        "Paciente en BEG. PA 138/88 en reposo tras 5 minutos. Sin edemas. Columna lumbar: contractura paravertebral bilateral L3-L5, dolor a la palpación de apófisis espinosas L4-L5, Lasègue negativo bilateral. Movilidad lumbar disminuida. Sin signos de irritación radicular.",
        "I10",
        JSON.stringify([
          { cie: "M54.5", descripcion: "Lumbago NE (Lumbalgia)" }
        ]),
        "HTA: Continuar Losartán 50mg. PA aún no en meta (meta <130/80). Reforzar medidas higiénico-dietéticas. Reducir ingesta de alcohol.\nDislipidemia: Iniciar Atorvastatina 20mg en la noche. Control lipídico en 3 meses.\nGlucosa límite: dieta baja en azúcares simples, actividad física.\nLumbalgia: Fisioterapia 10 sesiones. Aplicar calor local. Ejercicios de estiramiento de columna. Evitar sedentarismo prolongado (levantarse cada 45 min). Paracetamol 500mg c/8h por 5 días si dolor intenso.\nControl en 4 semanas."
      ]
    );
    const h2id = h2.insertId;
    console.log(`✅ Consulta 2 (Control HTA + lumbalgia) id=${h2id}`);

    const [p2] = await conn.query(
      "INSERT INTO prescripciones (clinica_id, historia_id, paciente_id, medico_id, estado, notas, creado_en) VALUES (?,?,?,?,'ACTIVA','Alérgico AINES - no prescribir Ibuprofeno/Naproxeno', DATE_SUB(NOW(), INTERVAL 2 MONTH))",
      [CLINICA_ID, h2id, PACIENTE_ID, MEDICO_ID]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?)",
      [p2.insertId, "Losartán 50mg tab", "50mg", "Crónico - continuar", "30 tabletas", "1 tableta cada 24 horas en la mañana. No suspender."]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?)",
      [p2.insertId, "Atorvastatina 20mg tab", "20mg", "Crónico", "30 tabletas", "1 tableta cada 24 horas en la noche, con la cena. Evitar jugo de toronja."]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?,?)",
      [p2.insertId, 1, "Paracetamol 500mg tab", "500mg-1g", "5 días (condicional)", "20 tabletas", "1-2 tabletas cada 8 horas SOLO si dolor lumbar intenso. Máximo 3g/día. No mezclar con alcohol."]
    );
    console.log("✅ Prescripción 2 creada");

    const [es3] = await conn.query(
      `INSERT INTO estudios_solicitudes
        (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
       VALUES (?,?,?,?,'IMAGENOLOGIA',
         'Radiografía de columna lumbosacra AP y lateral. Evaluar alteraciones estructurales, disminución de espacios intervertebrales.',
         0, 'COMPLETADO', DATE_SUB(NOW(), INTERVAL 2 MONTH))`,
      [CLINICA_ID, PACIENTE_ID, MEDICO_ID, h2id]
    );
    console.log(`✅ Estudio Rx columna insertado id=${es3.insertId}`);

    // ---- CONSULTA 3 (hace 3 semanas - IRA) ----
    const [h3] = await conn.query(
      `INSERT INTO historias_clinicas
        (clinica_id, paciente_id, medico_id,
         subjetivo, objetivo, examen_fisico,
         diagnostico_cie, diagnosticos_secundarios, plan, estado, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,'FIRMADA', DATE_SUB(NOW(), INTERVAL 21 DAY))`,
      [
        CLINICA_ID, PACIENTE_ID, MEDICO_ID,
        "Paciente acude por cuadro de 4 días de evolución: rinorrea hialina, congestión nasal, odinofagia moderada, tos seca ocasional, fiebre de 38.1°C el día del inicio (ya afebril). Sin disnea, sin esputo purulento. Continúa con sus medicamentos crónicos (Losartán, Atorvastatina).",
        JSON.stringify({ pa: "132/84", fc: "88", fr: "18", temp: "37.1", peso: "79.5", talla: "175", spo2: "98%" }),
        "Faringe hiperémica leve, amígdalas sin exudado. Rinorrea hialina. Tímpanos normales bilateral. Cardiopulmonar: sin alteraciones. Ganglios cervicales: adenopatía submandibular izq de ~1cm, blanda, ligeramente dolorosa a la palpación.",
        "J06.9",
        JSON.stringify([]),
        "1. Cuadro viral: no requiere antibióticos.\n2. Lavados nasales con solución salina isotónica 3-4 veces/día.\n3. Loratadina 10mg c/24h por 7 días para rinorrea.\n4. Paracetamol 500mg c/8h si dolor o fiebre.\n5. Hidratación oral adecuada.\n6. Reposo relativo.\n7. Regresar si fiebre >38.5°C por más de 3 días, disnea, o aparición de esputo purulento."
      ]
    );
    const h3id = h3.insertId;
    console.log(`✅ Consulta 3 (IRA viral) id=${h3id}`);

    const [p3] = await conn.query(
      "INSERT INTO prescripciones (clinica_id, historia_id, paciente_id, medico_id, estado, notas, creado_en) VALUES (?,?,?,?,'ENTREGADA','IRA viral. No antibióticos.', DATE_SUB(NOW(), INTERVAL 21 DAY))",
      [CLINICA_ID, h3id, PACIENTE_ID, MEDICO_ID]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?)",
      [p3.insertId, "Loratadina 10mg tab", "10mg", "7 días", "7 tabletas", "1 tableta cada 24 horas. Puede causar sueño leve."]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?,?)",
      [p3.insertId, 1, "Paracetamol 500mg tab", "500mg", "Condicional, hasta 5 días", "20 tabletas", "1 tableta c/8h si fiebre o dolor. Máximo 3g/día."]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?)",
      [p3.insertId, "Suero fisiológico 0.9% nasal (spray)", "2 puffs", "7-10 días", "1 frasco", "Aplicar 2 puffs en cada fosa nasal 3 veces al día. Puede usarse más tiempo si hay mejoría."]
    );
    console.log("✅ Prescripción 3 creada");

    // ---- CONSULTA 4 (hace 14 días - control crónico + PENDIENTE PROXIMA CITA) ----
    const [h4] = await conn.query(
      `INSERT INTO historias_clinicas
        (clinica_id, paciente_id, medico_id,
         subjetivo, objetivo, examen_fisico,
         diagnostico_cie, diagnosticos_secundarios, plan, estado, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,'FIRMADA', DATE_SUB(NOW(), INTERVAL 14 DAY))`,
      [
        CLINICA_ID, PACIENTE_ID, MEDICO_ID,
        "Paciente acude a control mensual de HTA y dislipidemia. Refiere buen cumplimiento del tratamiento. PA en casa 125-130/80-85 mmHg registrada. Sin cefalea. Informa que ya completó las 10 sesiones de fisioterapia; lumbalgia mejoró 80%. Niega síntomas de IRA residual. Permanece con dieta regular pero mejoró el consumo de sal.",
        JSON.stringify({ pa: "128/82", fc: "74", fr: "16", temp: "36.3", peso: "78.5", talla: "175", spo2: "99%" }),
        "Paciente en BEGE. FC 74 regular. PA 128/82 en reposo. Peso 78.5kg. Sin edemas. Cardiopulmonar normal. Abdomen sin alteraciones. Columna lumbar: movilidad conservada, contractura residual leve. Sin signos de irritación radicular.",
        "I10",
        JSON.stringify([
          { cie: "E11.9", descripcion: "Prediabetes / glucosa en límite superior - vigilancia" }
        ]),
        "Meta PA casi alcanzada (128/82). Continuar tratamiento actual.\n• Losartán 50mg c/24h (continuar).\n• Atorvastatina 20mg c/24h en la noche (continuar).\nSOLICITAR EN PRÓXIMA CITA (en 4 semanas):\n- Perfil lipídico completo de control (ver respuesta a Atorvastatina).\n- Hemoglobina glicosilada HbA1c (por glucosa limítrofe previa).\n- Creatinina y potasio sérico (vigilancia por Losartán).\nRECOMENDACIONES:\n- Mantener dieta hiposódica, bajar consumo de azúcares simples.\n- Continuar ejercicio aeróbico.\n- Llevar diario de PA y traer a la próxima cita.\nPRÓXIMO CONTROL: en 4 semanas con resultados de laboratorio."
      ]
    );
    const h4id = h4.insertId;
    console.log(`✅ Consulta 4 (Control crónico - con pendientes para próxima cita) id=${h4id}`);

    const [p4] = await conn.query(
      "INSERT INTO prescripciones (clinica_id, historia_id, paciente_id, medico_id, estado, creado_en) VALUES (?,?,?,?,'ACTIVA', DATE_SUB(NOW(), INTERVAL 14 DAY))",
      [CLINICA_ID, h4id, PACIENTE_ID, MEDICO_ID]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?)",
      [p4.insertId, "Losartán 50mg tab", "50mg", "Crónico", "30 tabletas", "1 tableta cada 24 horas en la mañana."]
    );
    await conn.query(
      "INSERT INTO prescripcion_items (prescripcion_id, medicamento_texto, dosis, duracion, cantidad, instrucciones) VALUES (?,?,?,?,?,?)",
      [p4.insertId, "Atorvastatina 20mg tab", "20mg", "Crónico", "30 tabletas", "1 tableta cada 24 horas en la noche con la cena."]
    );
    console.log("✅ Prescripción 4 creada");

    // Estudios PENDIENTES para la próxima cita (el 06/04/2026 - cita id=32)
    const esPend1 = await conn.query(
      `INSERT INTO estudios_solicitudes
        (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
       VALUES (?,?,?,?,'LABORATORIO',
         'Perfil lipídico de control (respuesta a Atorvastatina):\n- Colesterol total\n- HDL colesterol\n- LDL colesterol\n- Triglicéridos\n\nHbA1c (Hemoglobina glicosilada) - glucosa en ayunas limítrofe previa.\n\nCreatinina sérica y Potasio (K) - control por uso de Losartán.',
         0, 'SOLICITADO', DATE_SUB(NOW(), INTERVAL 14 DAY))`,
      [CLINICA_ID, PACIENTE_ID, MEDICO_ID, h4id]
    );
    const esPend2 = await conn.query(
      `INSERT INTO estudios_solicitudes
        (clinica_id, paciente_id, medico_id, historia_id, tipo, descripcion, urgente, estado, creado_en)
       VALUES (?,?,?,?,'OTRO',
         'ECG de 12 derivaciones de control.\nEvaluar progresión de hipertrofia ventricular izquierda en paciente hipertenso joven.',
         0, 'SOLICITADO', DATE_SUB(NOW(), INTERVAL 14 DAY))`,
      [CLINICA_ID, PACIENTE_ID, MEDICO_ID, h4id]
    );
    console.log(`✅ 2 estudios PENDIENTES para próxima cita insertados (id=${esPend1[0].insertId}, id=${esPend2[0].insertId})`);

    // ────────────────────────────────────────────────────────────────
    // 5. MEDICIONES ANTROPOMÉTRICAS (Carlitos 23 años, adulto joven)
    //    Como es mayor de 19 años, no hay curva OMS pediátrica pero
    //    llenamos el módulo con mediciones de seguimiento de peso/talla/IMC
    // ────────────────────────────────────────────────────────────────
    await conn.query("DELETE FROM mediciones_crecimiento WHERE paciente_id=? AND clinica_id=?", [PACIENTE_ID, CLINICA_ID]);

    // Carlitos: nacido 2003-02-10 → meses desde nacimiento hasta cada medición
    const mediciones = [
      // fecha, edad_meses, peso, talla, pc, imc, (z-scores no aplican para adultos, poner null)
      // A los 19 años (meses ~228) - ingreso a univ
      { fecha: "2022-03-15", meses: 229, peso: 72.0, talla: 174.5, pc: null, imc: 23.6 },
      // A los 20 años (meses ~240) - diagnóstico HTA
      { fecha: "2023-02-10", meses: 240, peso: 74.8, talla: 175.0, pc: null, imc: 24.4 },
      // A los 21 años (hace 2 años)
      { fecha: "2024-02-10", meses: 252, peso: 76.5, talla: 175.0, pc: null, imc: 25.0 },
      // Hace 6 meses (primera consulta actual)
      { fecha: "2025-10-05", meses: 272, peso: 78.0, talla: 175.0, pc: null, imc: 25.5 },
      // Hace 2 meses (segunda consulta)
      { fecha: "2026-02-03", meses: 276, peso: 79.0, talla: 175.0, pc: null, imc: 25.8 },
      // Hace 14 días (última consulta)
      { fecha: "2026-03-22", meses: 277, peso: 78.5, talla: 175.0, pc: null, imc: 25.6 },
    ];

    for (const m of mediciones) {
      await conn.query(
        `INSERT INTO mediciones_crecimiento
          (clinica_id, paciente_id, usuario_id, fecha_medicion, edad_meses,
           peso_kg, talla_cm, perimetro_cefalico_cm, imc,
           zscore_peso_edad, zscore_talla_edad, zscore_peso_talla, zscore_imc_edad,
           percentil_peso_edad, percentil_talla_edad, percentil_imc_edad,
           notas)
         VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,NULL,?)`,
        [
          CLINICA_ID, PACIENTE_ID, MEDICO_ID,
          m.fecha, m.meses, m.peso, m.talla, m.pc, m.imc,
          m.imc >= 25.0
            ? "IMC en rango sobrepeso leve. Reforzar hábitos alimenticios y actividad física."
            : "IMC en rango normal."
        ]
      );
    }
    console.log(`✅ ${mediciones.length} mediciones antropométricas insertadas`);

    await conn.commit();
    console.log("\n🎉 ¡Historial completo de Carlitos Lopez insertado exitosamente!");
    console.log("   → 4 consultas SOAP con diagnóstico");
    console.log("   → 4 prescripciones con medicamentos reales");
    console.log("   → 6 antecedentes médicos");
    console.log("   → 3 alergias documentadas");
    console.log("   → Estudios de laboratorio + Rx + ECG (completados e históricos)");
    console.log("   → 2 estudios PENDIENTES para próxima cita (aparecen en Agenda)");
    console.log("   → 6 mediciones antropométricas de seguimiento\n");

  } catch (e) {
    await conn.rollback();
    console.error("❌ Error:", e.message, "\nStack:", e.stack);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
