-- 070_fix_admin_modulos_clinicas.sql
-- El preset de módulos (aplicarPresetModulosClinica) marcaba explícitamente
-- habilitado=0 para los módulos de administración en TODA clínica creada
-- después de la migración 065, ocultando la sección "Administración" para el
-- ADMIN de esas clínicas.
--
-- Se eliminan esos overrides por clínica para que vuelvan a heredar el valor
-- por defecto del tipo de clínica (habilitado gracias a 069). Un SUPER_ADMIN
-- puede volver a desactivarlos manualmente desde el modal de permisos.

DELETE cm FROM clinica_modulos cm
JOIN modulos_sistema ms ON ms.id = cm.modulo_id
WHERE ms.clave IN (
  'admin_usuarios','admin_horarios','admin_servicios','admin_plantillas',
  'documentos_clinicos','catalogos','admin_config'
)
AND cm.habilitado = 0;
