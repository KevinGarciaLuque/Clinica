-- ============================================================
--  041_modulo_psicologia.sql
--  Módulo de Consulta Psicológica
-- ============================================================

-- 1. Registrar el módulo en modulos_sistema
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica)
VALUES ('consulta_psicologica', 'Consulta Psicológica', '🧠', '/psicologia/consulta', 1, 35, 1, 0);

-- 2. Asignar módulo al tipo de clínica "psicologia"
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id
FROM tipos_clinica tc, modulos_sistema ms
WHERE tc.clave = 'psicologia' AND ms.clave = 'consulta_psicologica';

-- También asignar los módulos base al tipo psicologia (dashboard, pacientes, citas, etc.)
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id
FROM tipos_clinica tc, modulos_sistema ms
WHERE tc.clave = 'psicologia'
  AND ms.clave IN ('dashboard','pacientes','citas','plantillas','estudios');

-- 3. Tabla de sesiones psicológicas
CREATE TABLE IF NOT EXISTS sesiones_psicologia (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  psicologo_id    INT UNSIGNED NOT NULL,
  cita_id         INT UNSIGNED,
  numero_sesion   SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  modalidad       ENUM('INDIVIDUAL','PAREJA','FAMILIA','GRUPO') DEFAULT 'INDIVIDUAL',
  -- Núcleo de la sesión
  motivo_consulta TEXT,
  estado_mental   JSON,   -- {orientacion, afecto, pensamiento, percepcion, conducta, juicio, memoria}
  diagnostico_cie VARCHAR(120),
  diagnostico_desc TEXT,
  diagnosticos_secundarios JSON,
  intervenciones  TEXT,
  tarea_proxima   TEXT,
  observaciones   TEXT,
  -- Control
  estado          ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
  firma_at        DATETIME,
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sp_clinica   (clinica_id),
  INDEX idx_sp_paciente  (paciente_id),
  INDEX idx_sp_psicologo (psicologo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabla de historia psicológica (anamnesis, una por paciente por clínica)
CREATE TABLE IF NOT EXISTS historia_psicologica (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id            INT UNSIGNED NOT NULL,
  paciente_id           INT UNSIGNED NOT NULL,
  -- Datos generales
  motivo_derivacion     TEXT,
  demanda_inicial       TEXT,
  -- Historia familiar y social
  dinamica_familiar     TEXT,
  historia_social       TEXT,
  historia_laboral      TEXT,
  nivel_educativo       VARCHAR(100),
  estado_civil          VARCHAR(60),
  -- Antecedentes salud mental
  antecedentes_psiq     TEXT,
  diagnosticos_previos  TEXT,
  medicacion_actual     TEXT,
  hospitalizaciones     TEXT,
  intentos_autoliticos  TINYINT(1) DEFAULT 0,
  ideacion_actual       TINYINT(1) DEFAULT 0,
  -- Sustancias
  consumo_sustancias    JSON,   -- [{sustancia, frecuencia, inicio}]
  -- Trauma
  eventos_traumaticos   TEXT,
  -- Genograma (JSON con relaciones)
  genograma             JSON,
  -- Redes de apoyo
  redes_apoyo           TEXT,
  -- Control
  creado_en             DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hp_clinica_paciente (clinica_id, paciente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabla de plan terapéutico (uno activo por paciente por clínica)
CREATE TABLE IF NOT EXISTS plan_terapeutico (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id        INT UNSIGNED NOT NULL,
  paciente_id       INT UNSIGNED NOT NULL,
  psicologo_id      INT UNSIGNED NOT NULL,
  enfoque           VARCHAR(120),  -- Cognitivo-conductual, Sistémico, etc.
  frecuencia        VARCHAR(80),   -- Semanal, quincenal, etc.
  objetivos         JSON,          -- [{objetivo, plazo:'corto|mediano|largo', cumplido:bool}]
  progreso_general  TINYINT UNSIGNED DEFAULT 0,  -- 0-100
  notas             TEXT,
  activo            TINYINT(1) DEFAULT 1,
  creado_en         DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pt_clinica_paciente (clinica_id, paciente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabla de escalas aplicadas (PHQ-9, GAD-7, Beck, etc.)
CREATE TABLE IF NOT EXISTS escalas_psicologia (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  sesion_id       INT UNSIGNED,
  tipo_escala     VARCHAR(60) NOT NULL,   -- 'PHQ9','GAD7','BECK_DEPRESION','BECK_ANSIEDAD','HAMILTON_D','HAMILTON_A'
  respuestas      JSON NOT NULL,          -- array de respuestas por ítem
  puntaje_total   SMALLINT NOT NULL,
  interpretacion  VARCHAR(120),
  aplicado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ep_paciente (clinica_id, paciente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
