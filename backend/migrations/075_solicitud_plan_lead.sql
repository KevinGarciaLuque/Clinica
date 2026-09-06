-- ============================================================
--  075 — Solicitud de plan en 2 fases (captura de lead)
--  El paso 1 crea la solicitud como 'iniciada' y recibe un token;
--  el paso 3 (con comprobante) la pasa a 'pendiente'. Así los datos
--  bancarios solo se entregan tras registrar la solicitud.
-- ============================================================
ALTER TABLE solicitudes_plan_publico
  MODIFY comprobante_url VARCHAR(500) NULL,
  MODIFY estado ENUM('iniciada','pendiente','aprobada','rechazada') NULL DEFAULT 'pendiente',
  ADD COLUMN token CHAR(40) NULL AFTER estado,
  ADD COLUMN datos_confirmados_en DATETIME NULL AFTER token;

CREATE UNIQUE INDEX uq_spp_token ON solicitudes_plan_publico (token);
