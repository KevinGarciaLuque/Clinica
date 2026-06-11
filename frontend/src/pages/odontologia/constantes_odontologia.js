// ─── Condiciones dentales con colores ─────────────────────────────────────────
export const CONDITIONS = {
  sano:        { fill: '#ffffff', stroke: '#94a3b8', label: 'Sano',           emoji: '✓' },
  caries:      { fill: '#92400e', stroke: '#78350f', label: 'Caries',         emoji: '●' },
  obturacion:  { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Obturación',     emoji: '■' },
  corona:      { fill: '#fbbf24', stroke: '#b45309', label: 'Corona',         emoji: '♦' },
  extraccion:  { fill: '#ef4444', stroke: '#b91c1c', label: 'Extracción',     emoji: '✕' },
  endodoncia:  { fill: '#f97316', stroke: '#c2410c', label: 'Endodoncia',     emoji: '◎' },
  implante:    { fill: '#6b7280', stroke: '#374151', label: 'Implante',       emoji: '⊕' },
  fractura:    { fill: '#8b5cf6', stroke: '#6d28d9', label: 'Fractura',       emoji: '/' },
  puente:      { fill: '#06b6d4', stroke: '#0e7490', label: 'Puente',         emoji: '⌐' },
  sellante:    { fill: '#10b981', stroke: '#047857', label: 'Sellante',       emoji: '◈' },
  mal_posicion:{ fill: '#f0abfc', stroke: '#a21caf', label: 'Malposición',    emoji: '↗' },
};

// ─── Superficies dentales ─────────────────────────────────────────────────────
export const SURFACE_LABEL = {
  v: 'Vestibular / Labial',
  p: 'Palatino / Lingual',
  m: 'Mesial',
  d: 'Distal',
  o: 'Oclusal / Incisal',
};

// ─── Arreglo de dientes FDI (adult) ──────────────────────────────────────────
export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const ALL_TEETH   = [...UPPER_TEETH, ...LOWER_TEETH];

// Clasificación por tipo de diente (para adaptar forma SVG)
export function toothType(num) {
  const n = num % 10;  // FDI: last digit = position in quadrant (1-8)
  if (n <= 2) return 'incisor';
  if (n === 3) return 'canine';
  if (n <= 5) return 'premolar';
  return 'molar';
}

// ─── Procedimientos frecuentes ────────────────────────────────────────────────
export const PROCEDIMIENTOS = [
  { grupo: 'Preventivo', items: [
    'Profilaxis dental',
    'Aplicación de flúor',
    'Sellante de fosetas y fisuras',
    'Instrucción de higiene oral',
    'Detartraje supragingival',
    'Detartraje subgingival / RAR',
  ]},
  { grupo: 'Restaurativo', items: [
    'Obturación resina compuesta',
    'Obturación amálgama',
    'Incrustación (inlay/onlay)',
    'Corona metal-porcelana',
    'Corona total porcelana',
    'Corona metal',
    'Carilla de porcelana',
  ]},
  { grupo: 'Endodoncia', items: [
    'Pulpotomía',
    'Pulpectomía',
    'Tratamiento de conductos (1 conducto)',
    'Tratamiento de conductos (2 conductos)',
    'Tratamiento de conductos (3+ conductos)',
    'Retratamiento endodóntico',
  ]},
  { grupo: 'Cirugía', items: [
    'Extracción simple',
    'Extracción quirúrgica',
    'Extracción de tercer molar',
    'Alveoloplastia',
    'Frenectomía',
    'Biopsia de tejido blando',
  ]},
  { grupo: 'Prótesis', items: [
    'Prótesis parcial removible',
    'Prótesis total',
    'Puente fijo',
    'Implante oseointegrado',
    'Corona sobre implante',
    'Sobredentadura',
  ]},
  { grupo: 'Ortodoncia', items: [
    'Brackets metálicos',
    'Brackets estéticos',
    'Alineadores transparentes',
    'Retención fija',
    'Retención removible',
    'Expansor palatino',
  ]},
  { grupo: 'Periodoncia', items: [
    'Curetaje subgingival',
    'Cirugía periodontal',
    'Injerto gingival',
    'Alargamiento de corona clínica',
    'Aplicación de antibiótico local',
  ]},
];

// ─── CIE-10 odontológicos frecuentes ─────────────────────────────────────────
export const DX_RAPIDOS = [
  { grupo: 'Caries', color: '#92400e', items: [
    { c: 'K02.0', d: 'Caries limitada al esmalte' },
    { c: 'K02.1', d: 'Caries de la dentina' },
    { c: 'K02.2', d: 'Caries del cemento' },
    { c: 'K02.3', d: 'Caries dentaria detenida' },
    { c: 'K02.4', d: 'Odontoclasia' },
    { c: 'K02.8', d: 'Otras caries dentales' },
  ]},
  { grupo: 'Pulpa y periápice', color: '#f97316', items: [
    { c: 'K04.0', d: 'Pulpitis' },
    { c: 'K04.1', d: 'Necrosis de la pulpa' },
    { c: 'K04.4', d: 'Periodontitis apical aguda' },
    { c: 'K04.5', d: 'Periodontitis apical crónica' },
    { c: 'K04.6', d: 'Absceso periapical con fístula' },
    { c: 'K04.7', d: 'Absceso periapical sin fístula' },
  ]},
  { grupo: 'Encías y periodonto', color: '#16a34a', items: [
    { c: 'K05.0', d: 'Gingivitis aguda' },
    { c: 'K05.1', d: 'Gingivitis crónica' },
    { c: 'K05.2', d: 'Periodontitis aguda' },
    { c: 'K05.3', d: 'Periodontitis crónica' },
    { c: 'K05.4', d: 'Periodontosis' },
  ]},
  { grupo: 'Tejidos duros', color: '#0284c7', items: [
    { c: 'K03.0', d: 'Desgaste excesivo de dientes (atrición)' },
    { c: 'K03.1', d: 'Abrasión de dientes' },
    { c: 'K03.2', d: 'Erosión de dientes' },
    { c: 'K03.3', d: 'Reabsorción patológica de dientes' },
    { c: 'K08.1', d: 'Pérdida de dientes por accidente / extracción' },
  ]},
  { grupo: 'Desarrollo y erupción', color: '#7c3aed', items: [
    { c: 'K00.0', d: 'Anodoncia' },
    { c: 'K00.1', d: 'Dientes supernumerarios' },
    { c: 'K00.6', d: 'Dientes natales y neonatales' },
    { c: 'K01.0', d: 'Diente incluido' },
    { c: 'K01.1', d: 'Diente impactado' },
    { c: 'K07.2', d: 'Maloclusión dentaria' },
  ]},
  { grupo: 'Tejidos blandos', color: '#dc2626', items: [
    { c: 'K12.0', d: 'Aftas orales recurrentes' },
    { c: 'K12.1', d: 'Otras estomatitis' },
    { c: 'K13.0', d: 'Enfermedades de los labios' },
    { c: 'K13.2', d: 'Leucoplasia y otras lesiones del epitelio bucal' },
  ]},
];

// ─── Materiales frecuentes ────────────────────────────────────────────────────
export const MATERIALES = [
  'Resina compuesta A1', 'Resina compuesta A2', 'Resina compuesta A3',
  'Resina compuesta B1', 'Resina compuesta cervical',
  'Amálgama', 'IRM', 'Cavit',
  'MTA', 'Biodentine',
  'Cemento de ionómero de vidrio',
  'Zirconia', 'Disilicato de litio (e.max)',
  'Metal colado', 'Metal-porcelana',
  'Gutapercha', 'Sellador AH Plus', 'Sellador Endofill',
  'Titanio (implante)',
];
