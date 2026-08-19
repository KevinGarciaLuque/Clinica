-- 062_traumatologia_ortopedia.sql
-- Renombra el tipo de clínica "Traumatología" a "Traumatología y Ortopedia"
-- (misma especialidad/certificación en la práctica médica hispanohablante).
UPDATE tipos_clinica
SET nombre = 'Traumatología y Ortopedia',
    descripcion = 'Sistema músculo-esquelético, lesiones y ortopedia'
WHERE clave = 'traumatologia';
