-- ============================================================
-- Migración 032: Estudios globales – Pediatría
-- Permite clinica_id NULL para registros globales y siembra
-- los estudios más comunes en pediatría
-- ============================================================

-- 1. Permitir clinica_id NULL (registros globales de plataforma)
ALTER TABLE catalogos_estudios
  MODIFY COLUMN clinica_id INT UNSIGNED NULL;

-- 2. Insertar estudios pediátricos globales (clinica_id = NULL)
INSERT IGNORE INTO catalogos_estudios (clinica_id, nombre, categoria, descripcion) VALUES
-- ── LABORATORIO ──────────────────────────────────────────────────────
(NULL, 'Hemograma completo (BHC)',                       'LABORATORIO', 'Serie roja, serie blanca y plaquetas'),
(NULL, 'Velocidad de sedimentación globular (VSG)',      'LABORATORIO', 'Marcador inespecífico de inflamación'),
(NULL, 'Proteína C reactiva (PCR)',                      'LABORATORIO', 'Marcador de infección/inflamación aguda'),
(NULL, 'Procalcitonina',                                  'LABORATORIO', 'Diferenciación infección bacteriana vs viral'),
(NULL, 'Glucosa en ayunas',                              'LABORATORIO', 'Tamizaje de diabetes e hipoglucemia'),
(NULL, 'Hemoglobina glucosilada (HbA1c)',                'LABORATORIO', 'Control metabólico en diabetes'),
(NULL, 'Perfil lipídico completo',                       'LABORATORIO', 'Colesterol total, HDL, LDL, triglicéridos'),
(NULL, 'Función renal (BUN, creatinina)',                'LABORATORIO', 'Urea y creatinina sérica'),
(NULL, 'Función hepática (TGO, TGP, GGT, bilirrubinas)','LABORATORIO', 'Panel hepático completo'),
(NULL, 'Ferritina sérica',                               'LABORATORIO', 'Reservas de hierro, diagnóstico de anemia ferropénica'),
(NULL, 'Hierro sérico y capacidad de fijación (TIBC)',   'LABORATORIO', 'Evaluación del metabolismo del hierro'),
(NULL, 'Vitamina D (25-OH)',                             'LABORATORIO', 'Tamizaje y seguimiento de deficiencia de vitamina D'),
(NULL, 'Vitamina B12',                                   'LABORATORIO', 'Déficit vitamínico en retraso del desarrollo'),
(NULL, 'Hormona estimulante de tiroides (TSH)',          'LABORATORIO', 'Tamizaje de hipotiroidismo'),
(NULL, 'T4 libre',                                       'LABORATORIO', 'Función tiroidea completa junto a TSH'),
(NULL, 'Uroanálisis completo (EGO)',                     'LABORATORIO', 'Examen general de orina con sedimento'),
(NULL, 'Urocultivo',                                     'LABORATORIO', 'Cultivo y antibiograma en IVU'),
(NULL, 'Coprocultivo',                                   'LABORATORIO', 'Cultivo de heces en diarrea infecciosa'),
(NULL, 'Examen coproparasitoscópico (EPS)',              'LABORATORIO', '3 muestras seriadas para parásitos intestinales'),
(NULL, 'Rotavirus en heces (antígeno)',                  'LABORATORIO', 'Diagnóstico rápido de gastroenteritis por rotavirus'),
(NULL, 'Prueba rápida de estreptococo A (RADT)',         'LABORATORIO', 'Detección rápida de Streptococcus pyogenes'),
(NULL, 'Cultivo de exudado faríngeo',                    'LABORATORIO', 'Faringoamigdalitis bacteriana'),
(NULL, 'IgE total sérica',                               'LABORATORIO', 'Tamizaje de atopia y enfermedades alérgicas'),
(NULL, 'Panel de alérgenos inhalantes y alimentarios',   'LABORATORIO', 'IgE específica: ácaros, pólenes, alimentos'),
(NULL, 'ASTO (antiestreptolisina O)',                     'LABORATORIO', 'Infección reciente por Streptococcus grupo A'),
(NULL, 'Serología TORCH (IgG e IgM)',                   'LABORATORIO', 'Toxoplasma, rubéola, CMV, herpes, sífilis'),
(NULL, 'Hemocultivo',                                    'LABORATORIO', 'Bacteriemia o sepsis - mínimo 2 muestras'),
(NULL, 'Gasometría arterial',                            'LABORATORIO', 'Equilibrio ácido-base en insuficiencia respiratoria'),
(NULL, 'Electrólitos séricos (Na, K, Cl)',               'LABORATORIO', 'Trastornos hidroelectrolíticos'),
(NULL, 'Calcio y fósforo sérico',                        'LABORATORIO', 'Raquitismo, hipoparatiroidismo'),
(NULL, 'Ácido úrico',                                    'LABORATORIO', 'Hiperuricemia y síndromes de lisis tumoral'),
(NULL, 'Tiempo de protrombina (TP) y TTPa',             'LABORATORIO', 'Coagulopatías, preoperatorio'),
(NULL, 'Dímero D',                                       'LABORATORIO', 'Sospecha de tromboembolismo'),
(NULL, 'Nivel de plomo en sangre',                       'LABORATORIO', 'Tamizaje de saturnismo en zonas de riesgo'),
(NULL, 'Test del sudor (cloruros)',                      'LABORATORIO', 'Diagnóstico de fibrosis quística'),
-- ── IMAGENOLOGÍA ─────────────────────────────────────────────────────
(NULL, 'Radiografía de tórax AP',                        'IMAGENOLOGIA', 'Neumonía, cardiopatías, cuerpo extraño'),
(NULL, 'Radiografía de tórax lateral',                   'IMAGENOLOGIA', 'Complemento a Rx AP en patología torácica'),
(NULL, 'Radiografía de abdomen simple',                  'IMAGENOLOGIA', 'Obstrucción intestinal, cuerpo extraño, íleo'),
(NULL, 'Ultrasonido abdominal pediátrico',               'IMAGENOLOGIA', 'Dolor abdominal, hepatoesplenomegalia, masas'),
(NULL, 'Ultrasonido renal y vías urinarias',             'IMAGENOLOGIA', 'ITU recurrente, hidronefrosis, malformaciones'),
(NULL, 'Ultrasonido de caderas (Grafico) neonatal',      'IMAGENOLOGIA', 'Displasia del desarrollo de cadera, <6 meses'),
(NULL, 'Ecocardiograma pediátrico',                      'IMAGENOLOGIA', 'Cardiopatías congénitas, soplo, miocarditis'),
(NULL, 'EEG (Electroencefalograma)',                     'IMAGENOLOGIA', 'Epilepsia, crisis febriles complejas'),
(NULL, 'Radiografía de muñeca izquierda (edad ósea)',    'IMAGENOLOGIA', 'Evaluación de talla baja y pubertad precoz'),
(NULL, 'Tomografía de cráneo simple',                    'IMAGENOLOGIA', 'TCE moderado-severo, hemorragia, hidrocefalia'),
(NULL, 'Resonancia magnética de cerebro',                'IMAGENOLOGIA', 'Epilepsia refractaria, retraso del desarrollo, tumores'),
(NULL, 'Gammagrafía renal DMSA',                        'IMAGENOLOGIA', 'Cicatrices renales post-ITU, pielonefritis'),
(NULL, 'Cistouretrograma miccional (CUGM)',             'IMAGENOLOGIA', 'Reflujo vesicoureteral en ITU recurrente'),
-- ── OTRO ─────────────────────────────────────────────────────────────
(NULL, 'Espirometría pediátrica',                        'OTRO',         'Asma, fibrosis quística, bronquiectasias (≥5 años)'),
(NULL, 'Test de provocación bronquial',                  'OTRO',         'Diagnóstico de hiperreactividad bronquial'),
(NULL, 'Audiometría (tonos puros)',                      'OTRO',         'Hipoacusia, otitis media crónica'),
(NULL, 'Potenciales evocados auditivos de tronco (PEAT)','OTRO',         'Hipoacusia neonatal, sospecha de sordera'),
(NULL, 'Fondo de ojo pediátrico',                       'OTRO',         'HTA, diabetes, aumento de PIC, strabismo'),
(NULL, 'Electrocardiograma (ECG) pediátrico',            'OTRO',         'Arritmias, cardiopatías, síncope'),
(NULL, 'Test de inteligencia/desarrollo (Bayley, WISC)', 'OTRO',         'Retraso del desarrollo cognitivo y del lenguaje'),
(NULL, 'Evaluación del lenguaje y habla',                'OTRO',         'Retraso del lenguaje, trastornos del espectro autista'),
(NULL, 'Estudio de polisomnografía pediátrica',          'OTRO',         'Apnea del sueño, ronquido patológico'),
(NULL, 'Densitometría ósea (DXA)',                       'OTRO',         'Osteopenia, fracturas por fragilidad, enf. crónicas');

-- Verificar
SELECT categoria, COUNT(*) AS total
FROM catalogos_estudios
WHERE clinica_id IS NULL
GROUP BY categoria;
