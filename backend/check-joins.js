require("dotenv").config();
const db = require("./db");

(async () => {
  const [r] = await db.query("SELECT id, clinica_id, paciente_id, medico_id, estado FROM citas WHERE id = 21");
  console.log("Cita #21:", r[0]);

  if (r[0]) {
    const [u] = await db.query("SELECT id, nombres, apellidos FROM usuarios WHERE id = ?", [r[0].medico_id]);
    console.log("Médico (medico_id=" + r[0].medico_id + "):", u[0] || "NO ENCONTRADO ❌");

    const [p] = await db.query("SELECT id, nombres FROM pacientes WHERE id = ?", [r[0].paciente_id]);
    console.log("Paciente (paciente_id=" + r[0].paciente_id + "):", p[0] || "NO ENCONTRADO ❌");
  }

  // Probar query completa del script (con todos los JOINs)
  const ahora = new Date();
  const inicio = new Date(ahora.getTime() + 23 * 60 * 60 * 1000);
  const fin   = new Date(ahora.getTime() + 25 * 60 * 60 * 1000);
  const [citas] = await db.query(
    `SELECT c.id,
            p.nombres as paciente_nombres, p.apellidos as paciente_apellidos,
            p.email as paciente_email,
            CONCAT(u.nombres, ' ', u.apellidos) as medico_nombre
     FROM citas c
     INNER JOIN pacientes p ON c.paciente_id = p.id
     INNER JOIN usuarios u ON c.medico_id = u.id
     WHERE c.clinica_id = 1
       AND c.inicio BETWEEN ? AND ?
       AND c.estado IN ('PENDIENTE', 'CONFIRMADA')`,
    [inicio, fin]
  );
  console.log("\nQuery completa encontró:", citas.length, "cita(s)");
  citas.forEach(c => console.log(" →", c));

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
