-- ============================================================
--  081_odontologia_fase4.sql
--  Odontología · Fase 4: notas posteriores a la firma (addendum).
--  Solo se agregan; no se editan ni se borran. Aditivo.
--  Nota: routes/odontologia.js también la crea sola (ensureTablas).
-- ============================================================

CREATE TABLE IF NOT EXISTS sesion_addendas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  sesion_id   INT UNSIGNED NOT NULL,
  paciente_id INT UNSIGNED NOT NULL,
  usuario_id  INT UNSIGNED NOT NULL,
  texto       TEXT NOT NULL,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sa_sesion (clinica_id, sesion_id, creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
