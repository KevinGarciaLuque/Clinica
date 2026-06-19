-- ============================================================
-- MIGRACIÓN 048 — Agrega columna diagnostico_desc a historias_clinicas
-- Permite guardar diagnósticos libres (sin código CIE-10)
-- ============================================================
ALTER TABLE historias_clinicas
  ADD COLUMN diagnostico_desc TEXT NULL AFTER diagnostico_cie;
