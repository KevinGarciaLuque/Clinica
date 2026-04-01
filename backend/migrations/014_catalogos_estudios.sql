-- =========================================================
-- Migración 014: Catálogo de tipos de estudios/exámenes
-- =========================================================

CREATE TABLE IF NOT EXISTS catalogos_estudios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  nombre      VARCHAR(150) NOT NULL COMMENT 'Nombre del tipo de estudio (ej: Hemograma completo)',
  categoria   ENUM('LABORATORIO','IMAGENOLOGIA','OTRO') DEFAULT 'LABORATORIO',
  descripcion TEXT NULL COMMENT 'Descripción o indicaciones por defecto',
  activo      TINYINT(1) DEFAULT 1,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  INDEX idx_cat_est_clinica (clinica_id),
  INDEX idx_cat_est_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
