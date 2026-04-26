require("dotenv").config({ path: __dirname + "/../.env" });
const pool = require("../db");

async function main() {
  // Obtener la clinica_id del paciente demo que ya existe
  const [[ref]] = await pool.query("SELECT clinica_id FROM pacientes LIMIT 1");
  if (!ref) { console.error("No hay pacientes base para obtener clinica_id"); process.exit(1); }

  const [r] = await pool.query(
    `INSERT INTO pacientes (clinica_id, nombres, apellidos, dni, fecha_nacimiento, sexo, creado_en)
     VALUES (?, 'Ana Demo', 'González', 'DEMO-NUEVA-01', '1995-06-15', 'F', NOW())`,
    [ref.clinica_id]
  );
  console.log("✅ Paciente demo creado con ID:", r.insertId);
  process.exit(0);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
