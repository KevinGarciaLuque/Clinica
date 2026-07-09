-- ============================================================
--  052_modulo_educacion_diabetes.sql
--  Módulo "Educación en Diabetes" (Educador/a en Diabetes)
--  Independiente del módulo "Control de Seguimiento" — el superadmin
--  puede activar/desactivar cada uno por separado, por clínica.
-- ============================================================

-- 1. Registrar el módulo en modulos_sistema
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, disponible, orden, para_normal, para_pediatrica)
VALUES ('educacion_diabetes', 'Educación en Diabetes', '📚', '/educacion/consulta', 1, 38, 1, 0);

-- 2. Asignar módulo al tipo de clínica "endocrinologia"
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, ms.id
FROM tipos_clinica tc, modulos_sistema ms
WHERE tc.clave = 'endocrinologia' AND ms.clave = 'educacion_diabetes';

-- 3. Sesiones de educación en diabetes (una fila por sesión con la educadora)
--    Sección 1 (datos generales: nombre, edad, sexo, fecha_nacimiento, teléfono,
--    ocupación, escolaridad) NO se duplica — ya existe en la tabla `pacientes`.
CREATE TABLE IF NOT EXISTS sesiones_educacion_diabetes (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id            INT UNSIGNED NOT NULL,
  paciente_id           INT UNSIGNED NOT NULL,
  educador_id           INT UNSIGNED NOT NULL,
  fecha                 DATE NOT NULL,
  -- 2. Diagnóstico
  diagnostico           JSON,   -- {tipo_dm, tipo_dm_otro, anio_diagnostico, motivo_consulta, medico_tratante}
  -- 3. Antecedentes relevantes
  antecedentes          JSON,   -- {comorbilidades:{hta,dislipidemia,obesidad,erc,ecv,hipotiroidismo,otra,otra_texto}, complicaciones:{retinopatia,neuropatia,nefropatia,pie_diabetico,ninguna}}
  -- 4. Tratamiento actual
  tratamiento_actual    JSON,   -- {medicamentos, insulina_basal, insulina_rapida, esquema}
  -- 5. Monitoreo de glucosa
  monitoreo             JSON,   -- {metodo:{glucometro,cgm}, frecuencia, ayunas, antes_comidas, despues_comidas, hipoglucemias, reconoce_sintomas}
  -- 6. Alimentación
  alimentacion          JSON,   -- {quien_prepara, comidas_dia, bebidas_azucaradas, conteo_carbohidratos, horario_regular}
  -- 7. Actividad física
  actividad_fisica      JSON,   -- {no_realiza, tipo, frecuencia}
  -- 8. Educación en diabetes (previa)
  educacion_previa      JSON,   -- {ha_recibido, conoce:{hipoglucemia,hiperglucemia,tecnica,rotacion,conteo_cho,correccion,dias_enfermedad,cuidado_pies}}
  -- 9. Objetivos del paciente
  objetivos_paciente    TEXT,
  -- 10. Plan educativo
  plan_educativo        JSON,   -- {temas:{...}, proxima_cita, observaciones}
  -- 11. Evaluación educativa
  evaluacion_educativa  JSON,   -- {nivel_diabetes, nivel_alimentacion, nivel_insulina, nivel_monitoreo, barreras:{...}}
  -- Qué secciones llenó la educadora en esta sesión (para mostrar badges en la UI)
  secciones_completadas JSON,
  estado                ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
  firma_at              DATETIME,
  creado_en             DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sed_clinica  (clinica_id),
  INDEX idx_sed_paciente (paciente_id),
  INDEX idx_sed_educador (educador_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
