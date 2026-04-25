const pool = require('../db');

const sql = `
CREATE TABLE IF NOT EXISTS bitacora_accesos (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT          NOT NULL,
  clinica_id   INT          NULL,
  nombres      VARCHAR(100) NOT NULL,
  apellidos    VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL,
  tipo         VARCHAR(30)  NOT NULL,
  ip           VARCHAR(45)  NULL,
  user_agent   TEXT         NULL,
  exito        TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_clinica  (clinica_id),
  INDEX idx_usuario  (usuario_id),
  INDEX idx_creado   (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

pool.query(sql)
  .then(() => { console.log('OK: tabla bitacora_accesos creada'); process.exit(0); })
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); });
