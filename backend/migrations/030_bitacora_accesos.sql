-- ─────────────────────────────────────────────────────────────────
-- 030_bitacora_accesos.sql
-- Tabla para registrar los inicios de sesión de todos los usuarios
-- Solo el SUPER_ADMIN puede consultarla
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bitacora_accesos (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT          NOT NULL,
  clinica_id   INT          NULL,          -- NULL para SUPER_ADMIN
  nombres      VARCHAR(100) NOT NULL,
  apellidos    VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL,
  tipo         VARCHAR(30)  NOT NULL,
  ip           VARCHAR(45)  NULL,          -- IPv4 o IPv6
  user_agent   TEXT         NULL,
  exito        TINYINT(1)   NOT NULL DEFAULT 1,  -- 1=exitoso, 0=fallido
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_clinica  (clinica_id),
  INDEX idx_usuario  (usuario_id),
  INDEX idx_creado   (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
