-- =====================================================
-- FASE 4 Módulo 2: Registro de pacientes
-- Ejecutar una sola vez contra la BD
-- =====================================================

-- 1. Columnas adicionales en pacientes
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS foto_perfil        VARCHAR(255)   NULL AFTER direccion,
  ADD COLUMN IF NOT EXISTS ciudad             VARCHAR(100)   NULL AFTER foto_perfil,
  ADD COLUMN IF NOT EXISTS pais               VARCHAR(100)   NULL DEFAULT 'Perú' AFTER ciudad,
  ADD COLUMN IF NOT EXISTS grupo_sanguineo    VARCHAR(5)     NULL AFTER pais,
  ADD COLUMN IF NOT EXISTS email_verificado   TINYINT(1)     NOT NULL DEFAULT 0 AFTER grupo_sanguineo,
  ADD COLUMN IF NOT EXISTS registro_self      TINYINT(1)     NOT NULL DEFAULT 0 AFTER email_verificado,
  ADD COLUMN IF NOT EXISTS notas              TEXT           NULL AFTER registro_self;

-- 2. Verificaciones de email
CREATE TABLE IF NOT EXISTS verificaciones_email (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT UNSIGNED       NOT NULL,
  clinica_id  INT UNSIGNED       NOT NULL,
  token       VARCHAR(120)       NOT NULL UNIQUE,
  expires_at  DATETIME           NOT NULL,
  usado       TINYINT(1)         NOT NULL DEFAULT 0,
  creado_en   DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- 3. Documentos adjuntos del paciente
CREATE TABLE IF NOT EXISTS documentos_paciente (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id     INT UNSIGNED       NOT NULL,
  clinica_id      INT UNSIGNED       NOT NULL,
  tipo            ENUM('dni_frente','dni_reverso','seguro','consentimiento','laboratorio','imagen','otro')
                  NOT NULL DEFAULT 'otro',
  nombre_original VARCHAR(255)       NOT NULL,
  ruta_archivo    VARCHAR(500)       NOT NULL,
  mime_type       VARCHAR(100)       NOT NULL,
  tamano_bytes    INT UNSIGNED       NOT NULL DEFAULT 0,
  subido_por      INT UNSIGNED       NULL,          -- usuario_id, NULL si el paciente sube self-service
  creado_en       DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_paciente (paciente_id),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
