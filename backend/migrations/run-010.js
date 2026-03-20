/**
 * Ejecuta la migración 010: Agregar módulo de Consulta
 */
const db = require("../db");

async function run() {
  console.log("🔄 Ejecutando migración 010: Módulo de Consulta...");
  
  try {
    // 1. Insertar el módulo
    console.log("📝 Insertando módulo de Consulta...");
    await db.query(`
      INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion, disponible) 
      VALUES ('consulta', 'Consulta', 'bi-clipboard2-pulse-fill', '/consulta', 'Vista de citas del día y sala de espera', 1)
    `);
    
    // 2. Obtener el ID del módulo
    const [modulos] = await db.query("SELECT id FROM modulos_sistema WHERE clave = 'consulta'");
    
    if (modulos.length === 0) {
      throw new Error("No se pudo insertar el módulo de Consulta");
    }
    
    const moduloId = modulos[0].id;
    console.log(`✅ Módulo insertado con ID: ${moduloId}`);
    
    // 3. Asignar a todos los tipos de clínica
    console.log("📝 Asignando a tipos de clínica...");
    await db.query(`
      INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
      SELECT t.id, ?
      FROM tipos_clinica t
    `, [moduloId]);
    
    // 4. Asignar orden
    console.log("📝 Asignando orden...");
    await db.query("UPDATE modulos_sistema SET orden = 35 WHERE clave = 'consulta'");
    
    console.log("✅ Migración 010 completada exitosamente");
    
    // Verificar
    const [verify] = await db.query("SELECT * FROM modulos_sistema WHERE clave = 'consulta'");
    if (verify.length > 0) {
      console.log("✅ Verificación exitosa:");
      console.log(verify[0]);
    }
    
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error ejecutando migración 010:", err.message);
    console.error(err);
    await db.end();
    process.exit(1);
  }
}

run();
