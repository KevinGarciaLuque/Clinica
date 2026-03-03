const fs = require("fs");
const path = require("path");
const db = require("../db");

async function run() {
  try {
    console.log("📸 Ejecutando migración 007: Galería Estética...\n");
    
    const sql = fs.readFileSync(path.join(__dirname, "007_galeria_estetica.sql"), "utf8");
    
    // Dividir por ; y ejecutar cada statement
    const statements = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));
    
    for (const stmt of statements) {
      try {
        await db.query(stmt);
        console.log("✅", stmt.substring(0, 60).replace(/\s+/g, " ") + "...");
      } catch (e) {
        if (e.message.includes("already exists")) {
          console.log("⚠️  Tabla ya existe, omitiendo...");
        } else {
          throw e;
        }
      }
    }
    
    console.log("\n✅ Migración 007 completada exitosamente");
    console.log("📋 Tablas creadas:");
    console.log("   - galeria_sesiones");
    console.log("   - galeria_fotos");
    
    process.exit(0);
  } catch (e) {
    console.error("❌ Error en migración 007:", e.message);
    process.exit(1);
  }
}

run();
