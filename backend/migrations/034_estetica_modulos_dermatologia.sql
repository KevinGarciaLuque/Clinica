-- ============================================================
--  Migración 034 — Módulos estéticos para Dermatología
--  Fecha: 2026-04-30
--  Objetivo: Asignar los módulos de clínica estética (Ficha estética,
--  Galería, Presupuestos, Consentimientos, Seguimiento Post-Op)
--  también al tipo "dermatologia", ya que comparten flujo de trabajo.
-- ============================================================

-- Asignar módulos estéticos al tipo 'dermatologia'
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE t.clave = 'dermatologia'
  AND m.clave IN (
    'ficha_estetica',
    'galeria_estetica',
    'presupuestos',
    'consentimientos_esteticos',
    'seguimiento_postop'
  );

-- Asegurarse de que estos módulos sean visibles para clínicas normales (adultos)
UPDATE modulos_sistema
SET para_normal = 1
WHERE clave IN (
  'ficha_estetica',
  'galeria_estetica',
  'presupuestos',
  'consentimientos_esteticos',
  'seguimiento_postop'
);

-- Verificación
SELECT
  t.clave  AS tipo_clinica,
  m.clave  AS modulo,
  m.nombre AS nombre_modulo,
  m.para_normal,
  m.para_pediatrica
FROM tipo_clinica_modulos tcm
JOIN tipos_clinica      t ON t.id = tcm.tipo_id
JOIN modulos_sistema    m ON m.id = tcm.modulo_id
WHERE t.clave IN ('estetica', 'dermatologia')
  AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop')
ORDER BY t.clave, m.orden;
