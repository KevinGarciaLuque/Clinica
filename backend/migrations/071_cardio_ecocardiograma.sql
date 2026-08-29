-- 071_cardio_ecocardiograma.sql
-- Hoja de Ecocardiograma (formato cardiología pediátrica) dentro de la consulta.
-- - Columna JSON en historias_clinicas para guardar el formulario del eco.
-- - Módulo del sistema para poder mostrar/ocultar la pestaña por clínica.

ALTER TABLE historias_clinicas ADD COLUMN datos_cardio_eco JSON NULL AFTER datos_derma;

INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion, orden) VALUES
  ('cardiologia_ecocardiograma', 'Ecocardiograma', 'bi-heart-pulse-fill', '/consulta', 'Hoja de ecocardiograma en la consulta (cardiología)', 45);

-- Enlazar el módulo a los tipos de clínica de cardiología
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave = 'cardiologia_ecocardiograma'
  AND (LOWER(t.clave) LIKE '%cardio%' OR LOWER(t.nombre) LIKE '%cardio%');
