-- ============================================================
-- MIGRACIÓN 045 — CIE-10 Nefrología Pediátrica
-- Agrega códigos N04.x (Síndrome nefrótico) y códigos
-- frecuentes en nefrología y urología pediátrica.
-- ============================================================
INSERT IGNORE INTO cie10 (codigo, descripcion, categoria) VALUES

-- ─── Síndrome nefrótico (N04) ───────────────────────────────
('N04.0', 'Síndrome nefrótico con anomalía glomerular menor',                         'Nefrología'),
('N04.1', 'Síndrome nefrótico con lesiones glomerulares focales y segmentarias',       'Nefrología'),
('N04.2', 'Síndrome nefrótico con glomerulonefritis membranosa',                       'Nefrología'),
('N04.3', 'Síndrome nefrótico con glomerulonefritis mesangial proliferativa',          'Nefrología'),
('N04.4', 'Síndrome nefrótico con glomerulonefritis endocapilar proliferativa',        'Nefrología'),
('N04.5', 'Síndrome nefrótico con glomerulonefritis mesangiocapilar',                  'Nefrología'),
('N04.6', 'Síndrome nefrótico con enfermedad de depósitos densos',                     'Nefrología'),
('N04.7', 'Síndrome nefrótico con glomerulonefritis difusa en media luna',             'Nefrología'),
('N04.8', 'Síndrome nefrótico con otras alteraciones morfológicas (nefropatía por IgA)','Nefrología'),
('N04.9', 'Síndrome nefrótico con cambios morfológicos NE',                            'Nefrología'),

-- ─── Síndrome nefrítico agudo (N00) ─────────────────────────
('N00.0', 'Síndrome nefrítico agudo con anomalía glomerular menor',                   'Nefrología'),
('N00.1', 'Síndrome nefrítico agudo con lesiones glomerulares focales y segmentarias','Nefrología'),
('N00.2', 'Síndrome nefrítico agudo con glomerulonefritis membranosa',                'Nefrología'),
('N00.3', 'Síndrome nefrítico agudo con glomerulonefritis mesangial proliferativa',   'Nefrología'),
('N00.8', 'Síndrome nefrítico agudo con otras alteraciones morfológicas',              'Nefrología'),

-- ─── Síndrome nefrítico progresivo rápido (N01) ─────────────
('N01.9', 'Síndrome nefrítico de progresión rápida NE',                               'Nefrología'),

-- ─── Hematuria recurrente y persistente (N02) ───────────────
('N02.9', 'Hematuria recurrente y persistente NE',                                    'Nefrología'),

-- ─── Síndrome nefrítico crónico (N03) ───────────────────────
('N03.9', 'Síndrome nefrítico crónico NE',                                            'Nefrología'),

-- ─── Síndrome nefrótico NE (N05) ────────────────────────────
('N05.9', 'Síndrome nefrítico no especificado NE',                                    'Nefrología'),

-- ─── Nefropatía hereditaria (N07) ───────────────────────────
('N07.9', 'Nefropatía hereditaria NE',                                                'Nefrología'),

-- ─── Insuficiencia renal / ERC adicional ────────────────────
('N18.1', 'Enfermedad renal crónica etapa 1',                                         'Nefrología'),
('N18.2', 'Enfermedad renal crónica etapa 2',                                         'Nefrología'),
('N18.4', 'Enfermedad renal crónica etapa 4',                                         'Nefrología'),
('N18.5', 'Enfermedad renal crónica etapa 5',                                         'Nefrología'),
('N19',   'Insuficiencia renal NE',                                                   'Nefrología'),

-- ─── Hipertensión renovascular / trastornos tubulares ───────
('N25.0', 'Osteodistrofia renal',                                                     'Nefrología'),
('N25.1', 'Diabetes insípida nefrogénica',                                            'Nefrología'),
('N25.9', 'Trastorno resultante de función tubular renal alterada NE',                'Nefrología'),
('N26',   'Riñón contraído NE',                                                       'Nefrología'),
('N28.0', 'Isquemia e infarto del riñón',                                             'Nefrología'),
('N28.1', 'Quiste adquirido del riñón',                                               'Nefrología'),
('N28.9', 'Trastorno del riñón y del uréter NE',                                     'Nefrología'),

-- ─── Infección vías urinarias ────────────────────────────────
('N39.0', 'Infección de vías urinarias NE',                                           'Urología'),

-- ─── Vejiga neuropática ──────────────────────────────────────
('N31.0', 'Vejiga neuropática no inhibida',                                           'Urología'),
('N31.1', 'Vejiga neuropática refleja',                                               'Urología'),
('N31.2', 'Disfunción neuromuscular de la vejiga (Vejiga neuropática flácida)',       'Urología'),
('N31.9', 'Disfunción neuromuscular de la vejiga NE',                                 'Urología'),

-- ─── Anomalías congénitas del riñón ─────────────────────────
('Q61.0', 'Quiste renal congénito solitario',                                         'Congénitas'),
('Q61.1', 'Riñón poliquístico de tipo infantil',                                      'Congénitas'),
('Q61.2', 'Riñón poliquístico de tipo adulto',                                        'Congénitas'),
('Q61.3', 'Riñón poliquístico NE (Multiquístico)',                                    'Congénitas'),
('Q61.4', 'Enfermedad renal quística NE',                                             'Congénitas'),
('Q61.5', 'Riñón medular quístico',                                                   'Congénitas'),
('Q61.9', 'Enfermedad quística del riñón NE',                                         'Congénitas'),
('Q62.0', 'Hidronefrosis congénita',                                                  'Congénitas'),
('Q62.2', 'Megauréter congénito',                                                     'Congénitas'),
('Q62.3', 'Obstrucción ureteropélvica congénita',                                     'Congénitas'),
('Q63.0', 'Riñón accesorio',                                                          'Congénitas'),
('Q63.2', 'Riñón en herradura',                                                       'Congénitas'),
('Q63.9', 'Malformación congénita del riñón NE',                                      'Congénitas'),

-- ─── Hipospadias ─────────────────────────────────────────────
('Q54.0', 'Hipospadias del glande',                                                   'Congénitas'),
('Q54.1', 'Hipospadias peneana',                                                      'Congénitas'),
('Q54.2', 'Hipospadias penoscrotal',                                                  'Congénitas'),
('Q54.3', 'Hipospadias perineal',                                                     'Congénitas'),
('Q54.4', 'Cuerda sin hipospadias',                                                   'Congénitas'),
('Q54.9', 'Hipospadias NE',                                                           'Congénitas'),

-- ─── Testículo no descendido ─────────────────────────────────
('Q53.0', 'Testículo ectópico',                                                       'Congénitas'),
('Q53.1', 'Testículo no descendido unilateral',                                       'Congénitas'),
('Q53.2', 'Testículo no descendido bilateral',                                        'Congénitas'),
('Q53.9', 'Testículo no descendido NE',                                               'Congénitas'),

-- ─── Prepucio / Fimosis / Hidrocele congénito ───────────────
('N47',   'Prepucio redundante, fimosis y parafimosis',                               'Urología'),
('P83.5', 'Hidrocele congénito',                                                      'Congénitas'),

-- ─── Hiperplasia suprarrenal congénita ───────────────────────
('E25.0', 'Trastornos adrenogenitales congénitos con deficiencia enzimática',         'Endocrino'),
('E27.8', 'Hiperplasia suprarrenal congénita (otros trastornos especificados)',        'Endocrino'),

-- ─── Enuresis ────────────────────────────────────────────────
('F98.0', 'Enuresis no orgánica',                                                     'Urología'),
('R32',   'Incontinencia urinaria NE',                                                'Urología'),

-- ─── Proteinuria / Hematuria sin diagnóstico ─────────────────
('R80',   'Proteinuria aislada',                                                      'Urología'),
('R81',   'Glucosuria',                                                               'Urología'),
('R31',   'Hematuria NE',                                                             'Urología'),
('R82.9', 'Otro hallazgo anormal en orina NE',                                        'Urología'),

-- ─── Hipertensión arterial (pediatría) ───────────────────────
('I10',   'Hipertensión esencial primaria',                                           'Cardiología'),
('I12.9', 'Enfermedad renal hipertensiva sin insuficiencia renal',                    'Nefrología'),
('I13.1', 'Enfermedad cardiorrenale hipertensiva sin insuficiencia cardíaca',         'Nefrología'),

-- ─── Edema ───────────────────────────────────────────────────
('R60.0', 'Edema localizado',                                                         'General'),
('R60.9', 'Edema NE',                                                                 'General');

-- ============================================================
-- Rellenar descripcion_cie vacía en catálogo de diagnósticos
-- tomando la descripción directamente de la tabla cie10.
-- Aplica a TODAS las clínicas (no solo nefrología).
-- ============================================================
UPDATE catalogos_diagnostico cd
  JOIN cie10 c ON c.codigo = cd.codigo_cie
SET cd.descripcion_cie = c.descripcion
WHERE (cd.descripcion_cie IS NULL OR cd.descripcion_cie = '')
  AND cd.activo = 1;
