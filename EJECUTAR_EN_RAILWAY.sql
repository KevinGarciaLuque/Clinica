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
