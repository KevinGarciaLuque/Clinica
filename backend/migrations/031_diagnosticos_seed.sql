-- ============================================================
-- Migración 031: Campo especialidad en catálogo de diagnósticos
--               + seed de diagnósticos pediátricos y generales
-- ============================================================

-- 1. Agregar columna especialidad (filtro por tipo de clínica)
ALTER TABLE catalogos_diagnostico
  ADD COLUMN IF NOT EXISTS especialidad VARCHAR(60) NULL
  COMMENT 'PEDIATRIA, MEDICINA_GENERAL, CARDIOLOGIA, etc. NULL = todas'
  AFTER nombre;

-- 2. Seed: diagnósticos pediátricos globales (clinica_id = NULL)
INSERT IGNORE INTO catalogos_diagnostico (clinica_id, medico_id, nombre, especialidad, codigo_cie, descripcion_cie, diagnosticos_secundarios) VALUES

-- ── Respiratorias ───────────────────────────────────────────────────────────
(NULL, NULL, 'Resfriado común (rinofaringitis aguda)',        'PEDIATRIA', 'J00',   'Rinofaringitis aguda', NULL),
(NULL, NULL, 'IRA alta no especificada',                      'PEDIATRIA', 'J06.9', 'Infección aguda de vías respiratorias superiores, no especificada', NULL),
(NULL, NULL, 'Faringitis aguda',                              'PEDIATRIA', 'J02.9', 'Faringitis aguda, no especificada',
  '[{"cie":"J00","descripcion":"Rinofaringitis aguda"}]'),
(NULL, NULL, 'Amigdalitis aguda',                             'PEDIATRIA', 'J03.9', 'Amigdalitis aguda, no especificada',
  '[{"cie":"J02.9","descripcion":"Faringitis aguda"}]'),
(NULL, NULL, 'Otitis media aguda',                            'PEDIATRIA', 'H66.9', 'Otitis media, no especificada',
  '[{"cie":"J06.9","descripcion":"IRA alta"}]'),
(NULL, NULL, 'Bronquitis aguda',                              'PEDIATRIA', 'J20.9', 'Bronquitis aguda, no especificada', NULL),
(NULL, NULL, 'Bronconeumonía',                                'PEDIATRIA', 'J18.0', 'Bronconeumonía, no especificada', NULL),
(NULL, NULL, 'Neumonía no especificada',                      'PEDIATRIA', 'J18.9', 'Neumonía, no especificada', NULL),
(NULL, NULL, 'Asma bronquial',                                'PEDIATRIA', 'J45.9', 'Asma, no especificada',
  '[{"cie":"J20.9","descripcion":"Bronquitis aguda"}]'),
(NULL, NULL, 'Rinitis alérgica',                              'PEDIATRIA', 'J30.1', 'Rinitis alérgica debida al polen', NULL),
(NULL, NULL, 'Laringotraqueítis aguda (croup)',                'PEDIATRIA', 'J05.0', 'Laringitis obstructiva aguda [croup]', NULL),
(NULL, NULL, 'Bronquiolitis aguda por VRS',                   'PEDIATRIA', 'J21.0', 'Bronquiolitis aguda debida a virus sincicial respiratorio', NULL),

-- ── Gastrointestinales ──────────────────────────────────────────────────────
(NULL, NULL, 'EDA (diarrea aguda infecciosa)',                 'PEDIATRIA', 'A09',   'Otras gastroenteritis y colitis de origen infeccioso',
  '[{"cie":"E86","descripcion":"Deshidratación"}]'),
(NULL, NULL, 'Enteritis por rotavirus',                       'PEDIATRIA', 'A08.0', 'Enteritis debida a rotavirus', NULL),
(NULL, NULL, 'Estreñimiento funcional',                       'PEDIATRIA', 'K59.0', 'Estreñimiento', NULL),
(NULL, NULL, 'Enfermedad por reflujo gastroesofágico',         'PEDIATRIA', 'K21.0', 'Enfermedad de reflujo gastroesofágico con esofagitis', NULL),
(NULL, NULL, 'Náuseas y vómitos',                             'PEDIATRIA', 'R11',   'Náuseas y vómitos', NULL),
(NULL, NULL, 'Dolor abdominal recurrente',                    'PEDIATRIA', 'R10.4', 'Otros dolores abdominales y los no especificados', NULL),
(NULL, NULL, 'Parasitosis intestinal',                        'PEDIATRIA', 'B82.9', 'Parasitosis intestinal, no especificada', NULL),

-- ── Enfermedades infecciosas / exantemas ────────────────────────────────────
(NULL, NULL, 'Varicela',                                      'PEDIATRIA', 'B01.9', 'Varicela sin complicaciones', NULL),
(NULL, NULL, 'Escarlatina',                                   'PEDIATRIA', 'A38',   'Escarlatina',
  '[{"cie":"J02.0","descripcion":"Faringitis estreptocócica"}]'),
(NULL, NULL, 'Herpangina',                                    'PEDIATRIA', 'B08.5', 'Faringitis vesicular por enterovirus', NULL),
(NULL, NULL, 'Enfermedad mano-pie-boca',                      'PEDIATRIA', 'B08.4', 'Estomatitis vesicular por enterovirus con exantema', NULL),
(NULL, NULL, 'Exantema súbito (roséola)',                     'PEDIATRIA', 'B08.2', 'Exantema súbito [sexta enfermedad], no especificado', NULL),
(NULL, NULL, 'Fiebre sin foco',                               'PEDIATRIA', 'R50.9', 'Fiebre, no especificada', NULL),
(NULL, NULL, 'Infección de vías urinarias',                   'PEDIATRIA', 'N39.0', 'Infección de vías urinarias, sitio no especificado', NULL),

-- ── Neurológicas / Desarrollo ───────────────────────────────────────────────
(NULL, NULL, 'Convulsión febril',                             'PEDIATRIA', 'R56.0', 'Convulsiones febriles', NULL),
(NULL, NULL, 'Epilepsia no especificada',                     'PEDIATRIA', 'G40.9', 'Epilepsia, no especificada', NULL),
(NULL, NULL, 'TDAH (trastorno de atención e hiperactividad)', 'PEDIATRIA', 'F90.0', 'Trastorno de actividad y atención', NULL),
(NULL, NULL, 'Trastorno del espectro autista',                'PEDIATRIA', 'F84.0', 'Autismo infantil', NULL),
(NULL, NULL, 'Retraso en el habla y lenguaje',                'PEDIATRIA', 'F80.9', 'Trastorno del desarrollo del habla y lenguaje, no especificado', NULL),
(NULL, NULL, 'Cefalea tensional',                             'PEDIATRIA', 'G44.2', 'Cefalea tensional', NULL),

-- ── Nutricionales / Crecimiento ─────────────────────────────────────────────
(NULL, NULL, 'Desnutrición leve',                             'PEDIATRIA', 'E44.1', 'Desnutrición proteico-calórica leve', NULL),
(NULL, NULL, 'Desnutrición moderada',                         'PEDIATRIA', 'E44.0', 'Desnutrición proteico-calórica moderada', NULL),
(NULL, NULL, 'Desnutrición grave',                            'PEDIATRIA', 'E43',   'Desnutrición proteico-calórica grave, no especificada', NULL),
(NULL, NULL, 'Talla baja',                                    'PEDIATRIA', 'E34.3', 'Talla baja constitucional', NULL),
(NULL, NULL, 'Obesidad infantil',                             'PEDIATRIA', 'E66.0', 'Obesidad debida a exceso de calorías', NULL),
(NULL, NULL, 'Déficit de vitamina D / raquitismo',            'PEDIATRIA', 'E55.0', 'Raquitismo activo', NULL),
(NULL, NULL, 'Anemia por deficiencia de hierro',              'PEDIATRIA', 'D50.9', 'Anemia por deficiencia de hierro, sin otra especificación', NULL),

-- ── Dermatológicas pediátricas ──────────────────────────────────────────────
(NULL, NULL, 'Dermatitis atópica',                            'PEDIATRIA', 'L20.9', 'Dermatitis atópica, sin otra especificación', NULL),
(NULL, NULL, 'Dermatitis del pañal',                          'PEDIATRIA', 'L22',   'Dermatitis del pañal', NULL),
(NULL, NULL, 'Urticaria alérgica',                            'PEDIATRIA', 'L50.0', 'Urticaria alérgica', NULL),
(NULL, NULL, 'Impétigo',                                      'PEDIATRIA', 'L01.0', 'Impétigo [cualquier sitio] [cualquier organismo]', NULL),

-- ── Medicina General ────────────────────────────────────────────────────────
(NULL, NULL, 'Hipertensión arterial esencial',                'MEDICINA_GENERAL', 'I10',   'Hipertensión esencial (primaria)', NULL),
(NULL, NULL, 'Diabetes mellitus tipo 2',                      'MEDICINA_GENERAL', 'E11.9', 'Diabetes mellitus tipo 2, sin complicaciones', NULL),
(NULL, NULL, 'Diabetes mellitus tipo 1',                      'MEDICINA_GENERAL', 'E10.9', 'Diabetes mellitus tipo 1, sin complicaciones', NULL),
(NULL, NULL, 'Infección respiratoria alta (adulto)',           'MEDICINA_GENERAL', 'J06.9', 'Infección aguda de vías respiratorias superiores, no especificada', NULL),
(NULL, NULL, 'Infección de vías urinarias (adulto)',           'MEDICINA_GENERAL', 'N39.0', 'Infección de vías urinarias, sitio no especificado', NULL),
(NULL, NULL, 'Lumbalgia mecánica',                            'MEDICINA_GENERAL', 'M54.5', 'Dolor en la región lumbar baja', NULL),
(NULL, NULL, 'Cefalea tensional (adulto)',                    'MEDICINA_GENERAL', 'G44.2', 'Cefalea tensional', NULL),
(NULL, NULL, 'Gastritis aguda',                               'MEDICINA_GENERAL', 'K29.1', 'Otras gastritis agudas', NULL),
(NULL, NULL, 'Ansiedad generalizada',                         'MEDICINA_GENERAL', 'F41.1', 'Trastorno de ansiedad generalizada', NULL),
(NULL, NULL, 'Depresión leve',                                'MEDICINA_GENERAL', 'F32.0', 'Episodio depresivo leve', NULL),
(NULL, NULL, 'Obesidad (adulto)',                             'MEDICINA_GENERAL', 'E66.0', 'Obesidad debida a exceso de calorías', NULL),

-- ── Cardiología ─────────────────────────────────────────────────────────────
(NULL, NULL, 'Hipertensión arterial con cardiopatía',         'CARDIOLOGIA', 'I11.9', 'Cardiopatía hipertensiva sin insuficiencia cardíaca', NULL),
(NULL, NULL, 'Insuficiencia cardíaca congestiva',             'CARDIOLOGIA', 'I50.0', 'Insuficiencia cardíaca congestiva', NULL),
(NULL, NULL, 'Fibrilación auricular',                         'CARDIOLOGIA', 'I48',   'Fibrilación y aleteo auricular', NULL),
(NULL, NULL, 'Cardiopatía congénita no especificada',         'CARDIOLOGIA', 'Q24.9', 'Malformación congénita del corazón, no especificada', NULL),

-- ── Neurología ──────────────────────────────────────────────────────────────
(NULL, NULL, 'Migraña con aura',                              'NEUROLOGIA', 'G43.1', 'Migraña con aura [migraña clásica]', NULL),
(NULL, NULL, 'Migraña sin aura',                              'NEUROLOGIA', 'G43.0', 'Migraña sin aura [migraña común]', NULL),
(NULL, NULL, 'Accidente cerebrovascular isquémico',           'NEUROLOGIA', 'I63.9', 'Infarto cerebral, no especificado', NULL),
(NULL, NULL, 'Neuropatía periférica',                         'NEUROLOGIA', 'G62.9', 'Polineuropatía, no especificada', NULL),

-- ── Ginecología ─────────────────────────────────────────────────────────────
(NULL, NULL, 'Control prenatal normal',                       'GINECOLOGIA', 'Z34.0', 'Supervisión de embarazo normal, primigesta', NULL),
(NULL, NULL, 'Infección vaginal por Candida',                 'GINECOLOGIA', 'B37.3', 'Candidiasis de la vulva y la vagina', NULL),
(NULL, NULL, 'Dismenorrea primaria',                          'GINECOLOGIA', 'N94.4', 'Dismenorrea primaria', NULL),
(NULL, NULL, 'Síndrome de ovario poliquístico',               'GINECOLOGIA', 'E28.2', 'Síndrome de ovario poliquístico', NULL);
