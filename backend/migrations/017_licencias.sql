-- ============================================================
--  017 — Sistema de Licencias por Clínica
--  Planes: trial (14d), semestral (6m), anual (12m)
-- ============================================================

-- Agregar columnas de licencia a la tabla clinicas
ALTER TABLE clinicas
  ADD COLUMN plan_tipo     ENUM('trial','semestral','anual') NOT NULL DEFAULT 'trial' AFTER activo,
  ADD COLUMN licencia_inicio DATETIME NULL AFTER plan_tipo,
  ADD COLUMN licencia_fin    DATETIME NULL AFTER licencia_inicio;

-- Asignar trial de 14 días a todas las clínicas existentes
UPDATE clinicas
SET
  plan_tipo      = 'trial',
  licencia_inicio = NOW(),
  licencia_fin    = DATE_ADD(NOW(), INTERVAL 14 DAY)
WHERE licencia_fin IS NULL;

-- Historial de licencias (auditoría)
CREATE TABLE IF NOT EXISTS licencias_historial (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id     INT UNSIGNED NOT NULL,
  plan_tipo      ENUM('trial','semestral','anual') NOT NULL,
  inicio         DATETIME NOT NULL,
  fin            DATETIME NOT NULL,
  superadmin_id  INT UNSIGNED NULL COMMENT 'Usuario SUPER_ADMIN que asignó',
  notas          VARCHAR(300) NULL,
  creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
