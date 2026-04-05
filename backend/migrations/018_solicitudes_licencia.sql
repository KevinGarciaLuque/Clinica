-- ============================================================
--  018 — Solicitudes de Activación de Licencia
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitudes_licencia (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  plan_solicitado ENUM('trial','semestral','anual') NOT NULL DEFAULT 'anual',
  mensaje         VARCHAR(500) NULL,
  estado          ENUM('pendiente','atendida') NOT NULL DEFAULT 'pendiente',
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  atendida_en     DATETIME NULL,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
