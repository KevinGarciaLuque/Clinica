-- ============================================================
--  070_informes_mcg.sql
--  Informe de Monitoreo Continuo de Glucosa (AGP) — documento
--  imprimible que la educadora llena y entrega al paciente en físico.
--  Vive dentro del módulo "Educación en Diabetes" (educacion_diabetes),
--  como un tipo de documento aparte de la "Sesión Educativa".
--  Los datos del paciente (nombre, fecha nac., sexo, teléfono) NO se
--  duplican — se jalan de la tabla `pacientes` al imprimir.
-- ============================================================

CREATE TABLE IF NOT EXISTS informes_mcg (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id     INT UNSIGNED NOT NULL,
  paciente_id    INT UNSIGNED NOT NULL,
  educador_id    INT UNSIGNED NOT NULL,
  fecha          DATE NOT NULL,
  -- Cabecera del período de monitoreo
  encabezado     JSON,   -- {id_expediente, dispositivo_sensor, fecha_inicio, fecha_fin, dias_analizados}
  -- 1. Resumen del monitoreo
  resumen        JSON,   -- {dias_uso_sensor, pct_datos_disponibles, glucosa_promedio, gmi, cv, desviacion_estandar}
  -- 2. Tiempo en rangos (5 niveles)
  tiempo_rangos  JSON,   -- {tir:{pct,tiempo}, tar:{pct,tiempo}, tar_alto:{pct,tiempo}, tbr:{pct,tiempo}, tbr_bajo:{pct,tiempo}}
  -- 3. Interpretación clínica
  interpretacion JSON,   -- {hiperglucemia, hipoglucemias, variabilidad, horarios_riesgo, patrones_nocturnos}
  -- 4. Recomendaciones educativas
  recomendaciones JSON,  -- {alimentacion, actividad_fisica, tratamiento_insulina, prevencion_hipoglucemia, uso_sensor, automonitoreo}
  -- 5. Plan de seguimiento
  plan           JSON,   -- {objetivos_acordados, proxima_revision, observaciones}
  -- 6. Datos del profesional (override opcional del usuario que firma)
  profesional    JSON,   -- {nombre, profesion_cargo, numero_colegiacion}
  secciones_completadas JSON,
  estado         ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
  firma_at       DATETIME,
  creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_imcg_clinica  (clinica_id),
  INDEX idx_imcg_paciente (paciente_id),
  INDEX idx_imcg_educador (educador_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
