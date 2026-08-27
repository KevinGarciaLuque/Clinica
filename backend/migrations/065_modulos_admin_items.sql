-- 065_modulos_admin_items.sql
-- Agrega al catálogo modulos_sistema los ítems fijos de administración
-- (Usuarios, Horarios médicos, Servicios, Plantillas, Documentos Clínicos,
-- Catálogos, Configuración) que hasta ahora vivían hardcodeados en el
-- sidebar sin pasar por el sistema de permisos por clínica/usuario.
--
-- Se enlazan a TODOS los tipos de clínica existentes para que, por defecto,
-- sigan apareciendo exactamente igual que antes en cualquier clínica; solo
-- dejan de mostrarse si un SUPER_ADMIN los desactiva explícitamente desde
-- el modal de "Permisos de módulos".

INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion, orden) VALUES
  ('admin_usuarios',     'Usuarios',            'bi-person-badge-fill',        '/admin/usuarios',      'Gestión de usuarios del sistema',              200),
  ('admin_horarios',     'Horarios médicos',    'bi-clock-fill',                '/admin/horarios',      'Horarios semanales de atención por médico',    201),
  ('admin_servicios',    'Servicios',           'bi-tag-fill',                  '/admin/servicios',     'Catálogo de servicios/tipos de consulta',      202),
  ('admin_plantillas',   'Plantillas',          'bi-file-earmark-text-fill',    '/admin/plantillas',    'Plantillas de documentos e historias',         203),
  ('documentos_clinicos','Documentos Clínicos', 'bi-file-earmark-richtext-fill','/documentos-clinicos', 'Documentos y formatos clínicos generados',     204),
  ('catalogos',          'Catálogos',           'bi-journal-bookmark-fill',     '/catalogos',           'Catálogos generales del sistema',              205),
  ('admin_config',       'Configuración',       'bi-gear-fill',                 '/admin/config',        'Configuración general de la clínica',          990);

-- Enlazar a todos los tipos de clínica existentes (igual que los módulos base)
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave IN (
  'admin_usuarios','admin_horarios','admin_servicios','admin_plantillas',
  'documentos_clinicos','catalogos','admin_config'
);
