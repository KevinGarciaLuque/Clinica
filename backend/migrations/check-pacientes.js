const db = require("../db");

async function checkPacientesTable() {
  try {
    const [desc] = await db.query("DESCRIBE pacientes");
    console.log("📋 Estructura de tabla 'pacientes':");
    console.table(desc);
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

checkPacientesTable();
