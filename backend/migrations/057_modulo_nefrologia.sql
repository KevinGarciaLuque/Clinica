-- ============================================================
--  057_modulo_nefrologia.sql
--  Módulo de Nefrología: Hoja Analítica (flujograma de laboratorios)
-- ============================================================

-- 1. Registrar el tipo de clínica "nefrologia" (si no existe)
INSERT IGNORE INTO tipos_clinica (clave, nombre, icono, color)
VALUES ('nefrologia', 'Nefrología', '🧪', '#0891b2');

-- 2. Registrar el módulo en modulos_sistema
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica)
VALUES ('hoja_analitica_nefrologia', 'Hoja Analítica', '🧪', '/nefrologia/hoja-analitica', 1, 37, 1, 1);

-- 3. Asignar el módulo al tipo de clínica "nefrologia"
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id
FROM tipos_clinica tc, modulos_sistema ms
WHERE tc.clave = 'nefrologia' AND ms.clave = 'hoja_analitica_nefrologia';

-- También asignar módulos base al tipo nefrología
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id
FROM tipos_clinica tc, modulos_sistema ms
WHERE tc.clave = 'nefrologia'
  AND ms.clave IN ('dashboard','pacientes','citas','plantillas','estudios');

-- 4. Catálogo de parámetros de laboratorio (configurable y reordenable por clínica)
CREATE TABLE IF NOT EXISTS catalogo_parametros_nefrologia (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  categoria   VARCHAR(80)  NOT NULL DEFAULT 'General',
  nombre      VARCHAR(150) NOT NULL,
  unidad      VARCHAR(40),
  orden       INT DEFAULT 0,
  activo      TINYINT(1) DEFAULT 1,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cpn_clinica (clinica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Hoja analítica: una fila = una fecha/visita (columna del formato en papel)
CREATE TABLE IF NOT EXISTS hoja_analitica_nefrologia (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  paciente_id INT UNSIGNED NOT NULL,
  fecha       DATE NOT NULL,
  -- encabezado libre: { peso, talla, sc, dialisis, tr, tipo_rh, diagnostico }
  encabezado  JSON,
  -- valores: { "<parametro_id>": "valor capturado" }
  valores     JSON NOT NULL DEFAULT ('{}'),
  creado_por  INT UNSIGNED,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_han_clinica  (clinica_id),
  INDEX idx_han_paciente (paciente_id),
  INDEX idx_han_fecha    (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
