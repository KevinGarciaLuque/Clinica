require("dotenv").config();
const db = require("./db");

async function check() {
  // Paciente Juanito
  const [pacientes] = await db.query(
    "SELECT id, nombres, apellidos, email, telefono FROM pacientes WHERE nombres LIKE ? OR apellidos LIKE ?",
    ["%Juanito%", "%Sosa%"]
  );
  console.log("\n=== PACIENTE ===");
  pacientes.forEach(p => console.log(`${p.nombres} ${p.apellidos} | email: ${p.email || "SIN EMAIL"} | tel: ${p.telefono || "SIN TEL"}`));

  // Citas próximas
  const [citas] = await db.query(
    `SELECT c.id, c.inicio, c.fin, c.estado, 
            p.nombres, p.apellidos, p.email, p.telefono
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     WHERE c.inicio >= NOW()
     ORDER BY c.inicio ASC LIMIT 5`
  );
  console.log("\n=== CITAS PROXIMAS ===");
  citas.forEach(c => console.log(`#${c.id} | ${c.inicio} | ${c.estado} | ${c.nombres} ${c.apellidos} | email: ${c.email || "SIN EMAIL"}`));

  // Verificar si la cita del 6/abril cae en ventana 24h desde ahora
  const ahora = new Date();
  const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  const en25h = new Date(ahora.getTime() + 25 * 60 * 60 * 1000);
  console.log(`\n=== VENTANA 24H ===`);
  console.log(`Ahora: ${ahora.toLocaleString()}`);
  console.log(`Ventana: ${en24h.toLocaleString()} — ${en25h.toLocaleString()}`);

  const [enVentana] = await db.query(
    `SELECT c.id, c.inicio, c.estado, p.nombres, p.apellidos, p.email
     FROM citas c
     JOIN pacientes p ON c.paciente_id = p.id
     WHERE c.inicio BETWEEN ? AND ?
       AND c.estado IN ('PENDIENTE', 'CONFIRMADA')`,
    [en24h, en25h]
  );
  if (enVentana.length > 0) {
    console.log("✅ Citas en ventana 24h:");
    enVentana.forEach(c => console.log(`  #${c.id} | ${c.inicio} | ${c.nombres} ${c.apellidos} | ${c.email || "SIN EMAIL"}`));
  } else {
    console.log("⚠️  Ninguna cita cae exactamente en ventana de 24h ahora mismo.");
    console.log("   El cron la captará cuando sea 1 hora antes del momento correcto.");
  }

  process.exit(0);
}

check().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
