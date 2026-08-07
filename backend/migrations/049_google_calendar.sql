-- ============================================================
--  Migración 049 — Integración con Google Calendar
--  Fecha: 2026-07-21
--  Objetivo: Guardar tokens OAuth de Google por médico y el
--  id del evento de Google Calendar asociado a cada cita.
-- ============================================================

CREATE TABLE IF NOT EXISTS medico_google_tokens (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medico_id      INT UNSIGNED NOT NULL,
  clinica_id     INT UNSIGNED NOT NULL,
  google_email   VARCHAR(150) NULL,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  expiry_date    BIGINT NULL,
  calendar_id    VARCHAR(150) DEFAULT 'primary',
  creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_medico_google (medico_id),
  FOREIGN KEY (medico_id)  REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE citas
  ADD COLUMN google_event_id VARCHAR(150) NULL AFTER canal;
