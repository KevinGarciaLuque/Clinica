-- ============================================================
--  044_modulo_odontologia.sql
--  Módulo de Consulta Odontológica
-- ============================================================

-- 1. Registrar el módulo en modulos_sistema
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica)
VALUES ('consulta_odontologica', 'Consulta Odontológica', '🦷', '/odontologia/consulta', 1, 36, 1, 1);

-- 2. Asignar módulo al tipo de clínica "dental"
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id
FROM tipos_clinica tc, modulos_sistema ms
WHERE tc.clave = 'dental' AND ms.clave = 'consulta_odontologica';

-- También asignar módulos base al tipo dental
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id
FROM tipos_clinica tc, modulos_sistema ms
WHERE tc.clave = 'dental'
  AND ms.clave IN ('dashboard','pacientes','citas','plantillas','estudios');

-- 3. Tabla de sesiones odontológicas (una por visita)
CREATE TABLE IF NOT EXISTS sesiones_odontologia (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id          INT UNSIGNED NOT NULL,
  paciente_id         INT UNSIGNED NOT NULL,
  dentista_id         INT UNSIGNED NOT NULL,
  cita_id             INT UNSIGNED,
  numero_sesion       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  -- Motivo y exploración
  motivo_consulta     TEXT,
  exploracion_clinica JSON,   -- {tejidos_blandos, oclusion, higiene_oral, atm, otros}
  -- Procedimientos realizados en la visita
  procedimientos      JSON,   -- [{diente, superficie, procedimiento, material, observacion}]
  -- Diagnóstico
  diagnostico_cie     VARCHAR(120),
  diagnostico_desc    TEXT,
  -- Indicaciones y plan
  indicaciones        TEXT,
  proxima_cita        TEXT,
  observaciones       TEXT,
  -- Control
  estado              ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
  firma_at            DATETIME,
  creado_en           DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_so_clinica   (clinica_id),
  INDEX idx_so_paciente  (paciente_id),
  INDEX idx_so_dentista  (dentista_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Estado del odontograma (único por paciente por clínica — se actualiza en cada sesión)
CREATE TABLE IF NOT EXISTS odontograma_estado (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  -- JSON con el estado de todos los dientes
  -- { "11": { "v":"caries","p":"sano","m":"sano","d":"sano","o":"obturacion","ausente":false,"nota":"" }, ... }
  dientes         JSON NOT NULL DEFAULT ('{}'),
  actualizado_en  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_oe_clinica_paciente (clinica_id, paciente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Historia odontológica (anamnesis — única por paciente por clínica)
CREATE TABLE IF NOT EXISTS historia_odontologica (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id              INT UNSIGNED NOT NULL,
  paciente_id             INT UNSIGNED NOT NULL,
  -- Motivo
  motivo_consulta_inicial TEXT,
  -- Hábitos
  frecuencia_cepillado    VARCHAR(80),
  usa_hilo_dental         TINYINT(1) DEFAULT 0,
  usa_enjuague            TINYINT(1) DEFAULT 0,
  habitos_nocivos         TEXT,       -- bruxismo, onicofagia, etc.
  -- Antecedentes sistémicos relevantes
  diabetes                TINYINT(1) DEFAULT 0,
  hipertension            TINYINT(1) DEFAULT 0,
  anticoagulantes         TINYINT(1) DEFAULT 0,
  alergia_anestesia       TINYINT(1) DEFAULT 0,
  alergia_latex           TINYINT(1) DEFAULT 0,
  otras_condiciones       TEXT,
  -- Tratamientos previos
  ortodoncia_previa       TINYINT(1) DEFAULT 0,
  extracciones_previas    TEXT,
  implantes_previos       TINYINT(1) DEFAULT 0,
  protesis_actual         VARCHAR(120),
  tratamientos_previos    TEXT,
  -- Historial familiar
  historia_familiar       TEXT,
  -- Notas adicionales
  notas                   TEXT,
  -- Control
  creado_en               DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ho_clinica_paciente (clinica_id, paciente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Plan de tratamiento odontológico
CREATE TABLE IF NOT EXISTS plan_tratamiento_odontologia (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id        INT UNSIGNED NOT NULL,
  paciente_id       INT UNSIGNED NOT NULL,
  dentista_id       INT UNSIGNED NOT NULL,
  -- Lista de procedimientos planificados
  -- [{ diente, superficie, procedimiento, prioridad:'alta|media|baja', costo_estimado, completado, sesion_id }]
  items             JSON NOT NULL DEFAULT ('[]'),
  costo_total       DECIMAL(10,2) DEFAULT 0,
  notas             TEXT,
  activo            TINYINT(1) DEFAULT 1,
  creado_en         DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pto_clinica_paciente (clinica_id, paciente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
