-- ============================================================
-- MIGRACIÓN 047 — Corrige categoría de códigos CIE-10 renales
-- Los síndromes glomerulares, nefróticos, nefríticos y la ERC
-- pertenecen a Nefrología, no a Urología.
-- ============================================================

UPDATE cie10
SET categoria = 'Nefrología'
WHERE codigo IN (
  -- Síndrome nefrítico agudo (N00)
  'N00.0','N00.1','N00.2','N00.3','N00.8','N00.9',
  -- Síndrome nefrítico progresión rápida (N01)
  'N01.9',
  -- Hematuria recurrente/persistente (N02)
  'N02.9',
  -- Síndrome nefrítico crónico (N03)
  'N03.9',
  -- Síndrome nefrótico (N04)
  'N04.0','N04.1','N04.2','N04.3','N04.4','N04.5','N04.6','N04.7','N04.8','N04.9',
  -- Síndrome nefrítico NE (N05)
  'N05.9',
  -- Nefropatía hereditaria (N07)
  'N07.9',
  -- Lesión renal aguda (N17)
  'N17.9',
  -- Enfermedad renal crónica (N18)
  'N18.1','N18.2','N18.3','N18.4','N18.5','N18.9',
  -- Insuficiencia renal NE (N19)
  'N19',
  -- Trastornos tubulares / riñón (N25, N26, N28)
  'N25.0','N25.1','N25.9',
  'N26',
  'N28.0','N28.1','N28.9',
  -- Hipertensión renovascular (I12, I13)
  'I12.9','I13.1'
);
