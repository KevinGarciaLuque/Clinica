/**
 * seed-carlitos-antecedentes-fix.js
 * Inserta los antecedentes de Carlitos Lopez (id=7) en el formato
 * que espera el componente AntecedentesClinico:
 *   tipo: "ahf"  → JSON { familiares, otros }
 *   tipo: "apnp" → JSON { lugar_origen, estado_civil, ... }
 *   tipo: "app"  → JSON { enfermedades, quirurgicos, ... }
 * También recrea las alergias en el formato correcto.
 */
const pool = require("../db");

const PACIENTE_ID = 7;
const CLINICA_ID  = 6;

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Limpiar antecedentes previos (cualquier formato)
    await conn.query(
      "DELETE FROM antecedentes_paciente WHERE paciente_id = ? AND clinica_id = ?",
      [PACIENTE_ID, CLINICA_ID]
    );
    console.log("🧹 Antecedentes previos eliminados");

    // ── AHF: Antecedentes Heredo Familiares ────────────────────────
    await conn.query(
      "INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES (?,?,?,?)",
      [
        CLINICA_ID, PACIENTE_ID, "ahf",
        JSON.stringify({
          familiares: "Padre: DM tipo 2 diagnosticada a los 45 años, actualmente en tratamiento con metformina.\nAbuelo paterno: falleció de IAM (infarto agudo de miocardio) a los 68 años.\nMadre: hipertensión arterial desde los 50 años, bajo control con enalapril.\nTío paterno: dislipidemia en tratamiento.",
          otros: "Parto a término, peso al nacer 3,200g. Desarrollo psicomotor normal. Sin antecedentes perinatales de importancia."
        })
      ]
    );
    console.log("✅ AHF insertado");

    // ── APNP: Antecedentes Personales No Patológicos ────────────────
    await conn.query(
      "INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES (?,?,?,?)",
      [
        CLINICA_ID, PACIENTE_ID, "apnp",
        JSON.stringify({
          lugar_origen:        "Tegucigalpa, Honduras",
          estado_civil:        "Soltero",
          religion:            "Católico",
          escolaridad:         "Universitario (cursando 5to año de Ingeniería)",
          nacionalidad:        "Hondureño",
          lugar_residencia:    "Col. Kennedy, Tegucigalpa",
          ocupacion:           "Estudiante universitario / mesero de fin de semana",
          alcoholismo:         "Ocasional",
          tabaquismo:          "No",
          drogas:              "No",
          actividad_fisica:    "Sí",
          habitacion_adecuada: "Sí",
          higiene_adecuada:    "Sí",
          alimentacion_adecuada: "No",
          inmunizaciones:      "Esquema completo hasta la infancia. Sin refuerzos recientes."
        })
      ]
    );
    console.log("✅ APNP insertado");

    // ── APP: Antecedentes Personales Patológicos ─────────────────────
    await conn.query(
      "INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES (?,?,?,?)",
      [
        CLINICA_ID, PACIENTE_ID, "app",
        JSON.stringify({
          eruptivos:       "",
          tumorales:       "",
          infecciosos:     "COVID-19 leve (2021), resuelto en domicilio. Sin secuelas.",
          enfermedades:    "Hipertensión arterial estadio 1 diagnosticada a los 20 años (2023). Bajo control con Losartán 50mg cada 24h. PA en casa 130-140/85-90 mmHg.\n\nGastritis crónica diagnosticada en 2024. En tratamiento con Omeprazol 20mg. Mejoría parcial con dieta.",
          quirurgicos:     "Apendicectomía laparoscópica a los 15 años (junio 2018). Sin complicaciones postoperatorias. Cicatriz normoevolutiva en FID.",
          transfusionales: "Niega transfusiones previas.",
          traumaticos:     "Fractura de clavícula derecha a los 10 años por caída de bicicleta (2013). Tratamiento conservador. Consolidación completa.",
          alergicos:       "Ver sección de Alergias: Penicilina (urticaria/angioedema), AINES (gastralgia), mariscos (prurito/eritema)."
        })
      ]
    );
    console.log("✅ APP insertado");

    // ── Alergias ─────────────────────────────────────────────────────
    await conn.query(
      "DELETE FROM alergias_paciente WHERE paciente_id = ? AND clinica_id = ?",
      [PACIENTE_ID, CLINICA_ID]
    );

    const alergias = [
      {
        agente:    "Penicilina / Amoxicilina",
        tipo:      "MEDICAMENTO",
        severidad: "MODERADA",
        reaccion:  "Urticaria generalizada y angioedema facial. Episodio a los 12 años tras toma de amoxicilina por faringoamigdalitis. No ha vuelto a recibir betalactámicos."
      },
      {
        agente:    "AINES (Ibuprofeno, Naproxeno, Diclofenaco)",
        tipo:      "MEDICAMENTO",
        severidad: "LEVE",
        reaccion:  "Gastralgia intensa, náuseas y malestar epigástrico. Tolera Paracetamol 500mg sin complicaciones."
      },
      {
        agente:    "Camarones y mariscos",
        tipo:      "ALIMENTO",
        severidad: "MODERADA",
        reaccion:  "Prurito generalizado y eritema difuso al ingerir camarones o langosta. No ha presentado anafilaxia. Último episodio hace 8 meses."
      },
    ];

    for (const al of alergias) {
      await conn.query(
        "INSERT INTO alergias_paciente (clinica_id, paciente_id, agente, tipo, severidad, reaccion) VALUES (?,?,?,?,?,?)",
        [CLINICA_ID, PACIENTE_ID, al.agente, al.tipo, al.severidad, al.reaccion]
      );
    }
    console.log(`✅ ${alergias.length} alergias insertadas`);

    await conn.commit();
    console.log("\n🎉 Antecedentes de Carlitos Lopez actualizados correctamente");
    console.log("   Recarga la página para ver los datos en el componente.");
  } catch (err) {
    await conn.rollback();
    console.error("❌ Error:", err.message);
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
