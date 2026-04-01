require("dotenv").config({ path: __dirname + "/../.env" });
const pool = require("../db");

(async () => {
  try {
    console.log("1. ALTER TABLE clinicas ...");
    await pool.query("ALTER TABLE clinicas ADD COLUMN es_pediatrica TINYINT(1) NOT NULL DEFAULT 0 AFTER tipo_id");
    console.log("   ✅ es_pediatrica agregada");

    console.log("2. ALTER TABLE modulos_sistema ...");
    await pool.query("ALTER TABLE modulos_sistema ADD COLUMN para_normal TINYINT(1) NOT NULL DEFAULT 1, ADD COLUMN para_pediatrica TINYINT(1) NOT NULL DEFAULT 1");
    console.log("   ✅ para_normal y para_pediatrica agregadas");

    console.log("3. INSERT curva_crecimiento ...");
    await pool.query(`INSERT IGNORE INTO modulos_sistema (clave,nombre,icono,ruta,descripcion,disponible,orden,para_normal,para_pediatrica)
      VALUES ('curva_crecimiento','Curvas de Crecimiento','bi-graph-up-arrow','/crecimiento','Seguimiento antropométrico OMS',1,95,0,1)`);
    console.log("   ✅ módulo insertado");

    console.log("4. Asignar a tipos ...");
    await pool.query(`INSERT IGNORE INTO tipo_clinica_modulos (tipo_id,modulo_id)
      SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m WHERE m.clave='curva_crecimiento'`);
    console.log("   ✅ asignado a todos los tipos");

    console.log("5. Flags curva_crecimiento ...");
    await pool.query("UPDATE modulos_sistema SET para_normal=0, para_pediatrica=1 WHERE clave='curva_crecimiento'");
    console.log("   ✅ solo pediátrica");

    console.log("\n✅ Migración 015 completada correctamente");
    process.exit(0);
  } catch (e) {
    if (e.message.includes("Duplicate column")) {
      console.log("   ⚠️  Columna ya existe, continuando...");
    } else {
      console.error("❌ Error:", e.message);
      process.exit(1);
    }
  }
})();
