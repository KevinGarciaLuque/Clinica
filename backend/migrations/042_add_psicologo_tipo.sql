-- Migración 042: Agrega tipo PSICOLOGO y especialidad Psicología
-- Fecha: 2026-06-06

-- 1. Agregar Psicología al catálogo de especialidades
INSERT IGNORE INTO especialidades (nombre) VALUES ('Psicología');

-- 2. Ampliar el ENUM de tipo en usuarios para incluir PSICOLOGO
ALTER TABLE usuarios
  MODIFY COLUMN tipo ENUM(
    'SUPER_ADMIN','ADMIN','MEDICO','PSICOLOGO','ENFERMERA','RECEPCIONISTA','PACIENTE_PORTAL'
  ) NOT NULL DEFAULT 'RECEPCIONISTA';
