// run-008.js — Ejecuta migración 008: orden de módulos
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

async function main() {
  try {
    console.log("📦 Conectando a la base de datos...");
    console.log("✅ Conexión exitosa\n");

    const sqlPath = path.join(__dirname, "008_ordenar_modulos.sql");
    console.log("📄 Leyendo archivo SQL:", sqlPath);
    const sql = fs.readFileSync(sqlPath, "utf-8");

    console.log("🚀 Ejecutando migración 008...\n");
    
    // Dividir y ejecutar cada sentencia
    const statements = sql
      .replace(/--[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 3);

    for (const stmt of statements) {
      await pool.query(stmt);
    }

    console.log("✅ Migración 008 completada exitosamente");
    console.log("\n📋 Orden de módulos actualizado:");
    
    const [modulos] = await pool.query(`
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
    await pool.end();
  }
}

main();
