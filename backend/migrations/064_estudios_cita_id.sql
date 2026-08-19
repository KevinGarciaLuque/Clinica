-- 064_estudios_cita_id.sql
-- Liga los estudios solicitados a la cita en que se generaron (igual que ya
-- hace prescripciones.cita_id), para poder mostrarlos junto a la cita en Recepción.
ALTER TABLE estudios_solicitudes ADD COLUMN cita_id INT UNSIGNED NULL AFTER historia_id;
ALTER TABLE estudios_solicitudes ADD KEY idx_estudios_cita (cita_id);
