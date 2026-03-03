-- ============================================================
--  Migración 008 — Orden de Módulos en Sidebar
--  Fecha: 2026-03-02
--  Objetivo: Agregar ordenamiento lógico según flujo de trabajo
-- ============================================================

-- ── 1. Agregar columna de orden a modulos_sistema ─────────────
ALTER TABLE modulos_sistema
  ADD COLUMN orden INT UNSIGNED NOT NULL DEFAULT 999
    COMMENT 'Orden de aparición en el menú (menor = más arriba)'
  AFTER ruta;

-- ── 2. Actualizar orden según flujo de trabajo ────────────────
-- Orden lógico para Cirugía Estética:
-- 1. Dashboard (visión general)
-- 2. Pacientes (registro/búsqueda)
-- 3. Citas (agendar consulta)
-- 4. Ficha Estética (evaluación inicial)
-- 5. Galería Antes/Después (documentación fotográfica)
-- 6. Presupuestos (plan de tratamiento)
-- 7. Consentimientos (autorización legal)
-- 8. Seguimiento Post-Op (controles)
-- 9. Historia Clínica (expediente completo)
-- 10. Estudios e Imágenes (complementarios)
-- 11. Asistente IA (herramienta de apoyo)

UPDATE modulos_sistema SET orden = 10  WHERE clave = 'dashboard';
UPDATE modulos_sistema SET orden = 20  WHERE clave = 'pacientes';
UPDATE modulos_sistema SET orden = 30  WHERE clave = 'citas';
UPDATE modulos_sistema SET orden = 40  WHERE clave = 'ficha_estetica';
UPDATE modulos_sistema SET orden = 50  WHERE clave = 'galeria_estetica';
UPDATE modulos_sistema SET orden = 60  WHERE clave = 'presupuestos';
UPDATE modulos_sistema SET orden = 70  WHERE clave = 'consentimientos_esteticos';
UPDATE modulos_sistema SET orden = 80  WHERE clave = 'seguimiento_postop';
UPDATE modulos_sistema SET orden = 90  WHERE clave = 'historia_clinica';
UPDATE modulos_sistema SET orden = 100 WHERE clave = 'estudios';
UPDATE modulos_sistema SET orden = 110 WHERE clave = 'chat_ia';

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- SELECT clave, nombre, orden
-- FROM modulos_sistema
-- ORDER BY orden;
