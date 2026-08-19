-- 061_consulta_especialidades_nuevas.sql
-- Las 8 especialidades agregadas después de las 12 originales (Endocrinología,
-- Gastroenterología, Inmunología, Nefrología, Neurología, Otorrinolaringología,
-- Fisioterapia, Trabajo Social) nunca recibieron el módulo "consulta" en
-- tipo_clinica_modulos. Por eso el tab "Historial Clínico" del expediente del
-- paciente nunca aparece para esos tipos de clínica (aunque el sidebar sí
-- muestra el enlace "Consulta", forzado para MEDICO/ADMIN sin revisar permisos).
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT tc.id, (SELECT id FROM modulos_sistema WHERE clave='consulta')
FROM tipos_clinica tc
WHERE tc.id BETWEEN 26 AND 33;
