-- ============================================================
--  055_hallazgos_clinicos.sql
--  Fase C: Hallazgos clínicos detallados (pieza FDI + descripción)
--  como lista independiente de "procedimientos realizados"
-- ============================================================

ALTER TABLE sesiones_odontologia
  ADD COLUMN hallazgos JSON NULL AFTER exploracion_clinica;
