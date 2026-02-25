/**
 * Script para insertar (o actualizar) el usuario SUPER_ADMIN
 * Uso: node migrations/seed-superadmin.js
 */
const pool   = require("../db");
const argon2 = require("argon2");

const EMAIL    = "super@plataforma.com";
const PASSWORD = "Admin12345*";
const NOMBRES  = "Super";
const APELLIDOS = "Admin";

(async () => {
  try {
    const hash = await argon2.hash(PASSWORD);

    // Intenta insertar; si ya existe lo actualiza con la contraseña correcta
    await pool.query(
      `INSERT INTO usuarios (clinica_id, nombres, apellidos, email, password_hash, tipo, activo)
       VALUES (NULL, ?, ?, ?, ?, 'SUPER_ADMIN', 1)
       ON DUPLICATE KEY UPDATE
         password_hash = VALUES(password_hash),
         activo        = 1`,
      [NOMBRES, APELLIDOS, EMAIL, hash]
    );

    console.log("✅  Super Admin creado/actualizado correctamente.");
    console.log("   Email   :", EMAIL);
    console.log("   Password:", PASSWORD);
  } catch (err) {
    console.error("❌  Error:", err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
