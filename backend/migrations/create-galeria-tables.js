const db = require("../db");

async function createTables() {
  try {
    console.log("📸 Creando tablas de Galería Estética...\n");
    
    // Tabla de sesiones
    await db.query(`
      CREATE TABLE IF NOT EXISTS galeria_sesiones (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        paciente_id   INT UNSIGNED NOT NULL,
        nombre        VARCHAR(200) NOT NULL COMMENT 'Nombre del procedimiento',
        fecha         DATE NOT NULL,
        creado_en     DATETIME DEFAULT NOW(),
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
        INDEX idx_paciente (paciente_id),
        INDEX idx_fecha (fecha)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Tabla 'galeria_sesiones' creada");
    
    // Tabla de fotos
    await db.query(`
      CREATE TABLE IF NOT EXISTS galeria_fotos (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        sesion_id       INT UNSIGNED NOT NULL,
        paciente_id     INT UNSIGNED NOT NULL,
        momento         ENUM('antes','despues') NOT NULL COMMENT 'Antes o después del procedimiento',
        pose            VARCHAR(50) NOT NULL COMMENT 'frontal, 45_izq, 45_der, perfil_izq, perfil_der, cenital',
        archivo_nombre  VARCHAR(255) NOT NULL,
        creado_en       DATETIME DEFAULT NOW(),
        FOREIGN KEY (sesion_id) REFERENCES galeria_sesiones(id) ON DELETE CASCADE,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
        UNIQUE KEY unique_pose (sesion_id, momento, pose),
        INDEX idx_sesion (sesion_id),
        INDEX idx_momento (momento)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Tabla 'galeria_fotos' creada");
    
    // Verificar que existen
    const [tables] = await db.query("SHOW TABLES LIKE 'galeria%'");
    console.log("\n📋 Tablas en la base de datos:");
    tables.forEach(t => console.log("   -", Object.values(t)[0]));
    
    console.log("\n✅ Migración completada exitosamente");
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

createTables();
