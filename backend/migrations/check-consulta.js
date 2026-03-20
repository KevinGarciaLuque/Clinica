/**
 * Verificar si el módulo de Consulta existe
 */
const db = require("../db");

async function check() {
  try {
    const [modulos] = await db.query(
      "SELECT * FROM modulos_sistema WHERE clave = 'consulta'"
    );
    
    if (modulos.length > 0) {
      console.log("✅ Módulo de Consulta encontrado:");
      console.log(modulos[0]);
    } else {
      console.log("❌ Módulo de Consulta NO encontrado");
    }
    
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    await db.end();
    process.exit(1);
  }
}

check();
