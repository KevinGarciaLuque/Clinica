-- ============================================================
-- Migración 025: Medicamentos favoritos por médico
-- Permite al médico marcar/desmarcar medicamentos individuales
-- ============================================================

CREATE TABLE IF NOT EXISTS medicamentos_favoritos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medico_id     INT UNSIGNED NOT NULL,
  medicamento_id INT UNSIGNED NOT NULL,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_med_fav (medico_id, medicamento_id),
  FOREIGN KEY (medico_id)      REFERENCES usuarios(id)     ON DELETE CASCADE,
  FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
