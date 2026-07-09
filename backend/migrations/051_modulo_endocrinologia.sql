-- ============================================================
--  051_modulo_endocrinologia.sql
--  Módulo "Control de Seguimiento" — Endocrinología (DM1)
--  Basado en "Historia Clínica: Control Intensivo en Pacientes
--  con Diabetes Tipo 1" (excluye sección de úlcera/PEDIS/WiFi/ITB
--  y la sección DQOL + "Otros exámenes relevantes")
-- ============================================================

-- 1. Registrar el módulo en modulos_sistema
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica)
VALUES ('control_seguimiento_dm1', 'Control de Seguimiento', '🩸', '/endocrinologia/seguimiento', 1, 37, 1, 0);

-- 2. Asignar módulo al tipo de clínica "endocrinologia"
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id
FROM tipos_clinica tc, modulos_sistema ms
WHERE tc.clave = 'endocrinologia' AND ms.clave = 'control_seguimiento_dm1';

-- 3. Historia clínica inicial (Secciones I y II del PDF — una por paciente por clínica)
CREATE TABLE IF NOT EXISTS historia_endocrinologia (
  id                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id                INT UNSIGNED NOT NULL,
  paciente_id               INT UNSIGNED NOT NULL,
  -- I. Datos personales adicionales (nombre, edad, sexo, teléfono, dirección,
  --    religión, departamento/ciudad ya existen en la tabla `pacientes`
  --    y no se duplican aquí)
  medico                    VARCHAR(150),
  -- II.1 Historia de Diabetes Tipo 1
  fecha_diagnostico         DATE,
  edad_diagnostico          SMALLINT UNSIGNED,
  circunstancia_diagnostico VARCHAR(40),   -- ASINTOMATICO | CETOACIDOSIS | HIPERGLUCEMIA_SINTOMATICA | OTRO
  circunstancia_otro        VARCHAR(255),
  autoanticuerpos           JSON,          -- {na, no_realizados, anti_gad, ia2, znt8, otro}
  tratamiento_inicial       JSON,          -- {basal_bolo, bomba, otro, otro_texto}
  -- Antecedentes personales patológicos
  antecedentes_patologicos  JSON,          -- { hipertension:{valor,comentario}, dislipidemia:{...}, ... }
  antecedentes_otros        TEXT,
  -- Hábitos
  tabaquismo                VARCHAR(10),   -- AFIRMA | NIEGA
  tabaquismo_comentario     VARCHAR(255),
  alcohol                   VARCHAR(10),
  alcohol_comentario        VARCHAR(255),
  drogas                    VARCHAR(10),
  drogas_comentario         VARCHAR(255),
  -- Antecedentes familiares patológicos
  antecedentes_familiares   JSON,          -- { dm1:{valor,parentesco}, dm2:{...}, ... }
  -- Antecedentes gineco-obstétricos
  gineco_obstetricos        JSON,          -- {na, menarquia, fum, ciclos, g,p,a,c, complicaciones, complicaciones_detalle, planificacion, planificacion_cual}
  creado_en                 DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_he_clinica_paciente (clinica_id, paciente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Seguimientos (una fila por visita — Secciones III, IV, V y cierre del PDF)
CREATE TABLE IF NOT EXISTS seguimientos_endocrinologia (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id            INT UNSIGNED NOT NULL,
  paciente_id           INT UNSIGNED NOT NULL,
  medico_id             INT UNSIGNED NOT NULL,
  fecha                 DATE NOT NULL,
  -- III.1 Control metabólico
  control_metabolico    JSON,   -- {hba1c, hba1c_fecha, mcg:{tir,tar,tbr,variabilidad,gmi}, glucometro:{tir,tar,tbr,variabilidad}, frecuencia_hipoglucemia, frecuencia_hiperglucemia}
  -- III.2 Parámetros antropométricos
  antropometria         JSON,   -- {peso, talla, imc, circunferencia_cintura}
  -- III.3.a Retinopatía diabética
  retinopatia           JSON,   -- {fecha_examen, no_realizado, resultado, otro}
  -- III.3.b Nefropatía diabética
  nefropatia            JSON,   -- {albumina_creatinina, fecha_alb, egfr, fecha_egfr}
  -- III.3.c Neuropatía diabética (mTCNS) + riesgo de pie (sin úlcera/PEDIS/WiFi/ITB)
  neuropatia            JSON,   -- {sintomas:{...}, pruebas:{...}, subtotal_signos, puntaje_total, grado_riesgo_pie}
  -- III.3.d Evaluación cardiovascular
  cardiovascular        JSON,   -- {pa_sistolica, pa_diastolica, fc, sato2, fr, perfil_lipidico:{...}, hallazgos_adicionales}
  -- IV. Terapia y adherencia
  terapia_adherencia    JSON,   -- {esquema:{...}, dosis:{...}, factor_correccion, indice_ic, na_ic, terapia_farmacologica, mcg:{...}, adherencia}
  -- V. Evaluación psicosocial (sin DQOL)
  psicosocial           JSON,   -- {depresion_ansiedad, apoyo_social, paid5_score}
  -- Cierre: criterio de inclusión, diagnósticos y plan
  plan                  JSON,   -- {criterio_inclusion, diagnosticos, plan_accion, ajustes:{...}, proximo_seguimiento:{...}}
  -- Qué secciones llenó el doctor en esta visita (para mostrar badges en la UI)
  secciones_completadas JSON,
  estado                ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
  firma_at              DATETIME,
  creado_en             DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_se_clinica  (clinica_id),
  INDEX idx_se_paciente (paciente_id),
  INDEX idx_se_medico   (medico_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
