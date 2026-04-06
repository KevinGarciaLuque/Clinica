/**
 * seed-carlitos-clinica9.js
 * Reemplaza los antecedentes de Carlitos Lopez (paciente_id=7, clinica_id=9)
 * con el formato correcto que espera AntecedentesClinico:
 *   tipo "ahf"  → { familiares, otros }
 *   tipo "apnp" → { lugar_origen, estado_civil, ... }
 *   tipo "app"  → { eruptivos, tumorales, infecciosos, enfermedades, quirurgicos, transfusionales, traumaticos, alergicos }
 */
const pool = require("../db");

const PACIENTE_ID = 7;
const CLINICA_ID  = 9;

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Limpiar antecedentes previos para clinica_id=9
    const [del] = await conn.query(
      "DELETE FROM antecedentes_paciente WHERE paciente_id=? AND clinica_id=?",
      [PACIENTE_ID, CLINICA_ID]
    );
    console.log(`🧹 Eliminados ${del.affectedRows} antecedentes previos (clinica_id=9)`);

    // ── AHF: Antecedentes Heredo Familiares ─────────────────────────────────
    await conn.query(
      "INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES (?,?,?,?)",
      [
        CLINICA_ID, PACIENTE_ID, "ahf",
        JSON.stringify({
          familiares:
            "Padre: DM tipo 2 diagnosticada a los 45 años, actualmente con metformina.\n" +
            "Abuelo paterno: falleció de IAM (infarto agudo de miocardio) a los 68 años.\n" +
            "Madre: hipertensión arterial desde los 50 años, controlada con enalapril.\n" +
            "Tío paterno: dislipidemia en tratamiento.",
          otros:
            "Parto a término, peso al nacer 3,200 g. Desarrollo psicomotor normal. " +
            "Sin antecedentes perinatales de importancia."
        })
      ]
    );
    console.log("✅ AHF insertado");

    // ── APNP: Antecedentes Personales No Patológicos ─────────────────────────
    await conn.query(
      "INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES (?,?,?,?)",
      [
        CLINICA_ID, PACIENTE_ID, "apnp",
        JSON.stringify({
          lugar_origen:          "Tegucigalpa, Honduras",
          estado_civil:          "Soltero",
          religion:              "Católico",
          escolaridad:           "Universitario (cursando 5.° año de Ingeniería)",
          nacionalidad:          "Hondureño",
          lugar_residencia:      "Col. Kennedy, Tegucigalpa",
          ocupacion:             "Estudiante universitario / mesero de fin de semana",
          alcoholismo:           "Ocasional (fines de semana)",
          tabaquismo:            "Niega",
          drogas:                "Niega",
          actividad_fisica:      "Sí — fútbol 2 veces/semana",
          habitacion_adecuada:   "Sí",
          higiene_adecuada:      "Sí",
          alimentacion_adecuada: "No — dieta irregular, alto consumo de comida rápida",
          inmunizaciones:        "Esquema completo hasta la infancia. Sin refuerzos recientes."
        })
      ]
    );
    console.log("✅ APNP insertado");

    // ── APP: Antecedentes Personales Patológicos ─────────────────────────────
    await conn.query(
      "INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES (?,?,?,?)",
      [
        CLINICA_ID, PACIENTE_ID, "app",
        JSON.stringify({
          eruptivos:       "",
          tumorales:       "",
          infecciosos:     "COVID-19 leve (2021), resuelto en domicilio. Sin secuelas reportadas.",
          enfermedades:
            "Hipertensión arterial estadio 1 diagnosticada a los 20 años (2023). " +
            "Bajo control con Losartán 50 mg cada 24 h. PA en casa: 130-140/85-90 mmHg.\n\n" +
            "Gastritis crónica diagnosticada en 2024. En tratamiento con Omeprazol 20 mg. " +
            "Mejoría parcial con dieta.",
          quirurgicos:
            "Apendicectomía laparoscópica a los 15 años (junio 2018). " +
            "Sin complicaciones postoperatorias. Cicatriz normoevolutiva en FID.",
          transfusionales: "Niega transfusiones previas.",
          traumaticos:
            "Fractura de clavícula derecha a los 10 años por caída de bicicleta (2013). " +
            "Tratamiento conservador. Consolidación completa sin secuelas.",
          alergicos:
            "Penicilina/Amoxicilina (urticaria y angioedema), " +
            "AINES (gastralgia intensa), " +
            "mariscos y camarones (prurito generalizado y eritema). " +
            "Ver sección Alergias para detalle."
        })
      ]
    );
    console.log("✅ APP insertado");

    await conn.commit();
    console.log("\n🎉 Antecedentes de Carlitos (clinica_id=9) actualizados correctamente.");
  } catch (e) {
    await conn.rollback();
    console.error("❌ Error:", e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
