-- ============================================================
-- Migración 015: Categoría Normal / Pediátrica en clínicas
-- ============================================================

-- 1. Agregar flag a clínicas
ALTER TABLE clinicas
  ADD COLUMN es_pediatrica TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '0=Normal (adultos), 1=Pediátrica'
  AFTER tipo_id;

-- 2. Agregar flags de categoría a modulos_sistema
ALTER TABLE modulos_sistema
  ADD COLUMN para_normal     TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Visible en clínicas normales',
  ADD COLUMN para_pediatrica TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Visible en clínicas pediátricas';

-- 3. Insertar módulo Curva de Crecimiento (si no existe)
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion, disponible, orden, para_normal, para_pediatrica)
VALUES ('curva_crecimiento', 'Curvas de Crecimiento', 'bi-graph-up-arrow', '/crecimiento', 'Seguimiento antropométrico según estándares OMS', 1, 95, 0, 1);

-- 4. Asignar curva_crecimiento a TODOS los tipos de clínica
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave = 'curva_crecimiento';

-- 5. Marcar curva de crecimiento como solo pediátrica
UPDATE modulos_sistema SET para_normal = 0, para_pediatrica = 1 WHERE clave = 'curva_crecimiento';
