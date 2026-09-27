-- ============================================================
--  079_odontologia_fase1.sql
--  Odontología · Fase 1: auditoría clínica e historial del odontograma.
--  Solo tablas nuevas (aditivo, sin tocar datos existentes).
--  Nota: routes/odontologia.js también las crea solas al arrancar
--  (ensureTablas), así que correr este archivo a mano es opcional.
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria_clinica (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL,
  modulo        VARCHAR(40)  NOT NULL,
  entidad       VARCHAR(40)  NOT NULL,
  entidad_id    INT UNSIGNED NULL,
  paciente_id   INT UNSIGNED NULL,
  usuario_id    INT UNSIGNED NOT NULL,
  accion        VARCHAR(40)  NOT NULL,
  detalle       JSON NULL,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ac_clinica_paciente (clinica_id, paciente_id, creado_en),
  INDEX idx_ac_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fotos del odontograma: la primera es el "inicial"; cada firma de sesión guarda una
CREATE TABLE IF NOT EXISTS odontograma_historial (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL,
  paciente_id   INT UNSIGNED NOT NULL,
  sesion_id     INT UNSIGNED NULL,
  usuario_id    INT UNSIGNED NULL,
  origen        ENUM('INICIAL','GUARDADO','FIRMA_SESION') NOT NULL DEFAULT 'GUARDADO',
  dientes       JSON NOT NULL,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_oh_paciente (clinica_id, paciente_id, creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
