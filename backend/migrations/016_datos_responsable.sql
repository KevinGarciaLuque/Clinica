-- Migración 016: Campos adicionales del paciente (responsable, aseguradora, etc.)

-- Datos del responsable / tutor
ALTER TABLE pacientes ADD COLUMN responsable_nombre     VARCHAR(150) NULL;
ALTER TABLE pacientes ADD COLUMN responsable_parentesco  VARCHAR(50)  NULL;
ALTER TABLE pacientes ADD COLUMN responsable_telefono    VARCHAR(30)  NULL;
ALTER TABLE pacientes ADD COLUMN responsable_email       VARCHAR(120) NULL;
ALTER TABLE pacientes ADD COLUMN responsable_dni         VARCHAR(20)  NULL;
ALTER TABLE pacientes ADD COLUMN responsable_direccion   VARCHAR(250) NULL;

-- Datos de aseguradora / seguro médico
ALTER TABLE pacientes ADD COLUMN aseguradora             VARCHAR(150) NULL;
ALTER TABLE pacientes ADD COLUMN numero_poliza           VARCHAR(80)  NULL;
ALTER TABLE pacientes ADD COLUMN tipo_seguro             VARCHAR(50)  NULL;
ALTER TABLE pacientes ADD COLUMN vigencia_seguro         DATE         NULL;

-- Datos complementarios del paciente
ALTER TABLE pacientes ADD COLUMN estado_civil            VARCHAR(30)  NULL;
ALTER TABLE pacientes ADD COLUMN ocupacion               VARCHAR(100) NULL;
ALTER TABLE pacientes ADD COLUMN escolaridad             VARCHAR(80)  NULL;
ALTER TABLE pacientes ADD COLUMN religion                VARCHAR(80)  NULL;
ALTER TABLE pacientes ADD COLUMN lugar_nacimiento        VARCHAR(150) NULL;
ALTER TABLE pacientes ADD COLUMN nacionalidad            VARCHAR(80)  NULL DEFAULT 'Hondureña';
