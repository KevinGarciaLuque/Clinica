-- ============================================================
--  Migración 038 — Módulo Inventario
--  Fecha: 2026-05-01
--  Objetivo: Crear tablas de inventario (ítems + movimientos)
--  y registrar el módulo en modulos_sistema para todos los
--  tipos de clínica.
-- ============================================================

-- 1. Tabla principal de ítems de inventario
CREATE TABLE IF NOT EXISTS inventario_items (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id     INT UNSIGNED NOT NULL,
  nombre         VARCHAR(200) NOT NULL,
  descripcion    VARCHAR(500) NULL,
  categoria      VARCHAR(100) NULL,
  unidad_medida  VARCHAR(50)  NOT NULL DEFAULT 'unidad',
  stock_actual   DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_minimo   DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_costo   DECIMAL(10,2) NULL,
  proveedor      VARCHAR(200) NULL,
  codigo         VARCHAR(80)  NULL,
  activo         TINYINT(1)   DEFAULT 1,
  creado_en      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inv_clinica   (clinica_id),
  INDEX idx_inv_categoria (clinica_id, categoria),
  UNIQUE KEY uq_inv_codigo (clinica_id, codigo),
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de movimientos (entradas, salidas, ajustes)
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id   INT UNSIGNED NOT NULL,
  item_id      INT UNSIGNED NOT NULL,
  usuario_id   INT UNSIGNED NOT NULL,
  tipo         ENUM('ENTRADA','SALIDA','AJUSTE') NOT NULL,
  cantidad     DECIMAL(10,2) NOT NULL,
  stock_antes  DECIMAL(10,2) NOT NULL,
  stock_despues DECIMAL(10,2) NOT NULL,
  motivo       VARCHAR(300) NULL,
  referencia   VARCHAR(150) NULL,
  creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_imov_clinica (clinica_id),
  INDEX idx_imov_item    (item_id),
  INDEX idx_imov_fecha   (creado_en),
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)    ON DELETE CASCADE,
  FOREIGN KEY (item_id)     REFERENCES inventario_items(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Registrar módulo en el catálogo del sistema
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion)
VALUES (
  'inventario',
  'Inventario',
  'bi-boxes',
  '/inventario',
  'Control de stock de insumos, medicamentos y materiales de la clínica'
);

-- 4. Asignar a todos los tipos de clínica
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave = 'inventario';

-- Verificación
SELECT
  t.clave  AS tipo_clinica,
  m.clave  AS modulo_clave,
  m.nombre AS nombre_modulo,
  m.ruta
FROM tipo_clinica_modulos tcm
JOIN tipos_clinica      t ON t.id = tcm.tipo_id
JOIN modulos_sistema    m ON m.id = tcm.modulo_id
WHERE m.clave = 'inventario'
ORDER BY t.clave;
