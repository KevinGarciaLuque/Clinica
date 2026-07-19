-- ============================================================
--  056_plan_tratamiento_fases.sql
--  Fase D: Plan de tratamiento integral agrupado por FASES
--  (réplica dinámica del PDF: Fase 1 Salud/Dolor, Fase 2 Restauración,
--   Fase 3 Estética/Mantenimiento — cada una con objetivo y subtotal)
-- ============================================================

ALTER TABLE plan_tratamiento_odontologia
  ADD COLUMN fases JSON NULL AFTER items,
  ADD COLUMN vigencia_dias INT UNSIGNED DEFAULT 90 AFTER costo_total,
  ADD COLUMN formas_pago VARCHAR(255) DEFAULT 'Efectivo, Tarjeta, Transferencia' AFTER vigencia_dias,
  ADD COLUMN nota_clinica TEXT AFTER formas_pago;
