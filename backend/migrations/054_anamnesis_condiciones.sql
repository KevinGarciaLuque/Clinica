-- ============================================================
--  054_anamnesis_condiciones.sql
--  Fase A: Anamnesis dinámica y configurable (HC-02)
-- ============================================================

-- 1. Catálogo de condiciones médicas configurable por clínica
CREATE TABLE IF NOT EXISTS catalogo_condiciones_medicas (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id            INT UNSIGNED NOT NULL,
  nombre                VARCHAR(150) NOT NULL,
  requiere_especifique  TINYINT(1) DEFAULT 0,
  es_alerta             TINYINT(1) DEFAULT 0,
  orden                 INT DEFAULT 0,
  activo                TINYINT(1) DEFAULT 1,
  creado_en             DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ccm_clinica (clinica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Ampliar historia_odontologica con anamnesis dinámica (HC-02)
ALTER TABLE historia_odontologica
  ADD COLUMN fecha_ultima_consulta DATE NULL AFTER motivo_consulta_inicial,
  ADD COLUMN complicaciones_previas TEXT NULL AFTER fecha_ultima_consulta,
  ADD COLUMN antecedentes JSON NULL AFTER complicaciones_previas,
  ADD COLUMN medicamentos JSON NULL AFTER antecedentes,
  ADD COLUMN declaracion_veraz TINYINT(1) DEFAULT 0 AFTER notas,
  ADD COLUMN firma_paciente_nombre VARCHAR(150) NULL AFTER declaracion_veraz,
  ADD COLUMN firma_fecha DATETIME NULL AFTER firma_paciente_nombre;

-- 3. Seed: condiciones por defecto (HC-02) para clínicas de tipo dental
INSERT INTO catalogo_condiciones_medicas (clinica_id, nombre, requiere_especifique, es_alerta, orden)
SELECT c.id, x.nombre, x.requiere_especifique, x.es_alerta, x.orden
FROM clinicas c
JOIN tipos_clinica tc ON tc.id = c.tipo_id AND tc.clave = 'dental'
JOIN (
  SELECT 1  AS orden, 'Tratamiento médico actual'                       AS nombre, 1 AS requiere_especifique, 0 AS es_alerta UNION ALL
  SELECT 2,  'Alergia a Medicamentos (Penicilina, etc.)',                1, 1 UNION ALL
  SELECT 3,  'Alergia a Anestésicos / Látex',                            1, 1 UNION ALL
  SELECT 4,  'Hipertensión Arterial',                                    0, 0 UNION ALL
  SELECT 5,  'Problemas Cardíacos',                                      1, 0 UNION ALL
  SELECT 6,  'Diabetes',                                                 0, 0 UNION ALL
  SELECT 7,  'Problemas de Coagulación / Hemorragias',                   1, 1 UNION ALL
  SELECT 8,  'Enfermedades Respiratorias (Asma, etc.)',                  1, 0 UNION ALL
  SELECT 9,  'Hospitalizaciones o Cirugías previas',                     1, 0 UNION ALL
  SELECT 10, 'Fuma o consume alcohol',                                   1, 0 UNION ALL
  SELECT 11, 'Enf. Infectocontagiosas (Hepatitis, VIH, TB)',             1, 1 UNION ALL
  SELECT 12, 'Embarazo',                                                 1, 1 UNION ALL
  SELECT 13, 'Menopausia',                                               0, 0 UNION ALL
  SELECT 14, 'Epilepsia',                                                1, 1 UNION ALL
  SELECT 15, 'Anemia',                                                   0, 0 UNION ALL
  SELECT 16, 'Hipotiroidismo / Hipertiroidismo',                         1, 0 UNION ALL
  SELECT 17, 'Angina de Pecho',                                          0, 1 UNION ALL
  SELECT 18, 'Infartos',                                                 1, 1 UNION ALL
  SELECT 19, 'Insuficiencia Renal',                                      0, 0 UNION ALL
  SELECT 20, 'Cáncer',                                                   1, 0 UNION ALL
  SELECT 21, 'Otros',                                                    1, 0
) x
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_condiciones_medicas ccm WHERE ccm.clinica_id = c.id
);
