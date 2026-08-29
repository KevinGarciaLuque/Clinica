-- 066_titulo_medico_clinica.sql
-- Flag por clínica: si se muestra el título "Dr./Dra." y la especialidad
-- junto al nombre del médico en toda la interfaz y documentos.
-- 1 (default) = comportamiento actual  |  0 = solo "Nombre Apellido"
ALTER TABLE clinicas ADD COLUMN titulo_medico TINYINT(1) NOT NULL DEFAULT 1 AFTER es_pediatrica;

-- La clínica que pidió el cambio: Clínica de Diabetes y Tecnología (id 27)
UPDATE clinicas SET titulo_medico = 0 WHERE id = 27;
