-- ============================================================
--  Migración 007 — Galería Estética (Antes/Después)
-- ============================================================

-- Tabla de sesiones fotográficas
CREATE TABLE IF NOT EXISTS galeria_sesiones (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id   INT UNSIGNED NOT NULL COMMENT 'FK a pacientes',
  nombre        VARCHAR(200) NOT NULL COMMENT 'Nombre del procedimiento',
  fecha         DATE NOT NULL,
  creado_en     DATETIME DEFAULT NOW(),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  INDEX idx_paciente (paciente_id),
  INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de fotos (antes/después)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  VERIFICACIÓN
-- ================================================================
SELECT 'Migración 007 completada - Galería Estética' AS Estado;

SELECT TABLE_NAME, TABLE_ROWS 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('galeria_sesiones', 'galeria_fotos');
