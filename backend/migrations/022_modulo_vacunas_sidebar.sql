 -- ============================================================
-- Migración 022: Módulo Vacunas en el Sidebar
-- ============================================================

-- Insertar módulo Vacunas en modulos_sistema (si no existe)
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion, disponible, orden, para_normal, para_pediatrica)
VALUES ('vacunas', 'Vacunas', 'bi-shield-plus', '/vacunas', 'Carnet digital de vacunación PAI', 1, 96, 0, 1);

-- Asignar a TODOS los tipos de clínica
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave = 'vacunas';

-- Solo visible en clínicas pediátricas (igual que curvas de crecimiento)
UPDATE modulos_sistema SET para_normal = 0, para_pediatrica = 1 WHERE clave = 'vacunas';
