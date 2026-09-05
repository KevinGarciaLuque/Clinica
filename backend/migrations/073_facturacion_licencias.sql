-- ============================================================
--  073 — Facturación de licencias (contrato + recibos mensuales)
--  El SUPER_ADMIN activa un plan con un monto mensual y un día
--  de facturación. El día de la activación se emite el CONTRATO
--  de servicio; cada mes (en el día de facturación) se emite un
--  RECIBO por el monto mensual acordado.
-- ============================================================

-- ── Columnas de facturación en el historial de licencias ──
ALTER TABLE licencias_historial
  ADD COLUMN monto_total     DECIMAL(12,2) NULL AFTER notas,
  ADD COLUMN monto_mensual   DECIMAL(12,2) NULL AFTER monto_total,
  ADD COLUMN moneda          VARCHAR(8)    NULL DEFAULT 'HNL' AFTER monto_mensual,
  ADD COLUMN duracion_meses  INT           NULL AFTER moneda,
  ADD COLUMN dia_facturacion TINYINT       NULL AFTER duracion_meses,
  ADD COLUMN contrato_numero VARCHAR(30)   NULL AFTER dia_facturacion;

-- ── Snapshot de la licencia vigente en la clínica (lo usa el cron) ──
ALTER TABLE clinicas
  ADD COLUMN lic_monto_mensual   DECIMAL(12,2) NULL AFTER licencia_fin,
  ADD COLUMN lic_moneda          VARCHAR(8)    NULL AFTER lic_monto_mensual,
  ADD COLUMN lic_dia_facturacion TINYINT       NULL AFTER lic_moneda,
  ADD COLUMN lic_contrato_numero VARCHAR(30)   NULL AFTER lic_dia_facturacion;

-- ── Contratos de servicio ──
CREATE TABLE IF NOT EXISTS contratos_licencia (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero                VARCHAR(30) NOT NULL UNIQUE,
  clinica_id            INT UNSIGNED NOT NULL,
  licencia_historial_id INT UNSIGNED NULL,
  plan_tipo             VARCHAR(20)  NULL,
  plan_label            VARCHAR(80)  NULL,
  fecha                 DATE         NOT NULL,
  vigencia_inicio       DATE         NOT NULL,
  vigencia_fin          DATE         NOT NULL,
  duracion_meses        INT          NULL,
  monto_total           DECIMAL(12,2) NULL,
  monto_mensual         DECIMAL(12,2) NULL,
  moneda                VARCHAR(8)   NULL DEFAULT 'HNL',
  dia_facturacion       TINYINT      NULL,
  cliente_nombre        VARCHAR(160) NULL,
  cliente_email         VARCHAR(160) NULL,
  clausulas_extra       TEXT         NULL COMMENT 'Cláusulas adicionales redactadas por el SUPER_ADMIN',
  pdf                   LONGBLOB     NULL,
  enviado_en            DATETIME     NULL,
  creado_por            INT UNSIGNED NULL,
  creado_en             DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Recibos mensuales ──
CREATE TABLE IF NOT EXISTS recibos_licencia (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero                VARCHAR(30) NOT NULL UNIQUE,
  clinica_id            INT UNSIGNED NOT NULL,
  contrato_numero       VARCHAR(30)  NULL,
  licencia_historial_id INT UNSIGNED NULL,
  periodo               CHAR(7)      NOT NULL COMMENT 'YYYY-MM que cubre el recibo',
  periodo_inicio        DATE         NOT NULL,
  periodo_fin           DATE         NOT NULL,
  concepto              VARCHAR(200) NULL,
  monto                 DECIMAL(12,2) NOT NULL,
  moneda                VARCHAR(8)   NOT NULL DEFAULT 'HNL',
  fecha_emision         DATE         NOT NULL,
  estado                ENUM('emitido','enviado','error') NOT NULL DEFAULT 'emitido',
  email_destino         VARCHAR(160) NULL,
  enviado_en            DATETIME     NULL,
  error_msg             VARCHAR(300) NULL,
  pdf                   LONGBLOB     NULL,
  generado_por          ENUM('cron','manual') NOT NULL DEFAULT 'cron',
  creado_por            INT UNSIGNED NULL,
  creado_en             DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clinica_periodo (clinica_id, periodo),
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
