-- ============================================================
-- Migración 013: Catálogos de Diagnóstico y campos default en medicamentos
-- ============================================================

-- Campos default para prescripciones en medicamentos
ALTER TABLE medicamentos
  ADD COLUMN dosis_default VARCHAR(100) NULL COMMENT 'Dosis por defecto: 500mg c/8h' AFTER contraindicaciones,
  ADD COLUMN duracion_default VARCHAR(80) NULL COMMENT 'Duración por defecto: 7 días' AFTER dosis_default,
  ADD COLUMN cantidad_default VARCHAR(60) NULL COMMENT 'Cantidad por defecto: 21 tabletas' AFTER duracion_default,
  ADD COLUMN instrucciones_default TEXT NULL COMMENT 'Instrucciones por defecto' AFTER cantidad_default;

-- Catálogo de diagnósticos frecuentes
CREATE TABLE IF NOT EXISTS catalogos_diagnostico (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED,
  medico_id       INT UNSIGNED,
  nombre          VARCHAR(200) NOT NULL COMMENT 'Nombre descriptivo del catálogo',
  codigo_cie      VARCHAR(10) NOT NULL,
  descripcion_cie VARCHAR(300) NOT NULL,
  diagnosticos_secundarios JSON COMMENT '[{cie, descripcion}]',
  activo          TINYINT(1) DEFAULT 1,
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;
