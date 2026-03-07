const pool = require("../db");
const fs = require("fs");
const path = require("path");

async function runMigrations() {
  try {
    console.log("🔄 Ejecutando migración 006...");
    const sql006 = fs.readFileSync(
      path.join(__dirname, "006_tipos_clinica_modulos.sql"),
      "utf8"
    );
    
    // Dividir por ; y ejecutar cada statement
    const statements006 = sql006
      .split(";")
      .map(s => s.trim())
      .filter(s => s && !s.startsWith("--"));
    
    for (const stmt of statements006) {
      if (stmt) {
        await pool.query(stmt);
      }
    }
    
    console.log("✅ Migración 006 completada");
    
    console.log("🔄 Ejecutando migración 008...");
    const sql008 = fs.readFileSync(
      path.join(__dirname, "008_ordenar_modulos.sql"),
      "utf8"
    );
    
    const statements008 = sql008
      .split(";")
      .map(s => s.trim())
      .filter(s => s && !s.startsWith("--"));
    
    for (const stmt of statements008) {
      if (stmt) {
        await pool.query(stmt);
      }
    }
    
    console.log("✅ Migración 008 completada");
    
    // Verificar resultado
    const [modulos] = await pool.query(
      "SELECT clave, nombre, orden FROM modulos_sistema ORDER BY orden"
    );
    
    console.log("\n📋 Módulos creados:");
    console.table(modulos);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

runMigrations();
