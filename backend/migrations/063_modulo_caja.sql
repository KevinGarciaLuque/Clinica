-- 063_modulo_caja.sql
-- Módulo Caja: apertura y cierre de turno con arqueo de efectivo.

CREATE TABLE IF NOT EXISTS caja_turnos (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id          INT UNSIGNED NOT NULL,
  estado              ENUM('ABIERTO','CERRADO') DEFAULT 'ABIERTO',
  monto_inicial       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  monto_esperado      DECIMAL(10,2) DEFAULT NULL,
  monto_contado       DECIMAL(10,2) DEFAULT NULL,
  diferencia          DECIMAL(10,2) DEFAULT NULL,
  notas_apertura      VARCHAR(300),
  notas_cierre        VARCHAR(300),
  usuario_apertura_id INT UNSIGNED NOT NULL,
  usuario_cierre_id   INT UNSIGNED DEFAULT NULL,
  abierto_en          DATETIME DEFAULT CURRENT_TIMESTAMP,
  cerrado_en          DATETIME DEFAULT NULL,
  KEY idx_caja_turnos_clinica_estado (clinica_id, estado),
  KEY idx_caja_turnos_clinica_fecha  (clinica_id, abierto_en),
  FOREIGN KEY (clinica_id)          REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_apertura_id) REFERENCES usuarios(id),
  FOREIGN KEY (usuario_cierre_id)   REFERENCES usuarios(id)
) ENGINE=InnoDB;

ALTER TABLE pagos ADD COLUMN caja_turno_id INT UNSIGNED DEFAULT NULL AFTER factura_id;
ALTER TABLE pagos ADD KEY idx_pagos_caja_turno (caja_turno_id);
ALTER TABLE pagos ADD FOREIGN KEY (caja_turno_id) REFERENCES caja_turnos(id) ON DELETE SET NULL;

INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica)
VALUES ('caja', 'Caja', 'bi-cash-stack', '/caja', 1, 36, 1, 1);

INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id FROM tipos_clinica tc, modulos_sistema ms WHERE ms.clave = 'caja';
