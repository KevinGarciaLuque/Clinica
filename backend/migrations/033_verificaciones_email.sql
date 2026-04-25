-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 033 — Tabla verificaciones_email
-- Usada por el portal público de registro de pacientes
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS verificaciones_email (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id  INT UNSIGNED NOT NULL,
  clinica_id   INT UNSIGNED NOT NULL,
  token        VARCHAR(100) NOT NULL UNIQUE,
  expires_at   DATETIME     NOT NULL,
  usado        TINYINT(1)   DEFAULT 0,
  creado_en    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ve_token      (token),
  INDEX idx_ve_paciente   (paciente_id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
