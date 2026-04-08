-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 020 — Módulo de Vacunas (Carnet Digital de Vacunación)
-- ══════════════════════════════════════════════════════════════

-- Registro de vacunas aplicadas al paciente
CREATE TABLE IF NOT EXISTS vacunas_aplicadas (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id          INT UNSIGNED NOT NULL,
  paciente_id         INT UNSIGNED NOT NULL,
  usuario_id          INT UNSIGNED DEFAULT NULL COMMENT 'Médico/Enfermera que aplicó',

  vacuna_codigo       VARCHAR(60)  NOT NULL    COMMENT 'Código interno: BCG, HEP_B_RN, VPI, etc.',
  vacuna_nombre       VARCHAR(200) NOT NULL    COMMENT 'Nombre legible de la vacuna',
  dosis_nombre        VARCHAR(100) NOT NULL    COMMENT 'Primera, Segunda, Refuerzo, Única, etc.',
  dosis_orden         TINYINT UNSIGNED DEFAULT 1 COMMENT 'Orden de la dosis dentro de la vacuna',

  fecha_dia           TINYINT UNSIGNED DEFAULT NULL,
  fecha_mes           TINYINT UNSIGNED DEFAULT NULL,
  fecha_ano           SMALLINT UNSIGNED DEFAULT NULL,
  fecha_aplicacion    DATE         DEFAULT NULL,

  proxima_cita        VARCHAR(150) DEFAULT NULL COMMENT 'Texto libre: "6 meses", fecha, etc.',
  nombre_vacunador    VARCHAR(200) DEFAULT NULL,

  lote                VARCHAR(100) DEFAULT NULL,
  observaciones       TEXT         DEFAULT NULL,

  creado_en           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_va_paciente (paciente_id),
  INDEX idx_va_clinica  (clinica_id),
  INDEX idx_va_codigo   (vacuna_codigo),

  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Registro de suplementación de Vitamina A
CREATE TABLE IF NOT EXISTS vitamina_a_suplementacion (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id          INT UNSIGNED NOT NULL,
  paciente_id         INT UNSIGNED NOT NULL,
  usuario_id          INT UNSIGNED DEFAULT NULL,

  edad_rango          VARCHAR(50)  NOT NULL  COMMENT '6_11_meses | 1_ano | 2_anos | 3_anos | 4_anos',
  tipo_dosis          VARCHAR(50)  NOT NULL  COMMENT 'dosis_unica | primera_dosis | segunda_dosis',
  dosis_ui            INT          NOT NULL  COMMENT '100000 o 200000',

  fecha_dia           TINYINT UNSIGNED DEFAULT NULL,
  fecha_mes           TINYINT UNSIGNED DEFAULT NULL,
  fecha_ano           SMALLINT UNSIGNED DEFAULT NULL,
  fecha_aplicacion    DATE         DEFAULT NULL,

  nombre_vacunador    VARCHAR(200) DEFAULT NULL,
  observaciones       TEXT         DEFAULT NULL,

  creado_en           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_vita_paciente (paciente_id),
  INDEX idx_vita_clinica  (clinica_id),

  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
