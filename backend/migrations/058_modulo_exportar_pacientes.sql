-- ============================================================
--  Migración 058 — Módulo Exportar Pacientes
--  Objetivo: Registrar el módulo de exportación de pacientes
--  (Excel / ZIP) en el catálogo del sistema, disponible para
--  todos los tipos de clínica y controlable desde el modal de
--  "Permisos de módulos" del Super Admin.
-- ============================================================

INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion)
VALUES (
  'exportar_pacientes',
  'Exportar Pacientes',
  'bi-file-earmark-excel-fill',
  '/pacientes/exportar',
  'Descarga de la información de pacientes en Excel y ZIP (documentos, estudios e imágenes)'
);

INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave = 'exportar_pacientes';
