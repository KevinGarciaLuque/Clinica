-- ============================================================
--  080_odontologia_fase3.sql
--  Odontología · Fase 3: versiones del plan de tratamiento y
--  vínculo sesión ↔ factura (evita cobrar dos veces la atención).
--  Aditivo: no modifica datos existentes.
--  Nota: routes/odontologia.js también lo aplica solo al arrancar
--  (ensureTablas), así que correrlo a mano es opcional.
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_tratamiento_historial (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL,
  paciente_id   INT UNSIGNED NOT NULL,
  version       INT UNSIGNED NOT NULL,
  fases         JSON NOT NULL,
  costo_total   DECIMAL(10,2) DEFAULT 0,
  vigencia_dias INT UNSIGNED NULL,
  formas_pago   VARCHAR(255) NULL,
  nota_clinica  TEXT NULL,
  usuario_id    INT UNSIGNED NULL,
  origen        ENUM('INICIAL','GUARDADO') NOT NULL DEFAULT 'GUARDADO',
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pth_paciente (clinica_id, paciente_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE sesiones_odontologia ADD COLUMN factura_id INT UNSIGNED NULL;
