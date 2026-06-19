-- ============================================================
-- MIGRACIÓN 046 — Ligar documentos a una consulta específica
-- Agrega historia_id a documentos_paciente y extiende el ENUM
-- de tipo para incluir tipos de consulta.
-- ============================================================

-- 1. Agregar columna historia_id (nullable, FK a historias_clinicas)
ALTER TABLE documentos_paciente
  ADD COLUMN IF NOT EXISTS historia_id INT UNSIGNED NULL AFTER paciente_id,
  ADD INDEX idx_doc_historia (historia_id);

-- 2. Agregar FK (ignorar si ya existe)
ALTER TABLE documentos_paciente
  ADD CONSTRAINT fk_doc_historia
  FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE SET NULL;

-- 3. Ampliar ENUM para tipos de documentos en consulta
ALTER TABLE documentos_paciente
  MODIFY COLUMN tipo ENUM(
    'dni_frente','dni_reverso','seguro','consentimiento',
    'laboratorio','imagen','radiografia','resultado','receta','otro'
  ) NOT NULL DEFAULT 'otro';
