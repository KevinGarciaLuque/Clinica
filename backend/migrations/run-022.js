// Ejecutar migración 022 — Módulo Vacunas en el Sidebar
require("dotenv").config({ path: __dirname + "/../.env" });
const pool = require("../db");

(async () => {
  try {
    console.log("1. Insertando módulo 'vacunas' en modulos_sistema...");
    await pool.query(`INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion, disponible, orden, para_normal, para_pediatrica)
      VALUES ('vacunas', 'Vacunas', 'bi-shield-plus', '/vacunas', 'Carnet digital de vacunación PAI', 1, 96, 0, 1)`);
    console.log("   ✅ módulo insertado");

    console.log("2. Asignando a todos los tipos de clínica...");
    await pool.query(`INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
      SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m WHERE m.clave = 'vacunas'`);
    console.log("   ✅ asignado a todos los tipos");

    console.log("3. Marcando como solo pediátrica...");
    await pool.query("UPDATE modulos_sistema SET para_normal = 0, para_pediatrica = 1 WHERE clave = 'vacunas'");
    console.log("   ✅ solo visible en clínicas pediátricas");

    console.log("\n✅ Migración 022 completada correctamente");
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
})();
