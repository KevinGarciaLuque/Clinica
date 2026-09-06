-- ============================================================
--  074 — Guardar el error de generación de PDF en contratos/recibos
--  Para poder diagnosticar por qué un PDF no se adjuntó al correo.
-- ============================================================
ALTER TABLE contratos_licencia ADD COLUMN pdf_error VARCHAR(400) NULL AFTER pdf;
ALTER TABLE recibos_licencia   ADD COLUMN pdf_error VARCHAR(400) NULL AFTER pdf;
