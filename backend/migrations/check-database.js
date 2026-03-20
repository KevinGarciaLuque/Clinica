require("dotenv").config();
const pool = require("../db");

(async () => {
  try {
    // Verificar clínicas existentes
    const [clinicas] = await pool.query("SELECT id, nombre, slug FROM clinicas");
    
    console.log("\n📋 Clínicas en la base de datos:");
    if (clinicas.length === 0) {
      console.log("   ⚠️  No hay clínicas creadas");
    } else {
      clinicas.forEach(c => {
        console.log(`   • ID: ${c.id} | ${c.nombre} (slug: ${c.slug})`);
      });
    }
    
    // Verificar usuarios
    const [usuarios] = await pool.query(`
      SELECT u.id, u.nombres, u.apellidos, u.email, u.tipo, u.clinica_id, c.nombre as clinica_nombre
      FROM usuarios u
      LEFT JOIN clinicas c ON c.id = u.clinica_id
      ORDER BY u.tipo, u.id
    `);
    
    console.log("\n👤 Usuarios en la base de datos:");
    if (usuarios.length === 0) {
      console.log("   ⚠️  No hay usuarios creados");
    } else {
      usuarios.forEach(u => {
        const clinica = u.clinica_id ? ` (Clínica: ${u.clinica_nombre})` : " (SUPER_ADMIN)";
        console.log(`   • ${u.tipo}: ${u.email}${clinica}`);
      });
    }
    
  } catch (e) {
    console.log("❌ Error:", e.message);
  }

  await pool.end();
  process.exit(0);
})();
