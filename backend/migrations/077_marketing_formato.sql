-- ============================================================
--  077_marketing_formato.sql
--  Formato del contenido de Marketing Médico (horizontal / vertical)
--  para separar en la web pública videos/posts tipo "Shorts".
--  Nota: routes/marketingMedico.js también agrega esta columna sola
--  al arrancar (ensureSchema), así que correrla a mano es opcional.
-- ============================================================

ALTER TABLE marketing_medico_items
  ADD COLUMN formato VARCHAR(12) NOT NULL DEFAULT 'horizontal' AFTER media_public_id;
