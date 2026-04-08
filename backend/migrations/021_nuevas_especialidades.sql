-- Migración 021: Nuevas especialidades médicas
-- Fecha: 2026-04-07

INSERT IGNORE INTO tipos_clinica (clave, nombre, icono, color, descripcion) VALUES
  ('endocrinologia',      'Endocrinología',               'bi-droplet-half',          '#FF7043', 'Glándulas endocrinas, metabolismo y hormonas'),
  ('gastroenterologia',   'Gastroenterología',            'bi-capsule-pill',           '#8D6E63', 'Sistema digestivo y enfermedades gastrointestinales'),
  ('inmunologia',         'Inmunología y Alergias',       'bi-shield-plus',            '#26C6DA', 'Sistema inmune, alergias e inmunodeficiencias'),
  ('nefrologia',          'Nefrología',                   'bi-water',                  '#42A5F5', 'Riñones y enfermedades del sistema urinario'),
  ('neurologia',          'Neurología',                   'bi-lightning-fill',         '#AB47BC', 'Sistema nervioso central y periférico'),
  ('otorrinolaringologia','Otorrinolaringología',         'bi-ear-fill',               '#26A69A', 'Oído, nariz, garganta y cabeza-cuello'),
  ('fisioterapia',        'Fisioterapia',                 'bi-person-walking',         '#FF8F00', 'Rehabilitación física y terapia del movimiento'),
  ('trabajo_social',      'Trabajo Social',               'bi-person-heart-fill',      '#EC407A', 'Apoyo social, familiar y gestión de recursos');

-- Asignar módulos base a los nuevos tipos
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE t.clave IN (
  'endocrinologia','gastroenterologia','inmunologia','nefrologia',
  'neurologia','otorrinolaringologia','fisioterapia','trabajo_social'
)
AND m.clave IN ('dashboard','pacientes','citas','historia_clinica','chat_ia','estudios');

-- Verificar resultado
SELECT id, clave, nombre, color FROM tipos_clinica ORDER BY nombre;
