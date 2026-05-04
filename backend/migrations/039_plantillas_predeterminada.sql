-- Migration 039: Agregar columna es_predeterminada a plantillas_documentos
-- Permite marcar una plantilla como predeterminada para usarla en PDFs

ALTER TABLE plantillas_documentos
ADD COLUMN IF NOT EXISTS es_predeterminada TINYINT(1) DEFAULT 0 AFTER activo;

-- Crear índice para busquedas rápidas
CREATE INDEX IF NOT EXISTS idx_plantillas_predeterminada 
ON plantillas_documentos (clinica_id, tipo, es_predeterminada, activo);
