-- Permisos de módulos por clínica y por usuario

CREATE TABLE IF NOT EXISTS clinica_modulos (
  clinica_id INT UNSIGNED NOT NULL,
  modulo_id INT UNSIGNED NOT NULL,
  habilitado TINYINT(1) NOT NULL DEFAULT 1,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clinica_id, modulo_id),
  CONSTRAINT fk_cm_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_modulo FOREIGN KEY (modulo_id) REFERENCES modulos_sistema(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuario_modulos (
  usuario_id INT UNSIGNED NOT NULL,
  modulo_id INT UNSIGNED NOT NULL,
  habilitado TINYINT(1) NOT NULL,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, modulo_id),
  CONSTRAINT fk_um_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_um_modulo FOREIGN KEY (modulo_id) REFERENCES modulos_sistema(id) ON DELETE CASCADE
) ENGINE=InnoDB;

