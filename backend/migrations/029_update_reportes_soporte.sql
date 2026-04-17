-- Migración 029: Actualizar tabla reportes_soporte
-- Ejecutar cada sentencia por separado (seleccionar + Ctrl+Enter)

-- 1) Ampliar el ENUM con 'en_proceso'
ALTER TABLE reportes_soporte
  MODIFY COLUMN estado ENUM('pendiente','en_proceso','atendido') NOT NULL DEFAULT 'pendiente';

-- 2) Agregar columna respuesta
ALTER TABLE reportes_soporte
  ADD COLUMN respuesta TEXT NULL AFTER descripcion;

-- 3) Agregar columna leido_usuario
ALTER TABLE reportes_soporte
  ADD COLUMN leido_usuario TINYINT(1) NOT NULL DEFAULT 0 AFTER atendido_en;
