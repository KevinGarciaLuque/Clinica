-- ============================================================
-- EJECUTAR ESTOS SQL UNO POR UNO EN RAILWAY
-- ============================================================

-- PASO 1: Ejecuta primero este (copia solo esta línea):
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, orden, descripcion, disponible) VALUES ('consulta', 'Consulta', 'bi-clipboard2-pulse-fill', '/consulta', 35, 'Vista de citas del día y sala de espera', 1);

-- PASO 2: Luego ejecuta este (copia desde INSERT hasta el punto y coma):
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id) SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m WHERE m.clave = 'consulta';

-- PASO 3: Finalmente verifica con este:
SELECT m.id, m.clave, m.nombre, m.icono, m.ruta, m.orden, COUNT(tcm.tipo_id) as tipos_asignados FROM modulos_sistema m LEFT JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = m.id WHERE m.clave = 'consulta' GROUP BY m.id;

-- ============================================================
-- MIGRACIÓN 026 + 027: Columnas de foto de perfil de usuario
-- Ejecutar si el login falla con "Unknown column 'foto_url'"
-- ============================================================

-- Agregar foto_url (ignorar error si ya existe)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500) NULL;

-- Agregar foto_cloudinary_id (ignorar error si ya existe)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_cloudinary_id VARCHAR(255) NULL;

-- Verificar que quedaron:
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'usuarios'
  AND COLUMN_NAME IN ('foto_url', 'foto_cloudinary_id');

-- ============================================================
-- MIGRACIÓN 034: Módulos estéticos para Dermatología + Fix
-- Ejecutar si clínicas de tipo 'estetica' o 'dermatologia'
-- no muestran los módulos: Ficha Estética, Galería, etc.
-- ============================================================

-- PASO 1: Asegurarse que los módulos estéticos existen con para_normal=1
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion, disponible, para_normal, para_pediatrica, orden) VALUES
  ('ficha_estetica',             'Ficha Estética',            'bi-person-vcard-fill',      '/estetica/ficha',            'Datos específicos del paciente estético', 1, 1, 0, 51),
  ('galeria_estetica',           'Galería Antes/Después',     'bi-images',                 '/estetica/galeria',          'Fotografías de evolución del paciente',  1, 1, 0, 52),
  ('presupuestos',               'Presupuestos',              'bi-receipt-cutoff',         '/estetica/presupuestos',     'Cotizaciones y planes de tratamiento',   1, 1, 0, 53),
  ('consentimientos_esteticos',  'Consentimientos',           'bi-file-earmark-check-fill','/estetica/consentimientos',  'Consentimientos informados',             1, 1, 0, 54),
  ('seguimiento_postop',         'Seguimiento Post-Op',       'bi-clipboard2-pulse-fill',  '/estetica/seguimiento',      'Control post-operatorio',                1, 1, 0, 55);

-- PASO 2: Asegurarse que para_normal=1 en módulos estéticos (por si ya existían con valor 0)
UPDATE modulos_sistema SET para_normal = 1
WHERE clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop');

-- PASO 3: Asignar módulos estéticos al tipo 'estetica'
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m
WHERE t.clave = 'estetica'
  AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop');

-- PASO 4: Asignar módulos estéticos al tipo 'dermatologia'
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m
WHERE t.clave = 'dermatologia'
  AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop');

-- PASO 5: Verificar que la clínica 15 tiene tipo asignado y sus módulos
SELECT c.id, c.nombre, c.slug, t.clave AS tipo_clave, t.nombre AS tipo_nombre
FROM clinicas c
LEFT JOIN tipos_clinica t ON t.id = c.tipo_id
WHERE c.id = 15;

-- PASO 6: Ver los módulos que verá la clínica 15
SELECT ms.clave, ms.nombre, ms.ruta, ms.para_normal, ms.orden
FROM modulos_sistema ms
INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id
INNER JOIN clinicas c ON c.tipo_id = tcm.tipo_id
WHERE c.id = 15 AND ms.disponible = 1
ORDER BY ms.orden;

