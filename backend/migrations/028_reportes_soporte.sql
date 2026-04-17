-- Migración 028: Tabla para reportes de problemas enviados desde el modal de soporte
CREATE TABLE IF NOT EXISTS reportes_soporte (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT NULL,
  usuario_id    INT NOT NULL,
  usuario_nombre VARCHAR(200) NOT NULL,
  usuario_email  VARCHAR(200) NOT NULL,
  asunto        VARCHAR(300) NOT NULL,
  descripcion   TEXT NOT NULL,
  estado        ENUM('pendiente','atendido') NOT NULL DEFAULT 'pendiente',
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atendido_en   DATETIME NULL,
  INDEX idx_estado (estado),
  INDEX idx_creado (creado_en)
);
