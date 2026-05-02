-- Migración 036: Agregar columna departamento a la tabla pacientes
-- Esta columna almacena el departamento/estado del paciente (ej: "Francisco Morazán")

ALTER TABLE pacientes
  ADD COLUMN departamento VARCHAR(100) NULL AFTER ciudad;
