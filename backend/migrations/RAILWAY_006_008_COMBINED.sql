-- ============================================================
--  Migración 006 + 008 — Módulos del Sistema
-- ============================================================

-- ── 1. Catálogo de tipos / especialidades de clínica ─────────
CREATE TABLE IF NOT EXISTS tipos_clinica (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clave       VARCHAR(50)  NOT NULL UNIQUE COMMENT 'estetica, general, dental, etc.',
  nombre      VARCHAR(120) NOT NULL,
  icono       VARCHAR(60)  NOT NULL DEFAULT 'bi-building-fill',
  color       VARCHAR(7)   NOT NULL DEFAULT '#2196f3',
  descripcion VARCHAR(255),
  activo      TINYINT(1)   DEFAULT 1,
  creado_en   DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── 2. Catálogo de módulos del sistema ───────────────────────
CREATE TABLE IF NOT EXISTS modulos_sistema (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clave      VARCHAR(60)  NOT NULL UNIQUE,
  nombre     VARCHAR(120) NOT NULL,
  icono      VARCHAR(60)  NOT NULL DEFAULT 'bi-grid',
  ruta       VARCHAR(150) NOT NULL,
  descripcion VARCHAR(255),
  disponible TINYINT(1)   DEFAULT 1
) ENGINE=InnoDB;

-- ── 3. Qué módulos activa cada tipo de clínica (N:M) ─────────
CREATE TABLE IF NOT EXISTS tipo_clinica_modulos (
  tipo_id    INT UNSIGNED NOT NULL,
  modulo_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (tipo_id, modulo_id),
  FOREIGN KEY (tipo_id)   REFERENCES tipos_clinica(id)   ON DELETE CASCADE,
  FOREIGN KEY (modulo_id) REFERENCES modulos_sistema(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 4. Agregar tipo_id a clinicas (si no existe) ─────────────
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.columns 
  WHERE table_schema = DATABASE() 
    AND table_name = 'clinicas' 
    AND column_name = 'tipo_id'
);

SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE clinicas ADD COLUMN tipo_id INT UNSIGNED NULL COMMENT "FK a tipos_clinica" AFTER slug, ADD FOREIGN KEY fk_clinica_tipo (tipo_id) REFERENCES tipos_clinica(id) ON DELETE SET NULL',
  'SELECT "La columna tipo_id ya existe" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
--  SEEDS - Tipos de Clínica
-- ================================================================
INSERT IGNORE INTO tipos_clinica (clave, nombre, icono, color, descripcion) VALUES
  ('general',       'Medicina General',          'bi-heart-pulse-fill',   '#2196f3', 'Atención médica general y familiar'),
  ('estetica',      'Cirugía Estética',           'bi-stars',              '#e91e8c', 'Procedimientos estéticos y cirugía plástica'),
  ('dental',        'Odontología',                'bi-emoji-smile-fill',   '#FF9800', 'Clínica dental y odontología general'),
  ('cardiologia',   'Cardiología',                'bi-activity',           '#f44336', 'Especialidad en corazón y sistema cardiovascular'),
  ('pediatria',     'Pediatría',                  'bi-balloon-heart-fill', '#9C27B0', 'Atención médica a niños y adolescentes'),
  ('ginecologia',   'Ginecología y Obstetricia',  'bi-gender-female',      '#e91e63', 'Salud femenina y obstetricia'),
  ('dermatologia',  'Dermatología',               'bi-brightness-high-fill','#FF5722','Piel, cabello y uñas'),
  ('oftalmologia',  'Oftalmología',               'bi-eye-fill',           '#00BCD4', 'Salud visual y enfermedades oculares'),
  ('traumatologia', 'Traumatología',              'bi-bandaid-fill',       '#607D8B', 'Sistema músculo-esquelético'),
  ('nutricion',     'Nutrición y Dietética',      'bi-apple',              '#4CAF50', 'Alimentación y nutrición clínica'),
  ('psicologia',    'Psicología',                 'bi-brain',              '#673AB7', 'Salud mental y bienestar psicológico'),
  ('veterinaria',   'Veterinaria',                'bi-bug-fill',           '#795548', 'Medicina veterinaria y animales de compañía');

-- ================================================================
--  SEEDS - Módulos del Sistema
-- ================================================================
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion) VALUES
  ('dashboard',              'Dashboard',                 'bi-speedometer2',          '/dashboard',                 'Panel principal con estadísticas'),
  ('pacientes',              'Pacientes',                 'bi-people-fill',            '/pacientes',                 'Gestión de expedientes de pacientes'),
  ('citas',                  'Citas',                     'bi-calendar-check-fill',    '/citas',                     'Agendamiento y gestión de citas'),
  ('historia_clinica',       'Historia Clínica',          'bi-journal-medical',        '/historia',                  'HCE con metodología SOAP'),
  ('chat_ia',                'Asistente IA',              'bi-robot',                  '/chat-ia',                   'Asistente con GPT-4o'),
  ('estudios',               'Estudios e Imágenes',       'bi-file-earmark-medical-fill','/estudios',               'Solicitud y gestión de estudios'),
  ('galeria_estetica',       'Galería Antes/Después',     'bi-images',                 '/estetica/galeria',          'Fotografías de evolución del paciente'),
  ('presupuestos',           'Presupuestos',              'bi-receipt-cutoff',         '/estetica/presupuestos',     'Cotizaciones y planes de tratamiento'),
  ('consentimientos_esteticos','Consentimientos',         'bi-file-earmark-check-fill','/estetica/consentimientos',  'Consentimientos informados por procedimiento'),
  ('seguimiento_postop',     'Seguimiento Post-Op',       'bi-clipboard2-pulse-fill',  '/estetica/seguimiento',      'Control y seguimiento post-operatorio'),
  ('ficha_estetica',         'Ficha Estética',            'bi-person-vcard-fill',      '/estetica/ficha',            'Datos específicos del paciente estético');

-- ================================================================
--  Asignar Módulos Base a Todos los Tipos
-- ================================================================
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave IN ('dashboard','pacientes','citas','historia_clinica','chat_ia','estudios');

-- ================================================================
--  Módulos Específicos de Cirugía Estética
-- ================================================================
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE t.clave = 'estetica'
  AND m.clave IN ('galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop','ficha_estetica');

-- ================================================================
--  Migración 008 - Agregar Columna de Orden
-- ================================================================
SET @orden_exists = (
  SELECT COUNT(*) 
  FROM information_schema.columns 
  WHERE table_schema = DATABASE() 
    AND table_name = 'modulos_sistema' 
    AND column_name = 'orden'
);

SET @sql2 = IF(
  @orden_exists = 0,
  'ALTER TABLE modulos_sistema ADD COLUMN orden INT UNSIGNED NOT NULL DEFAULT 999 COMMENT "Orden de aparición en el menú" AFTER ruta',
  'SELECT "La columna orden ya existe" AS info'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- ================================================================
--  Establecer Orden de Módulos
-- ================================================================
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

-- ================================================================
--  VERIFICACIÓN
-- ================================================================
SELECT 'Migraciones 006 + 008 completadas exitosamente' AS Estado;

SELECT COUNT(*) AS 'Tipos de Clínica' FROM tipos_clinica;
SELECT COUNT(*) AS 'Módulos del Sistema' FROM modulos_sistema;
SELECT COUNT(*) AS 'Asignaciones Tipo-Módulo' FROM tipo_clinica_modulos;

SELECT clave, nombre, orden 
FROM modulos_sistema 
ORDER BY orden;
