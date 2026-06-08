-- ============================================================
--  043_fix_psicologia_diagnostico_cie.sql
--  Ampliar diagnostico_cie de VARCHAR(20) a VARCHAR(120)
--  para soportar texto compuesto como "F43.2 — Trastorno de adaptación"
-- ============================================================

ALTER TABLE sesiones_psicologia
  MODIFY COLUMN diagnostico_cie VARCHAR(120);

-- Quitar módulo 'estudios' del tipo de clínica psicología (no aplica)
DELETE tcm
FROM tipo_clinica_modulos tcm
JOIN tipos_clinica tc  ON tc.id  = tcm.tipo_id  AND tc.clave  = 'psicologia'
JOIN modulos_sistema ms ON ms.id = tcm.modulo_id AND ms.clave = 'estudios';

-- Quitar el módulo 'estudios' de clínicas existentes de tipo psicología
DELETE cm
FROM clinica_modulos cm
JOIN clinicas c         ON c.id  = cm.clinica_id  AND c.tipo_id IN (SELECT id FROM tipos_clinica WHERE clave = 'psicologia')
JOIN modulos_sistema ms ON ms.id = cm.modulo_id   AND ms.clave = 'estudios';
