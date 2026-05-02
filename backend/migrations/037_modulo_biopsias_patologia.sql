-- ============================================================
--  Migración 037 — Módulo Biopsias y Patología
--  Fecha: 2026-05-01
--  Objetivo: Registrar el módulo biopsias_patologia en
--  modulos_sistema y asignarlo a los tipos 'estetica' y
--  'dermatologia', ya que es un módulo clínico crítico de derm.
-- ============================================================

-- 1. Registrar el módulo en el catálogo
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion)
VALUES (
  'biopsias_patologia',
  'Biopsias y Patología',
  'bi-eyedropper',
  '/estetica/biopsias',
  'Registro y seguimiento de muestras histopatológicas y resultados patológicos'
);

-- 2. Asignar módulo a los tipos estética y dermatología
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE t.clave IN ('estetica', 'dermatologia')
  AND m.clave = 'biopsias_patologia';

-- 3. También asignarlo a clínicas de tipo 'general' que gestionen procedimientos derma
--    (comentar si no aplica)
-- INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
-- SELECT t.id, m.id
-- FROM tipos_clinica t
-- CROSS JOIN modulos_sistema m
-- WHERE t.clave = 'general'
--   AND m.clave = 'biopsias_patologia';

-- Verificación
SELECT
  t.clave  AS tipo_clinica,
  m.clave  AS modulo_clave,
  m.nombre AS nombre_modulo,
  m.ruta
FROM tipo_clinica_modulos tcm
JOIN tipos_clinica      t ON t.id = tcm.tipo_id
JOIN modulos_sistema    m ON m.id = tcm.modulo_id
WHERE m.clave = 'biopsias_patologia'
ORDER BY t.clave;
