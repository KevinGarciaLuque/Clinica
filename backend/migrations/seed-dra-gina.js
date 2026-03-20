require("dotenv").config();
const pool  = require("../db");
const argon2 = require("argon2");

(async () => {
  try {
    // Clínica id=6 (Cardiologia)
    const clinicaId = 6;

    // Buscar especialidad "Medicina General"
    const [[esp]] = await pool.query(
      "SELECT id FROM especialidades WHERE nombre='Medicina General' LIMIT 1"
    );

    const hash = await argon2.hash("gina123");

    const [r] = await pool.query(
      `INSERT INTO usuarios (clinica_id, nombres, apellidos, email, password_hash, tipo, especialidad_id, activo)
       VALUES (?, ?, ?, ?, ?, 'MEDICO', ?, 1)
       ON DUPLICATE KEY UPDATE 
         password_hash = VALUES(password_hash),
         activo = 1`,
      [clinicaId, "Gina", "Valladares", "dra.gina.valladares@gmail.com", hash, esp?.id || null]
    );
    
    console.log("✅ Dra. Gina Valladares creada/actualizada");
    console.log("   Email: dra.gina.valladares@gmail.com");
    console.log("   Contraseña: gina123");
    console.log("   Tipo: MEDICO");
    console.log("   Clínica ID:", clinicaId);
  } catch (e) {
    console.log("❌ Error:", e.message);
  }

  await pool.end();
  process.exit(0);
})();
