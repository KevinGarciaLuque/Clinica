-- ============================================================
--  053_modulo_estadisticas_facturacion.sql
--  Módulo "Estadísticas" (reportería) + Módulo "Facturación"
--  con cumplimiento fiscal hondureño (CAI/SAR).
--  Idempotente: ejecutar vía run-053.js (tolera columnas/filas
--  ya existentes, statement por statement).
-- ============================================================

-- ── 1. Registrar módulos en modulos_sistema ────────────────────────────────
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica)
VALUES ('estadisticas', 'Estadísticas', 'bi-graph-up-arrow', '/estadisticas', 1, 15, 1, 1);

INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica)
VALUES ('facturacion', 'Facturación', 'bi-receipt-cutoff', '/facturacion', 1, 35, 1, 1);

-- ── 2. Asignar ambos módulos a TODOS los tipos de clínica ──────────────────
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id FROM tipos_clinica tc, modulos_sistema ms WHERE ms.clave = 'estadisticas';

INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id FROM tipos_clinica tc, modulos_sistema ms WHERE ms.clave = 'facturacion';

-- ── 3. Precio en catálogo de tipos de cita ──────────────────────────────────
ALTER TABLE catalogos_tipos_cita
  ADD COLUMN precio DECIMAL(10,2) NULL AFTER descripcion;

-- ── 4. Tablas de facturación (por si no existen aún) ───────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id        INT UNSIGNED NOT NULL,
  paciente_id       INT UNSIGNED NOT NULL,
  cita_id           INT UNSIGNED,
  medico_id         INT UNSIGNED,
  creado_por        INT UNSIGNED,
  numero            VARCHAR(30)  COMMENT 'Correlativo simple (recibos) o interno',
  numero_completo   VARCHAR(40)  COMMENT 'Formato SAR: 000-001-01-00000001 (solo FACTURA)',
  tipo_comprobante  ENUM('FACTURA','RECIBO') DEFAULT 'RECIBO',
  cai               VARCHAR(40)  COMMENT 'Snapshot del CAI vigente al emitir (solo FACTURA)',
  fecha_limite_emision DATE      COMMENT 'Snapshot de la fecha límite del CAI usado',
  rtn_cliente       VARCHAR(20),
  nombre_cliente    VARCHAR(150),
  direccion_cliente VARCHAR(250),
  subtotal          DECIMAL(10,2) DEFAULT 0.00,
  isv_porcentaje    DECIMAL(5,2)  DEFAULT 15.00,
  impuestos         DECIMAL(10,2) DEFAULT 0.00,
  total             DECIMAL(10,2) DEFAULT 0.00,
  moneda            CHAR(3) DEFAULT 'HNL',
  estado            ENUM('PENDIENTE','PAGADA','ANULADA') DEFAULT 'PENDIENTE',
  pdf_url           VARCHAR(300),
  creado_en         DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_facturas_clinica_fecha (clinica_id, creado_en),
  KEY idx_facturas_medico        (clinica_id, medico_id),
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (cita_id)     REFERENCES citas(id)     ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS factura_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  factura_id    INT UNSIGNED NOT NULL,
  descripcion   VARCHAR(200) NOT NULL,
  cantidad      DECIMAL(8,2) DEFAULT 1,
  precio_unit   DECIMAL(10,2) NOT NULL,
  total         DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL,
  factura_id    INT UNSIGNED NOT NULL,
  metodo        ENUM('EFECTIVO','TARJETA','TRANSFERENCIA','SEGURO','OTRO') DEFAULT 'EFECTIVO',
  monto         DECIMAL(10,2) NOT NULL,
  referencia    VARCHAR(100) COMMENT 'Nro. operación, voucher, etc.',
  registrado_por INT UNSIGNED,
  registrado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 5. Retrofit por si `facturas`/`factura_items`/`pagos` ya existían ─────
--     (esquema original en schema.sql: moneda PEN, tipo BOLETA, sin CAI).
--     run-053.js ejecuta cada ALTER por separado y tolera errores de
--     "columna/valor ya existe" para que sea seguro repetir.
ALTER TABLE facturas MODIFY COLUMN tipo_comprobante ENUM('FACTURA','RECIBO') DEFAULT 'RECIBO';
ALTER TABLE facturas MODIFY COLUMN moneda CHAR(3) DEFAULT 'HNL';
ALTER TABLE facturas ADD COLUMN medico_id INT UNSIGNED AFTER cita_id;
ALTER TABLE facturas ADD COLUMN creado_por INT UNSIGNED AFTER medico_id;
ALTER TABLE facturas ADD COLUMN numero_completo VARCHAR(40) AFTER numero;
ALTER TABLE facturas ADD COLUMN cai VARCHAR(40) AFTER tipo_comprobante;
ALTER TABLE facturas ADD COLUMN fecha_limite_emision DATE AFTER cai;
ALTER TABLE facturas ADD COLUMN rtn_cliente VARCHAR(20) AFTER fecha_limite_emision;
ALTER TABLE facturas ADD COLUMN nombre_cliente VARCHAR(150) AFTER rtn_cliente;
ALTER TABLE facturas ADD COLUMN direccion_cliente VARCHAR(250) AFTER nombre_cliente;
ALTER TABLE facturas ADD COLUMN isv_porcentaje DECIMAL(5,2) DEFAULT 15.00 AFTER subtotal;
ALTER TABLE pagos ADD COLUMN registrado_por INT UNSIGNED AFTER referencia;
