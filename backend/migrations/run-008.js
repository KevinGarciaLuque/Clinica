const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const config = {
  host: "localhost",
  user: "root",
  password: "",
  database: "clinica_db",
  multipleStatements: true,
};

async function main() {
  let connection;
  try {
    console.log("📦 Conectando a la base de datos...");
    connection = await mysql.createConnection(config);
    console.log("✅ Conexión exitosa\n");

    const sqlPath = path.join(__dirname, "008_ordenar_modulos.sql");
    console.log("📄 Leyendo archivo SQL:", sqlPath);
    const sql = fs.readFileSync(sqlPath, "utf-8");

    console.log("🚀 Ejecutando migración 008...\n");
    await connection.query(sql);

    console.log("✅ Migración 008 completada exitosamente");
    console.log("\n📋 Orden de módulos actualizado:");
    
    const [modulos] = await connection.query(`
      SELECT clave, nombre, orden
      FROM modulos_sistema
      ORDER BY orden
    `);
    
    modulos.forEach(m => {
      console.log(`   ${String(m.orden).padStart(3, ' ')} - ${m.nombre.padEnd(30, ' ')} (${m.clave})`);
    });

  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
