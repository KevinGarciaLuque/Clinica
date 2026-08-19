-- 060_recepcion_envio.sql
-- Cola de envío a recepción para recetas y estudios solicitados.
ALTER TABLE prescripciones
  ADD COLUMN enviado_recepcion_en DATETIME NULL AFTER estado,
  ADD COLUMN recibido_recepcion_en DATETIME NULL AFTER enviado_recepcion_en;

ALTER TABLE estudios_solicitudes
  ADD COLUMN enviado_recepcion_en DATETIME NULL AFTER estado,
  ADD COLUMN recibido_recepcion_en DATETIME NULL AFTER enviado_recepcion_en;
