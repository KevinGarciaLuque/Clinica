
-- ============================================================
--  Migración 035 — Fix: columnas para_normal/para_pediatrica
--  + asignación módulos estéticos a Dermatología
--  Fecha: 2026-04-30
--  Idempotente: segura de ejecutar varias veces
-- ============================================================

-- 1. Agregar columna orden si no existe (de migración 008)
SET @col_orden = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'modulos_sistema'
    AND COLUMN_NAME = 'orden'
);
SET @sql_orden = IF(@col_orden = 0,
  'ALTER TABLE modulos_sistema ADD COLUMN orden INT UNSIGNED NOT NULL DEFAULT 999 AFTER ruta',
  'SELECT ''orden ya existe'' AS info'
);
PREPARE stmt FROM @sql_orden; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Agregar columna para_normal si no existe (de migración 015)
SET @col_pn = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'modulos_sistema'
    AND COLUMN_NAME = 'para_normal'
);
SET @sql_pn = IF(@col_pn = 0,
  'ALTER TABLE modulos_sistema ADD COLUMN para_normal TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''Visible en clínicas normales''',
  'SELECT ''para_normal ya existe'' AS info'
);
PREPARE stmt FROM @sql_pn; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Agregar columna para_pediatrica si no existe (de migración 015)
SET @col_pp = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'modulos_sistema'
    AND COLUMN_NAME = 'para_pediatrica'
);
SET @sql_pp = IF(@col_pp = 0,
  'ALTER TABLE modulos_sistema ADD COLUMN para_pediatrica TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''Visible en clínicas pediátricas''',
  'SELECT ''para_pediatrica ya existe'' AS info'
);
PREPARE stmt FROM @sql_pp; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Agregar columna es_pediatrica a clinicas si no existe (de migración 015)
SET @col_espd = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clinicas'
    AND COLUMN_NAME = 'es_pediatrica'
);
SET @sql_espd = IF(@col_espd = 0,
  'ALTER TABLE clinicas ADD COLUMN es_pediatrica TINYINT(1) NOT NULL DEFAULT 0 AFTER tipo_id',
  'SELECT ''es_pediatrica ya existe'' AS info'
);
PREPARE stmt FROM @sql_espd; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Asegurarse que los módulos estéticos existan con valores correctos
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, orden, descripcion, disponible, para_normal, para_pediatrica)
VALUES
  ('ficha_estetica',            'Ficha Estética',            'bi-person-vcard-fill',       '/estetica/ficha',           40, 'Datos específicos del paciente estético', 1, 1, 0),
  ('galeria_estetica',          'Galería Antes/Después',      'bi-images',                  '/estetica/galeria',         50, 'Fotografías de evolución del paciente',  1, 1, 0),
  ('presupuestos',              'Presupuestos',               'bi-receipt-cutoff',          '/estetica/presupuestos',    60, 'Cotizaciones y planes de tratamiento',   1, 1, 0),
  ('consentimientos_esteticos', 'Consentimientos',            'bi-file-earmark-check-fill', '/estetica/consentimientos', 70, 'Consentimientos informados',             1, 1, 0),
  ('seguimiento_postop',        'Seguimiento Post-Op',        'bi-clipboard2-pulse-fill',   '/estetica/seguimiento',     80, 'Control post-operatorio',                1, 1, 0);

-- 6. Actualizar para_normal=1 en módulos estéticos (por si ya existían con valor 0)
UPDATE modulos_sistema
SET para_normal = 1, para_pediatrica = 0
WHERE clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop');

-- 7. Actualizar para_normal=0 en curva_crecimiento (solo pediátrica)
UPDATE modulos_sistema SET para_normal = 0, para_pediatrica = 1 WHERE clave = 'curva_crecimiento';

-- 8. Asignar módulos base a TODOS los tipos que no los tengan
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m
WHERE m.clave IN ('dashboard','pacientes','citas','historia_clinica','chat_ia','estudios');

-- 9. Asignar módulos estéticos al tipo 'estetica'
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m
WHERE t.clave = 'estetica'
  AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop');

-- 10. Asignar módulos estéticos al tipo 'dermatologia'
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m
WHERE t.clave = 'dermatologia'
  AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop');

-- 11. Verificación final
SELECT
  t.clave  AS tipo_clinica,
  m.clave  AS modulo,
  m.para_normal,
  m.orden
FROM tipos_clinica t
JOIN tipo_clinica_modulos tcm ON tcm.tipo_id = t.id
JOIN modulos_sistema m ON m.id = tcm.modulo_id
WHERE t.clave IN ('estetica','dermatologia')
  AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop')
ORDER BY t.clave, m.orden;
