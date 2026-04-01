require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function runMigration012() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "clinica_db",
    multipleStatements: true,
  });

  try {
    console.log("🚀 Ejecutando migración 012 - Curvas de Crecimiento OMS...\n");

    const sqlPath = path.join(__dirname, "012_curva_crecimiento.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    await connection.query(sql);

    console.log("✅ Migración 012 completada exitosamente");
    console.log("\n📋 Cambios aplicados:");
    console.log("   ✓ Tabla mediciones_crecimiento creada");
    console.log("   ✓ Módulo 'Curvas de Crecimiento' registrado");
    console.log("\n🎯 El módulo ya está disponible en el Expediente del paciente\n");

  } catch (error) {
    console.error("❌ Error en migración 012:", error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  runMigration012()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runMigration012;
