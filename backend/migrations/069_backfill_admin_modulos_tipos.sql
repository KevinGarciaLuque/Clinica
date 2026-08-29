-- 069_backfill_admin_modulos_tipos.sql
-- Re-enlaza los módulos de administración (Usuarios, Horarios, Servicios,
-- Plantillas, Documentos Clínicos, Catálogos, Configuración) a TODOS los tipos
-- de clínica, incluidos los creados después de la migración 065. Sin esto, un
-- ADMIN de una clínica cuyo tipo se creó luego (p. ej. Cardiología) no ve la
-- sección "Administración" en el menú.

INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave IN (
  'admin_usuarios','admin_horarios','admin_servicios','admin_plantillas',
  'documentos_clinicos','catalogos','admin_config'
);
