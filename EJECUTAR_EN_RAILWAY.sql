-- ============================================================
-- EJECUTAR ESTOS SQL UNO POR UNO EN RAILWAY
-- ============================================================

-- PASO 1: Ejecuta primero este (copia solo esta línea):
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, orden, descripcion, disponible) VALUES ('consulta', 'Consulta', 'bi-clipboard2-pulse-fill', '/consulta', 35, 'Vista de citas del día y sala de espera', 1);

-- PASO 2: Luego ejecuta este (copia desde INSERT hasta el punto y coma):
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id) SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m WHERE m.clave = 'consulta';

-- PASO 3: Finalmente verifica con este:
SELECT m.id, m.clave, m.nombre, m.icono, m.ruta, m.orden, COUNT(tcm.tipo_id) as tipos_asignados FROM modulos_sistema m LEFT JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = m.id WHERE m.clave = 'consulta' GROUP BY m.id;
