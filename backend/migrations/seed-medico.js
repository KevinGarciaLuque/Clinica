require("dotenv").config();
const pool  = require("../db");
const argon2 = require("argon2");

(async () => {
  // Clínica id=1
  const clinicaId = 1;

  // Buscar especialidad "Medicina General"
  const [[esp]] = await pool.query(
    "SELECT id FROM especialidades WHERE nombre='Medicina General' LIMIT 1"
  );

  const hash = await argon2.hash("medico123");

  try {
    const [r] = await pool.query(
      `INSERT INTO usuarios (clinica_id, nombres, apellidos, email, password_hash, tipo, especialidad_id, activo)
       VALUES (?, ?, ?, ?, ?, 'MEDICO', ?, 1)`,
      [clinicaId, "Carlos", "Mendoza", "medico@clinica.com", hash, esp?.id || null]
    );
    console.log("✅ Médico creado — id:", r.insertId);
    console.log("   Email: medico@clinica.com");
    console.log("   Contraseña: medico123");
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      console.log("⚠️  Ya existe un médico con ese email.");
    } else {
      console.log("❌ Error:", e.message);
    }
  }

  process.exit(0);
})();
