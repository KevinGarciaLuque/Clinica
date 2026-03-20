-- ============================================================
--  Migración 010 — Módulo de Consulta
--  Fecha: 2026-03-19
--  Descripción: Agrega el módulo de Consulta al sidebar
-- ============================================================

-- Insertar el módulo de Consulta
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, orden, descripcion, disponible) 
VALUES ('consulta', 'Consulta', 'bi-clipboard2-pulse-fill', '/consulta', 35, 'Vista de citas del día y sala de espera', 1);

-- Asignar el módulo de Consulta a TODOS los tipos de clínica
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave = 'consulta';

-- Verificación
SELECT 
  'Módulo de Consulta agregado exitosamente' AS resultado,
  COUNT(*) as total_asignaciones
FROM tipo_clinica_modulos tcm
JOIN modulos_sistema m ON m.id = tcm.modulo_id
WHERE m.clave = 'consulta';
