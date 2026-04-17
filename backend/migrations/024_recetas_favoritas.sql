-- ============================================================
-- Migración 024: Tabla recetas_favoritas del médico
-- (La columna codigo_cie_sugerido se agrega en la migración 023)
-- ============================================================

CREATE TABLE IF NOT EXISTS recetas_favoritas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  medico_id   INT UNSIGNED NOT NULL,
  nombre      VARCHAR(200) NOT NULL COMMENT 'Ej: Tratamiento IRA pediátrica',
  notas       TEXT,
  items_json  JSON         NOT NULL COMMENT '[{medicamento_id, medicamento_texto, dosis, duracion, cantidad, instrucciones}]',
  creado_en   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (medico_id)  REFERENCES usuarios(id)  ON DELETE CASCADE,
  INDEX idx_medico (medico_id),
  INDEX idx_clinica (clinica_id)
) ENGINE=InnoDB;
