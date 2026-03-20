-- ============================================================
--  Migración: Agregar módulo de Consulta
--  Fecha: 2026-03-19
-- ============================================================

-- Agregar el módulo de Consulta
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion, disponible) VALUES
  ('consulta', 'Consulta', 'bi-clipboard2-pulse-fill', '/consulta', 'Vista de citas del día y sala de espera', 1);

-- Obtener el ID del módulo recién insertado (o existente)
SET @modulo_consulta_id = (SELECT id FROM modulos_sistema WHERE clave = 'consulta');

-- Asignar el módulo de Consulta a TODOS los tipos de clínica
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, @modulo_consulta_id
FROM tipos_clinica t
WHERE @modulo_consulta_id IS NOT NULL;

-- Asignar orden al módulo (después de Citas)
UPDATE modulos_sistema SET orden = 35 WHERE clave = 'consulta';

SELECT 'Módulo de Consulta agregado exitosamente' AS resultado;
