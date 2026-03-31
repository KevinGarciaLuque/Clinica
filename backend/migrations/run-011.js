require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function runMigration011() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "clinica_db",
    multipleStatements: true,
  });

  try {
    console.log("🚀 Ejecutando migración 011 - Módulo de Recordatorios...\n");

    const sqlPath = path.join(__dirname, "011_modulo_recordatorios.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    await connection.query(sql);

    console.log("✅ Migración 011 completada exitosamente");
    console.log("\n📋 Cambios aplicados:");
    console.log("   ✓ Módulo 'Recordatorios' agregado al sistema");
    console.log("   ✓ Tabla cita_recordatorios ampliada (Email, SMS, WhatsApp)");
    console.log("   ✓ Tabla clinica_smtp_config creada");
    console.log("   ✓ Tabla clinica_mensajeria_config creada");
    console.log("   ✓ Tabla plantillas_recordatorio creada");
    console.log("   ✓ Tabla clinica_recordatorios_config creada");
    console.log("   ✓ Tabla historial_recordatorios creada");
    console.log("\n🎯 Próximos pasos:");
    console.log("   1. Instalar dependencias: npm install twilio");
    console.log("   2. Configurar SMTP en la interfaz de Recordatorios");
    console.log("   3. Configurar Twilio para WhatsApp/SMS (opcional)");
    console.log("   4. Crear plantillas personalizadas desde la UI\n");

  } catch (error) {
    console.error("❌ Error en migración 011:", error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  runMigration011()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runMigration011;
