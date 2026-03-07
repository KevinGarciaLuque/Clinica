-- ============================================================
--  Migración 009 — Presupuestos y Seguimiento Post-Op
--  Fecha: 2026-03-06
--  Módulos: Presupuestos + Seguimiento Post-Operatorio
-- ============================================================

-- ================================================================
-- PRESUPUESTOS ESTÉTICOS
-- ================================================================

CREATE TABLE IF NOT EXISTS presupuestos_esteticos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id       INT UNSIGNED NOT NULL,
  clinica_id        INT UNSIGNED NOT NULL,
  medico_id         INT UNSIGNED NOT NULL COMMENT 'Cirujano que realiza el presupuesto',
  folio             VARCHAR(50) NOT NULL UNIQUE COMMENT 'PRES-2026-001',
  procedimiento     VARCHAR(255) NOT NULL COMMENT 'Ej: Rinoplastia, Liposucción, etc.',
  descripcion       TEXT COMMENT 'Detalles del procedimiento propuesto',
  costo_procedimiento DECIMAL(10,2) NOT NULL DEFAULT 0,
  costo_anestesia   DECIMAL(10,2) DEFAULT 0,
  costo_quirofano   DECIMAL(10,2) DEFAULT 0,
  costo_materiales  DECIMAL(10,2) DEFAULT 0,
  costo_otros       DECIMAL(10,2) DEFAULT 0,
  subtotal          DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento         DECIMAL(10,2) DEFAULT 0,
  total             DECIMAL(10,2) NOT NULL DEFAULT 0,
  moneda            VARCHAR(10) DEFAULT 'MXN',
  vigencia_dias     INT DEFAULT 30 COMMENT 'Vigencia del presupuesto',
  fecha_emision     DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado            ENUM('borrador','enviado','aceptado','rechazado','vencido','convertido') 
                    DEFAULT 'borrador',
  notas             TEXT COMMENT 'Observaciones internas',
  notas_paciente    TEXT COMMENT 'Notas visibles para el paciente',
  aceptado          TINYINT(1) DEFAULT 0,
  aceptado_en       DATETIME NULL,
  creado_en         DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_paciente (paciente_id),
  INDEX idx_clinica (clinica_id),
  INDEX idx_folio (folio),
  INDEX idx_estado (estado),
  INDEX idx_fecha (fecha_emision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partidas/items del presupuesto (opcional, para presupuestos más detallados)
CREATE TABLE IF NOT EXISTS presupuesto_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  presupuesto_id  INT UNSIGNED NOT NULL,
  concepto        VARCHAR(255) NOT NULL,
  descripcion     TEXT,
  cantidad        INT DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (presupuesto_id) REFERENCES presupuestos_esteticos(id) ON DELETE CASCADE,
  INDEX idx_presupuesto (presupuesto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- SEGUIMIENTO POST-OPERATORIO
-- ================================================================

CREATE TABLE IF NOT EXISTS seguimiento_postop (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id     INT UNSIGNED NOT NULL,
  clinica_id      INT UNSIGNED NOT NULL,
  medico_id       INT UNSIGNED NOT NULL COMMENT 'Cirujano responsable',
  procedimiento   VARCHAR(255) NOT NULL COMMENT 'Procedimiento realizado',
  fecha_cirugia   DATE NOT NULL,
  fecha_control   DATE NOT NULL COMMENT 'Fecha de esta consulta de seguimiento',
  dias_postop     INT COMMENT 'Días transcurridos desde la cirugía',
  tipo_control    ENUM('24h','7dias','15dias','1mes','3meses','6meses','1año','otro') 
                  DEFAULT 'otro',
  estado_general  ENUM('excelente','bueno','regular','malo') DEFAULT 'bueno',
  dolor_nivel     INT DEFAULT 0 COMMENT '0-10 escala EVA',
  inflamacion     ENUM('ninguna','leve','moderada','severa') DEFAULT 'leve',
  equimosis       ENUM('ninguna','leve','moderada','severa') DEFAULT 'ninguna',
  cicatrizacion   ENUM('excelente','buena','regular','mala') DEFAULT 'buena',
  signos_alarma   TEXT COMMENT 'Sangrado, infección, dehiscencia, etc.',
  sintomas        TEXT COMMENT 'Descripción de síntomas actuales',
  exploracion     TEXT COMMENT 'Hallazgos en exploración física',
  complicaciones  TEXT COMMENT 'Si hay alguna complicación',
  medicamentos    TEXT COMMENT 'Medicación indicada/ajustada',
  indicaciones    TEXT COMMENT 'Cuidados e indicaciones al paciente',
  fotos_adjuntas  TINYINT(1) DEFAULT 0 COMMENT 'Si se tomaron fotos de seguimiento',
  proximo_control DATE COMMENT 'Fecha sugerida para próximo control',
  satisfaccion    ENUM('muy_satisfecho','satisfecho','neutral','insatisfecho','muy_insatisfecho') 
                  NULL COMMENT 'Nivel de satisfacción del paciente',
  notas           TEXT COMMENT 'Notas adicionales',
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_paciente (paciente_id),
  INDEX idx_clinica (clinica_id),
  INDEX idx_fecha_cirugia (fecha_cirugia),
  INDEX idx_fecha_control (fecha_control),
  INDEX idx_tipo (tipo_control)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- CONSENTIMIENTOS INFORMADOS (usar tabla existente + datos ejemplo)
-- ================================================================

-- Catálogo de tipos de consentimiento
CREATE TABLE IF NOT EXISTS tipos_consentimiento (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo      VARCHAR(50) NOT NULL UNIQUE COMMENT 'CONS-RINO, CONS-LIPO, etc.',
  nombre      VARCHAR(255) NOT NULL,
  procedimiento VARCHAR(255) NOT NULL,
  contenido_html TEXT COMMENT 'Texto del consentimiento en HTML',
  activo      TINYINT(1) DEFAULT 1,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  DATOS DE EJEMPLO
-- ================================================================

-- Ejemplo 1: Presupuesto de Rinoplastia
INSERT INTO presupuestos_esteticos 
(paciente_id, clinica_id, medico_id, folio, procedimiento, descripcion, 
 costo_procedimiento, costo_anestesia, costo_quirofano, costo_materiales, 
 subtotal, descuento, total, fecha_emision, fecha_vencimiento, estado, notas_paciente)
VALUES 
(1, 1, 1, 'PRES-2026-001', 'Rinoplastia Estética', 
 'Rinoplastia primaria con técnica abierta. Incluye corrección de giba nasal, refinamiento de punta y perfilado de dorso.',
 45000.00, 8000.00, 12000.00, 3000.00,
 68000.00, 3000.00, 65000.00, 
 CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY),
 'enviado', 
 'El precio incluye: consultas pre y post operatorias, cirugía, anestesia, uso de quirófano y seguimiento por 6 meses.');

-- Ejemplo 2: Presupuesto de Liposucción
INSERT INTO presupuestos_esteticos 
(paciente_id, clinica_id, medico_id, folio, procedimiento, descripcion, 
 costo_procedimiento, costo_anestesia, costo_quirofano, costo_materiales, 
 subtotal, total, fecha_emision, fecha_vencimiento, estado)
VALUES 
(1, 1, 1, 'PRES-2026-002', 'Liposucción HD Abdomen y Flancos', 
 'Lipoescultura de alta definición en abdomen superior, inferior y flancos. Incluye transferencia de grasa a glúteos.',
 55000.00, 10000.00, 15000.00, 5000.00,
 85000.00, 85000.00,
 DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY),
 'borrador');

-- Ejemplo 3: Presupuesto de Mamoplastia
INSERT INTO presupuestos_esteticos 
(paciente_id, clinica_id, medico_id, folio, procedimiento, descripcion, 
 costo_procedimiento, costo_anestesia, costo_quirofano, costo_materiales, 
 subtotal, total, fecha_emision, fecha_vencimiento, estado, aceptado, aceptado_en)
VALUES 
(1, 1, 1, 'PRES-2026-003', 'Aumento Mamario con Implantes', 
 'Mamoplastia de aumento bilateral con implantes redondos de gel cohesivo. Abordaje submamario, plano dual plane.',
 60000.00, 9000.00, 13000.00, 18000.00,
 100000.00, 100000.00,
 DATE_SUB(CURDATE(), INTERVAL 45 DAY), DATE_SUB(CURDATE(), INTERVAL 15 DAY),
 'aceptado', 1, DATE_SUB(CURDATE(), INTERVAL 30 DAY));

-- Items detallados del presupuesto 1
INSERT INTO presupuesto_items (presupuesto_id, concepto, descripcion, cantidad, precio_unitario, subtotal)
VALUES 
(1, 'Honorarios quirúrgicos', 'Cirujano plástico certificado', 1, 45000.00, 45000.00),
(1, 'Anestesia general', 'Anestesiólogo certificado', 1, 8000.00, 8000.00),
(1, 'Quirófano', 'Uso de sala de cirugía equipada', 1, 12000.00, 12000.00),
(1, 'Material quirúrgico', 'Suturas, gasas, vendajes especializados', 1, 3000.00, 3000.00);

-- Ejemplo 1: Seguimiento Post-Op día 7 - Rinoplastia
INSERT INTO seguimiento_postop 
(paciente_id, clinica_id, medico_id, procedimiento, fecha_cirugia, fecha_control, 
 dias_postop, tipo_control, estado_general, dolor_nivel, inflamacion, equimosis, 
 cicatrizacion, sintomas, exploracion, medicamentos, indicaciones, proximo_control)
VALUES 
(1, 1, 1, 'Rinoplastia Estética', 
 DATE_SUB(CURDATE(), INTERVAL 7 DAY), CURDATE(),
 7, '7dias', 'bueno', 2, 'moderada', 'leve',
 'buena',
 'Ligera molestia en dorso nasal. No hay dificultad respiratoria. Leve edema periorbitario.',
 'Retiro de férula nasal. Dorso centrado sin desviaciones. Sutura intacta. Sin signos de infección. Equimosis leve en región periorbitaria bilateral en fase de resolución.',
 'Continuar con Arnica montana 5CH, Paracetamol 500mg PRN, Bromelina 500mg c/8h. Aplicar compresas frías.',
 'Evitar exposición solar directa. No usar lentes por 4 semanas. Dormir con cabecera elevada 30°. Limpiar fosas nasales con solución salina c/12h. No sonarse la nariz.',
 DATE_ADD(CURDATE(), INTERVAL 7 DAY));

-- Ejemplo 2: Seguimiento Post-Op día 1 - Liposucción
INSERT INTO seguimiento_postop 
(paciente_id, clinica_id, medico_id, procedimiento, fecha_cirugia, fecha_control, 
 dias_postop, tipo_control, estado_general, dolor_nivel, inflamacion, equimosis, 
 cicatrizacion, sintomas, exploracion, medicamentos, indicaciones, proximo_control, satisfaccion)
VALUES 
(1, 1, 1, 'Liposucción HD Abdomen', 
 DATE_SUB(CURDATE(), INTERVAL 1 DAY), CURDATE(),
 1, '24h', 'bueno', 4, 'moderada', 'moderada',
 'excelente',
 'Dolor moderado controlado con analgesia. Drenaje serohemático leve en zonas tratadas.',
 'Zonas tratadas con vendaje compresivo. Sin signos de infección. Drenaje serohemático esperado. Portales de entrada limpios. Faja compresiva bien colocada.',
 'Ketorolaco 30mg IV c/8h x 24h, luego cambiar a Paracetamol. Antibiótico profiláctico completar 5 días.',
 'Mantener faja 24/7 durante 6 semanas. Caminar desde hoy para prevenir trombosis. Iniciar drenaje linfático en día 5. Dieta ligera y abundantes líquidos.',
 DATE_ADD(CURDATE(), INTERVAL 6 DAY),
 'satisfecho');

-- Ejemplo 3: Seguimiento Post-Op 3 meses - Aumento Mamario
INSERT INTO seguimiento_postop 
(paciente_id, clinica_id, medico_id, procedimiento, fecha_cirugia, fecha_control, 
 dias_postop, tipo_control, estado_general, dolor_nivel, inflamacion, equimosis, 
 cicatrizacion, sintomas, exploracion, indicaciones, satisfaccion, notas)
VALUES 
(1, 1, 1, 'Aumento Mamario con Implantes', 
 DATE_SUB(CURDATE(), INTERVAL 90 DAY), CURDATE(),
 90, '3meses', 'excelente', 0, 'ninguna', 'ninguna',
 'excelente',
 'Sin molestias. Recuperación completa de sensibilidad. Realizando actividad física normal.',
 'Cicatrices submamarias apenas visibles, de aspecto maduro. Implantes bien posicionados, simétricos. Cápsula blanda grado Baker I. Sin contractura. Forma natural en reposo y dinámica.',
 'Continuar masaje de cicatrices con gel de silicona. Ya puede reincorporarse completamente a todas las actividades incluyendo ejercicio intenso.',
 'muy_satisfecho',
 'Paciente extremadamente satisfecha con resultado estético. Fotos comparativas antes/después muestran resultado natural y armónico.');

-- Tipos de consentimiento informado
INSERT INTO tipos_consentimiento (codigo, nombre, procedimiento, contenido_html, activo)
VALUES 
('CONS-RINO', 'Consentimiento Informado - Rinoplastia', 'Rinoplastia',
 '<h3>CONSENTIMIENTO INFORMADO PARA RINOPLASTIA</h3><p>Yo <strong>[NOMBRE PACIENTE]</strong>, declaro que he sido informado(a) sobre...</p>', 
 1),
('CONS-LIPO', 'Consentimiento Informado - Liposucción', 'Liposucción',
 '<h3>CONSENTIMIENTO INFORMADO PARA LIPOSUCCIÓN</h3><p>Comprendo que la liposucción es un procedimiento...</p>', 
 1),
('CONS-MAMO', 'Consentimiento Informado - Mamoplastia', 'Aumento Mamario',
 '<h3>CONSENTIMIENTO INFORMADO PARA AUMENTO MAMARIO</h3><p>He sido informado(a) sobre los riesgos y beneficios...</p>', 
 1);

-- ================================================================
--  VERIFICACIÓN
-- ================================================================
SELECT 'Migración 009 completada - Presupuestos y Seguimiento Post-Op' AS Estado;

SELECT TABLE_NAME, TABLE_ROWS 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('presupuestos_esteticos', 'presupuesto_items', 'seguimiento_postop', 'tipos_consentimiento');

SELECT 'Datos de ejemplo insertados:' AS '';
SELECT COUNT(*) AS 'Presupuestos' FROM presupuestos_esteticos;
SELECT COUNT(*) AS 'Items de presupuesto' FROM presupuesto_items;
SELECT COUNT(*) AS 'Seguimientos post-op' FROM seguimiento_postop;
SELECT COUNT(*) AS 'Tipos de consentimiento' FROM tipos_consentimiento;
