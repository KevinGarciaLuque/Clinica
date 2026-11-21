/**
 * Escalas de cuidados paliativos (módulo "Escalas" dentro de la consulta).
 *
 * Todo está definido como datos: cada escala dice cuáles son sus ítems, cómo se puntúa y qué
 * franja de color le corresponde a cada puntaje. Una sola pantalla (EscalasPaliativosTab) las dibuja
 * todas. Para corregir o agregar una escala basta tocar este archivo.
 *
 * Fuente: "Escalas utilizadas en cuidados paliativos" (guía ilustrada). Los puntos de corte
 * pueden variar según la población y la versión validada; las escalas no sustituyen el juicio clínico.
 *
 * Tipos de escala:
 *  - "items"  : varios ítems que se puntúan y suman/promedian (ESAS, HADS, Zarit…)
 *  - "nivel"  : se elige un solo nivel (PPS, ECOG, Ramsay…)
 *  - "guia"   : guía de entrevista sin puntaje (FICA, HOPE)
 *
 * Tipos de ítem:  r:[min,max] botones numéricos · op:[[valor,"texto"],…] opciones ·
 *                 sino:puntos botones Sí/No · num:[min,max] número escrito · txt texto libre
 */

// ── Colores (los mismos de las ilustraciones de la guía) ───────────────────────
export const COLORES = {
  verde: "#43A047", verdeClaro: "#9CCC65", amarillo: "#FDD835", naranja: "#FB8C00", rojo: "#E53935",
  azulClaro: "#4FC3F7", azul: "#1E88E5", azulOscuro: "#0D47A1", gris: "#9E9E9E", morado: "#7E57C2",
};
const CLAROS = new Set([COLORES.amarillo, COLORES.verdeClaro, COLORES.azulClaro]);
/** Color de letra legible sobre un fondo de color */
export const textoSobre = (hex) => (CLAROS.has(hex) ? "#212121" : "#ffffff");
const hex = (c) => COLORES[c] || c;

const PARADAS = [COLORES.verde, COLORES.verdeClaro, COLORES.amarillo, COLORES.naranja, COLORES.rojo].map((h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
]);
/** Mapa de calor: 0 = lo mejor (verde) … 1 = lo peor (rojo) */
export function colorCalor(f) {
  const x = Math.max(0, Math.min(1, Number.isFinite(f) ? f : 0)) * (PARADAS.length - 1);
  const i = Math.min(Math.floor(x), PARADAS.length - 2), t = x - i;
  const c = PARADAS[i].map((v, k) => Math.round(v + (PARADAS[i + 1][k] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const GRUPOS = [
  { id: "sintomas", nombre: "Síntomas", icono: "bi-clipboard2-pulse" },
  { id: "dolor", nombre: "Dolor", icono: "bi-lightning-charge" },
  { id: "disnea", nombre: "Disnea", icono: "bi-lungs" },
  { id: "funcional", nombre: "Estado funcional", icono: "bi-person-walking" },
  { id: "pronostico", nombre: "Pronóstico", icono: "bi-graph-down" },
  { id: "cognicion", nombre: "Cognición y delirium", icono: "bi-brain" },
  { id: "emocional", nombre: "Emocional y espiritual", icono: "bi-heart" },
  { id: "familia", nombre: "Familia y duelo", icono: "bi-people" },
  { id: "calidad", nombre: "Calidad de vida", icono: "bi-emoji-smile" },
  { id: "sedacion", nombre: "Sedación", icono: "bi-moon-stars" },
  { id: "pediatria", nombre: "Pediatría", icono: "bi-balloon-heart" },
];

// ── Constructores cortos ───────────────────────────────────────────────────────
const R = (id, t, min, max, o = {}) => ({ id, t, r: [min, max], ...o });
const S = (id, t, pts = 1, o = {}) => ({ id, t, sino: pts, ...o });
const O = (id, t, op, o = {}) => ({ id, t, op, ...o });
const N = (id, t, min, max, o = {}) => ({ id, t, num: [min, max], ...o });
const B = (lista) => lista.map(([hasta, t, c]) => ({ hasta, t, c: hex(c) }));

// Bandas de intensidad por ítem (0–10) para ESAS: ≥4 moderado, ≥7 grave
const BI_ESAS = B([[3, "Leve", "verde"], [6, "Moderado", "amarillo"], [10, "Grave", "rojo"]]);

const LAB_IPOS = ["Nada", "Ligero", "Moderado", "Grave", "Abrumador"];
const LAB_FREC = ["Nunca", "Varios días", "Más de la mitad de los días", "Casi todos los días"];

// ── Definiciones ───────────────────────────────────────────────────────────────
export const ESCALAS = [
  // ═══ 1. SÍNTOMAS ═══
  {
    id: "esas", grupo: "sintomas", nombre: "ESAS", sub: "Edmonton Symptom Assessment System", rapida: true,
    desc: "El paciente marca la intensidad de 9 síntomas (0 = ausente, 10 = el peor imaginable) más uno libre.",
    ref: "Bruera et al., 1991", tipo: "items", bi: BI_ESAS,
    items: [
      R("dolor", "Dolor", 0, 10, { h: "Intensidad del dolor" }),
      R("cansancio", "Cansancio", 0, 10, { h: "Falta de energía o fatiga" }),
      R("nauseas", "Náuseas", 0, 10, { h: "Ganas de vomitar" }),
      R("depresion", "Depresión", 0, 10, { h: "Sentirse triste o deprimido" }),
      R("ansiedad", "Ansiedad", 0, 10, { h: "Sentirse nervioso o inquieto" }),
      R("somnolencia", "Somnolencia", 0, 10, { h: "Sentirse adormilado" }),
      R("apetito", "Falta de apetito", 0, 10, { h: "Disminución de las ganas de comer" }),
      R("bienestar", "Bienestar", 0, 10, { h: "Cómo se siente en general (0 = mejor, 10 = peor)" }),
      R("aire", "Falta de aire", 0, 10, { h: "Dificultad para respirar" }),
      R("otro", "Otro problema", 0, 10, { h: "Síntoma libre elegido por el paciente (ej. estreñimiento)", txt: true, noSuma: true }),
    ],
    total: { modo: "suma", max: 90, t: "Índice global (9 síntomas)" },
    nota: "Cada síntoma va de 0 a 10; el total de los nueve síntomas da 0 a 90. No hay un corte universal: se usa ≥4 para intensidad moderada y ≥7 para grave.",
  },
  {
    id: "esasr", grupo: "sintomas", nombre: "ESAS-r", sub: "Versión revisada", desc: "Con definiciones de cada síntoma, orden modificado y marco temporal «ahora».",
    ref: "Watanabe et al., 2011", tipo: "items", bi: BI_ESAS,
    items: [
      R("dolor", "Dolor", 0, 10), R("cansancio", "Cansancio", 0, 10, { h: "Falta de energía" }),
      R("somnolencia", "Somnolencia", 0, 10, { h: "Sentirse adormilado" }), R("nauseas", "Náuseas", 0, 10),
      R("apetito", "Falta de apetito", 0, 10), R("aire", "Falta de aire", 0, 10),
      R("depresion", "Depresión", 0, 10, { h: "Sentirse triste" }), R("ansiedad", "Ansiedad", 0, 10, { h: "Sentirse nervioso" }),
      R("bienestar", "Bienestar", 0, 10, { h: "Cómo se siente en general (0 = mejor, 10 = peor)" }),
      R("otro", "Otro problema", 0, 10, { txt: true, noSuma: true }),
    ],
    total: { modo: "suma", max: 90, t: "Índice global" },
    nota: "Se interpreta igual que la ESAS: 0 a 10 por síntoma y total de 0 a 90.",
  },
  {
    id: "msas", grupo: "sintomas", nombre: "MSAS", sub: "Memorial Symptom Assessment Scale",
    desc: "Cuestionario de 32 síntomas. Aquí se anotan las subescalas ya calculadas (promedio de 0 a 4).",
    ref: "Portenoy et al., 1994", tipo: "items",
    items: [
      N("phys", "Subescala física (PHYS)", 0, 4, { dec: 2, h: "Promedio de los ítems físicos" }),
      N("psych", "Subescala psicológica (PSYCH)", 0, 4, { dec: 2, h: "Promedio de los ítems psicológicos" }),
      N("gdi", "Índice global de malestar (GDI)", 0, 4, { dec: 2, h: "Promedio de los ítems incluidos" }),
    ],
    total: null,
    nota: "Una puntuación mayor en cada subescala indica mayor carga de síntomas.",
  },
  {
    id: "ipos", grupo: "sintomas", nombre: "IPOS", sub: "Integrated Palliative care Outcome Scale",
    desc: "Resultados centrados en el paciente. 17 ítems de 0 (ninguno) a 4 (abrumador).",
    ref: "Murtagh et al., 2019", tipo: "items", lab: LAB_IPOS,
    items: [
      { id: "problemas", t: "Principales problemas", h: "Hasta tres problemas importantes, en texto libre", txt: true, soloTxt: true },
      ...[["dolor", "Dolor"], ["aire", "Falta de aire"], ["debilidad", "Debilidad o falta de energía"], ["nauseas", "Náuseas"], ["vomitos", "Vómitos"],
        ["apetito", "Falta de apetito"], ["estrenimiento", "Estreñimiento"], ["boca", "Boca seca o dolorosa"], ["somnolencia", "Somnolencia"], ["movilidad", "Movilidad reducida"]]
        .map(([id, t]) => R(id, t, 0, 4, { g: "Síntomas físicos" })),
      R("ansiedad", "Ansiedad del paciente", 0, 4, { g: "Estado emocional" }),
      R("fam_ansiedad", "Preocupación de la familia", 0, 4, { g: "Estado emocional" }),
      R("depresion", "Depresión", 0, 4, { g: "Estado emocional" }),
      R("paz", "Sentirse en paz", 0, 4, { g: "Estado emocional", h: "0 = siempre en paz · 4 = nunca" }),
      R("sentimientos", "Compartir sentimientos", 0, 4, { g: "Comunicación y práctica", h: "0 = siempre · 4 = nunca" }),
      R("informacion", "Recibir la información que desea", 0, 4, { g: "Comunicación y práctica", h: "0 = toda · 4 = nada" }),
      R("practicos", "Problemas prácticos", 0, 4, { g: "Comunicación y práctica", h: "0 = resueltos · 4 = sin resolver" }),
    ],
    total: { modo: "suma", max: 68, t: "Total (17 ítems)" },
    nota: "Los 17 ítems cerrados suman de 0 a 68; mayor puntuación indica mayor carga de síntomas y problemas.",
  },
  {
    id: "pos", grupo: "sintomas", nombre: "POS", sub: "Palliative care Outcome Scale",
    desc: "Diez ítems físicos, emocionales, espirituales y de información de los últimos tres días.",
    ref: "Hearn y Higginson, 1999", tipo: "items",
    items: [
      R("dolor", "Dolor", 0, 4, { h: "Efecto del dolor en la persona" }), R("otros", "Otros síntomas", 0, 4, { h: "Efecto de otros síntomas" }),
      R("ans_pac", "Ansiedad del paciente", 0, 4, { h: "Preocupación por la enfermedad o el tratamiento" }),
      R("ans_fam", "Ansiedad de la familia", 0, 4, { h: "Preocupación de los allegados" }),
      R("info", "Información", 0, 4, { h: "Información recibida sobre la situación" }), R("apoyo", "Apoyo", 0, 4, { h: "Sentirse apoyado por familia y amigos" }),
      R("vida", "Vida valiosa", 0, 4, { h: "Sentir que la vida vale la pena" }), R("autoestima", "Autoestima", 0, 4, { h: "Sentirse bien consigo mismo" }),
      R("tiempo", "Tiempo perdido", 0, 4, { h: "Tiempo desperdiciado en la atención sanitaria" }),
      R("practicos", "Asuntos prácticos", 0, 4, { h: "Resolución de asuntos prácticos pendientes" }),
    ],
    total: { modo: "suma", max: 40 },
    nota: "El total va de 0 a 40; a menor puntuación, mejor situación del paciente.",
  },

  // ═══ 2. DOLOR ═══
  {
    id: "eva", grupo: "dolor", nombre: "EVA", sub: "Escala visual analógica", rapida: true,
    desc: "Línea de 10 cm: el paciente marca su dolor. Se anota la distancia en milímetros desde «sin dolor».",
    ref: "Huskisson, 1974", tipo: "items",
    items: [{ id: "mm", t: "Dolor", h: "0 mm = sin dolor · 100 mm = el peor dolor imaginable", desliz: [0, 100], unidad: "mm" }],
    total: { modo: "suma", max: 100, t: "Dolor (mm)" },
    bandas: B([[0, "Sin dolor", "verde"], [39, "Dolor leve", "verdeClaro"], [69, "Dolor moderado", "naranja"], [100, "Dolor intenso", "rojo"]]),
    nota: "Por convención clínica: 1 a 3 leve, 4 a 6 moderado y 7 a 10 intenso.",
  },
  {
    id: "bpi", grupo: "dolor", nombre: "BPI", sub: "Brief Pain Inventory", desc: "Intensidad, alivio e interferencia del dolor en la última semana.",
    ref: "Cleeland y Ryan, 1994", tipo: "items",
    items: [
      R("max", "Dolor más intenso", 0, 10, { g: "Intensidad", s: "int" }), R("min", "Dolor menos intenso", 0, 10, { g: "Intensidad", s: "int" }),
      R("prom", "Dolor promedio", 0, 10, { g: "Intensidad", s: "int" }), R("actual", "Dolor actual", 0, 10, { g: "Intensidad", s: "int" }),
      N("alivio", "Alivio con el tratamiento", 0, 100, { g: "Alivio", noSuma: true, unidad: "%", mejorAlto: true }),
      ...[["actividad", "Actividad general"], ["animo", "Estado de ánimo"], ["caminar", "Capacidad para caminar"], ["trabajo", "Trabajo habitual"],
        ["relaciones", "Relaciones con otras personas"], ["sueno", "Sueño"], ["disfrute", "Disfrute de la vida"]]
        .map(([id, t]) => R(id, t, 0, 10, { g: "Interferencia", s: "inter" })),
      { id: "zonas", t: "Localización", h: "Zonas dolorosas (anotar)", txt: true, soloTxt: true },
    ],
    subs: [{ id: "int", t: "Intensidad (promedio)", modo: "promedio", max: 10 }, { id: "inter", t: "Interferencia (promedio)", modo: "promedio", max: 10 }],
    total: null,
    nota: "Se calcula la media de los cuatro ítems de intensidad y la de los siete de interferencia; mayor valor indica mayor gravedad.",
  },
  {
    id: "dn4", grupo: "dolor", nombre: "DN4", sub: "Dolor neuropático (cribado)", desc: "Entrevista y exploración: un punto por cada respuesta afirmativa.",
    ref: "Bouhassira et al., 2005", tipo: "items",
    items: [
      S("e1", "¿Quemazón?", 1, { g: "Entrevista: ¿el dolor tiene alguna de estas características?" }), S("e2", "¿Sensación de frío doloroso?", 1, { g: "Entrevista: ¿el dolor tiene alguna de estas características?" }),
      S("e3", "¿Descargas eléctricas?", 1, { g: "Entrevista: ¿el dolor tiene alguna de estas características?" }),
      S("e4", "Hormigueo", 1, { g: "Entrevista: ¿se acompaña de…?" }), S("e5", "Pinchazos", 1, { g: "Entrevista: ¿se acompaña de…?" }),
      S("e6", "Entumecimiento", 1, { g: "Entrevista: ¿se acompaña de…?" }), S("e7", "Picazón", 1, { g: "Entrevista: ¿se acompaña de…?" }),
      S("x1", "Hipoestesia al tacto en la zona dolorosa", 1, { g: "Exploración" }), S("x2", "Hipoestesia al pinchazo", 1, { g: "Exploración" }),
      S("x3", "El roce con un cepillo provoca o aumenta el dolor", 1, { g: "Exploración" }),
    ],
    total: { modo: "suma", max: 10 }, bandas: B([[3, "Probable dolor nociceptivo", "verde"], [10, "Sugiere dolor neuropático", "rojo"]]),
    nota: "Total de 0 a 10; 4 o más sugiere dolor neuropático.",
  },
  {
    id: "lanss", grupo: "dolor", nombre: "LANSS", sub: "Síntomas y signos neuropáticos", desc: "Cinco preguntas y dos pruebas de exploración con ítems de peso distinto.",
    ref: "Bennett, 2001", tipo: "items",
    items: [
      S("s1", "S1 Sensaciones desagradables", 5, { h: "Hormigueo, pinchazos o agujas" }), S("s2", "S2 Aspecto de la piel", 5, { h: "Manchada o enrojecida en la zona dolorosa" }),
      S("s3", "S3 Hipersensibilidad", 3, { h: "Dolor al roce de la ropa o a un tacto leve" }), S("s4", "S4 Descargas", 2, { h: "Ataques súbitos de dolor tipo descarga eléctrica" }),
      S("s5", "S5 Quemazón", 1, { h: "Sensación de piel caliente o quemante" }), S("e1", "E1 Alodinia", 5, { h: "Dolor al frotar suavemente frente a la zona sana" }),
      S("e2", "E2 Umbral al pinchazo", 3, { h: "Respuesta alterada al pinchazo respecto a la zona sana" }),
    ],
    total: { modo: "suma", max: 24 }, bandas: B([[11, "Probable dolor nociceptivo", "verde"], [24, "Sugiere dolor neuropático", "rojo"]]),
    nota: "Máximo 24 puntos; 12 o más sugiere dolor neuropático.",
  },
  {
    id: "painad", grupo: "dolor", nombre: "PAINAD", sub: "Demencia avanzada (observacional)", desc: "Cinco indicadores observados en quien no puede referir su dolor.",
    ref: "Warden et al., 2003", tipo: "items",
    items: [
      O("resp", "Respiración", [[0, "Normal"], [1, "Ocasionalmente dificultosa, hiperventilación breve"], [2, "Dificultosa y ruidosa, hiperventilación prolongada o Cheyne-Stokes"]]),
      O("voc", "Vocalización negativa", [[0, "Ninguna"], [1, "Gemidos o quejidos ocasionales, habla baja con tono negativo"], [2, "Llamadas o quejidos repetitivos, llanto"]]),
      O("cara", "Expresión facial", [[0, "Sonriente o inexpresiva"], [1, "Triste, asustada, ceño fruncido"], [2, "Muecas"]]),
      O("cuerpo", "Lenguaje corporal", [[0, "Relajado"], [1, "Tenso, inquieto, camina de un lado a otro"], [2, "Rígido, puños cerrados, rodillas flexionadas, agresivo"]]),
      O("consuelo", "Capacidad de consuelo", [[0, "No necesita consuelo"], [1, "Se distrae o tranquiliza con la voz o el tacto"], [2, "Imposible consolar o distraer"]]),
    ],
    total: { modo: "suma", max: 10 }, bandas: B([[0, "Sin dolor", "verde"], [3, "Leve", "verdeClaro"], [6, "Moderado", "naranja"], [10, "Intenso", "rojo"]]),
    nota: "Cada indicador de 0 a 2; total de 0 a 10 (1 a 3 leve, 4 a 6 moderado, 7 a 10 intenso).",
  },
  {
    id: "abbey", grupo: "dolor", nombre: "Abbey", sub: "Demencia en fase final (observacional)", desc: "Seis indicadores observables, de 0 (ausente) a 3 (grave).",
    ref: "Abbey et al., 2004", tipo: "items", lab: ["Ausente", "Leve", "Moderado", "Grave"],
    items: [
      R("voc", "Vocalización", 0, 3, { h: "Gimoteo, quejido, llanto" }), R("cara", "Expresión facial", 0, 3, { h: "Cara tensa, ceño fruncido, muecas, aspecto asustado" }),
      R("cuerpo", "Cambio en el lenguaje corporal", 0, 3, { h: "Inquietud, balanceo, protección de una parte del cuerpo, retraimiento" }),
      R("conducta", "Cambio conductual", 0, 3, { h: "Mayor confusión, rechazo de comida, cambio de hábitos" }),
      R("fisio", "Cambio fisiológico", 0, 3, { h: "Temperatura, pulso o tensión anormales, sudoración, rubor o palidez" }),
      R("fisicos", "Cambios físicos", 0, 3, { h: "Lesiones cutáneas, úlceras por presión, artritis, contracturas" }),
    ],
    total: { modo: "suma", max: 18 }, bandas: B([[2, "Sin dolor", "verde"], [7, "Leve", "verdeClaro"], [13, "Moderado", "naranja"], [18, "Intenso", "rojo"]]),
    nota: "Total de 0 a 18: 0 a 2 sin dolor, 3 a 7 leve, 8 a 13 moderado y 14 o más intenso.",
  },
  {
    id: "doloplus", grupo: "dolor", nombre: "Doloplus-2", sub: "Mayores con deterioro de la comunicación", desc: "Diez ítems observacionales en tres dimensiones, de 0 a 3 cada uno.",
    ref: "Lefebvre-Chapiro, 2001", tipo: "items",
    items: [
      ...[["q", "Queja somática"], ["pos", "Posiciones antiálgicas en reposo"], ["prot", "Protección de zonas dolorosas"], ["mim", "Mímica"], ["sue", "Sueño"]].map(([id, t]) => R(id, t, 0, 3, { g: "Somática" })),
      ...[["aseo", "Aseo y/o vestido"], ["mov", "Movimientos (cambios de posición, transferencias, desplazamientos)"]].map(([id, t]) => R(id, t, 0, 3, { g: "Psicomotora" })),
      ...[["com", "Comunicación"], ["soc", "Vida social"], ["comp", "Trastornos del comportamiento"]].map(([id, t]) => R(id, t, 0, 3, { g: "Psicosocial" })),
    ],
    total: { modo: "suma", max: 30 }, bandas: B([[4, "Sin dolor probable", "verde"], [30, "Sugiere dolor", "rojo"]]),
    nota: "Total de 0 a 30; 5 o más sugiere dolor.",
  },

  // ═══ 3. DISNEA ═══
  {
    id: "borg", grupo: "disnea", nombre: "Borg modificada", sub: "Intensidad de la disnea", rapida: true,
    desc: "El paciente señala la intensidad de su falta de aire. Sirve para seguir la evolución en cada paciente.",
    ref: "Borg, 1982", tipo: "nivel", mejorAlto: false,
    niveles: [
      [0, "Nada", "Sin disnea"], [0.5, "Muy muy leve", "Disnea mínima"], [1, "Muy leve", "Disnea mínima"], [2, "Leve", "Disnea tolerable"], [3, "Moderada", "Disnea tolerable"],
      [4, "Algo intensa", "Disnea que limita la actividad"], [5, "Intensa", "Disnea que limita la actividad"], [6, "", "Entre intensa y muy intensa"], [7, "Muy intensa", "Disnea grave"],
      [8, "", "Disnea grave"], [9, "Muy muy intensa", "Disnea grave"], [10, "Máxima", "La mayor disnea imaginable"],
    ],
    nota: "No hay puntos de corte fijos; se usa para seguir la evolución de cada paciente.",
  },
  {
    id: "mmrc", grupo: "disnea", nombre: "mMRC", sub: "Medical Research Council modificada", desc: "Cinco grados según la actividad que provoca la disnea.",
    ref: "Bestall et al., 1999", tipo: "nivel",
    niveles: [
      [0, "Disnea solo con ejercicio intenso", "Sin limitación"], [1, "Disnea al caminar rápido en llano o al subir una pendiente leve", "Limitación leve"],
      [2, "Camina más despacio que personas de su edad o debe detenerse al propio paso", "Limitación moderada"], [3, "Se detiene tras unos 100 m o pocos minutos en llano", "Limitación grave"],
      [4, "Demasiada disnea para salir de casa o al vestirse", "Limitación muy grave"],
    ],
    nota: "A mayor grado, mayor limitación funcional por la disnea.",
  },

  // ═══ 4. ESTADO FUNCIONAL ═══
  {
    id: "pps", grupo: "funcional", nombre: "PPS", sub: "Palliative Performance Scale", rapida: true, mejorAlto: true,
    desc: "Se asigna el nivel que mejor coincide, dando prioridad a las columnas de la izquierda (deambulación, actividad, autocuidado, ingesta, conciencia).",
    ref: "Anderson et al., 1996", tipo: "nivel",
    niveles: [
      [100, "Deambulación completa · Actividad normal, sin evidencia de enfermedad", "Autocuidado completo · Ingesta normal · Conciencia plena"],
      [90, "Deambulación completa · Actividad normal, alguna evidencia de enfermedad", "Autocuidado completo · Ingesta normal · Conciencia plena"],
      [80, "Deambulación completa · Actividad normal con esfuerzo, alguna evidencia de enfermedad", "Autocuidado completo · Ingesta normal o reducida · Conciencia plena"],
      [70, "Deambulación reducida · Incapaz de actividad normal o trabajo, enfermedad significativa", "Autocuidado completo · Ingesta normal o reducida · Conciencia plena"],
      [60, "Deambulación reducida · Incapaz de hobbies o trabajo doméstico, enfermedad significativa", "Asistencia ocasional · Ingesta normal o reducida · Conciencia plena o confusión"],
      [50, "Principalmente sentado o acostado · Incapaz de cualquier trabajo, enfermedad extensa", "Asistencia considerable · Ingesta normal o reducida · Conciencia plena o confusión"],
      [40, "Principalmente en cama · Incapaz de la mayoría de actividades, enfermedad extensa", "Asistencia casi completa · Ingesta normal o reducida · Conciencia plena, somnolencia o confusión"],
      [30, "Totalmente encamado · Incapaz de cualquier actividad, enfermedad extensa", "Cuidado total · Ingesta normal o reducida · Conciencia plena, somnolencia o confusión"],
      [20, "Totalmente encamado · Incapaz de cualquier actividad, enfermedad extensa", "Cuidado total · Ingesta: sorbos · Conciencia plena, somnolencia o confusión"],
      [10, "Totalmente encamado · Incapaz de cualquier actividad, enfermedad extensa", "Cuidado total · Solo cuidados de boca · Somnolencia o coma"],
    ],
    nota: "Cuanto menor es el porcentaje, peor es el estado funcional y menor la supervivencia esperada.",
  },
  {
    id: "karnofsky", grupo: "funcional", nombre: "Karnofsky", sub: "Índice de Karnofsky", mejorAlto: true, desc: "Once niveles según la capacidad de actividad normal y la necesidad de asistencia.",
    ref: "Karnofsky y Burchenal, 1949", tipo: "nivel",
    niveles: [
      [100, "Normal, sin quejas ni evidencia de enfermedad", "Actividad normal"], [90, "Capaz de actividad normal, signos o síntomas menores", "Actividad normal"],
      [80, "Actividad normal con esfuerzo, algunos signos o síntomas", "Actividad normal"], [70, "Se cuida a sí mismo, incapaz de actividad normal o trabajo activo", "Incapaz de trabajar"],
      [60, "Requiere asistencia ocasional, se cuida de la mayoría de sus necesidades", "Incapaz de trabajar"], [50, "Requiere asistencia considerable y atención médica frecuente", "Incapaz de trabajar"],
      [40, "Incapacitado, requiere cuidados y asistencia especiales", "Incapaz de cuidarse"], [30, "Gravemente incapacitado, hospitalización indicada aunque la muerte no es inminente", "Incapaz de cuidarse"],
      [20, "Muy enfermo, hospitalización necesaria, tratamiento de soporte activo", "Incapaz de cuidarse"], [10, "Moribundo, procesos fatales progresando rápidamente", "Incapaz de cuidarse"],
    ],
    nota: "A menor puntuación, peor estado funcional.",
  },
  {
    id: "ecog", grupo: "funcional", nombre: "ECOG", sub: "Eastern Cooperative Oncology Group", desc: "Grados según la capacidad de autocuidado y el tiempo en cama o sentado.",
    ref: "Oken et al., 1982", tipo: "nivel",
    niveles: [
      [0, "Asintomático, actividad plena", "Normal"], [1, "Síntomas leves, ambulatorio, puede hacer trabajo ligero", "Restricción leve"],
      [2, "Ambulatorio y capaz de autocuidado, no puede trabajar, en cama o sentado menos del 50 % del día", "Capaz de autocuidado"],
      [3, "Autocuidado limitado, en cama o sentado más del 50 % del día", "Autocuidado limitado"], [4, "Incapacitado, totalmente en cama o sillón", "Dependiente"],
    ],
    nota: "A mayor grado, peor estado funcional.",
  },
  {
    id: "barthel", grupo: "funcional", nombre: "Barthel", sub: "Actividades básicas de la vida diaria", mejorAlto: true,
    desc: "Se marca el nivel de ayuda que necesita el paciente en cada actividad.",
    ref: "Mahoney y Barthel, 1965", tipo: "items",
    items: [
      O("comer", "Comer", [[0, "Dependiente"], [5, "Necesita ayuda"], [10, "Independiente"]]), O("banio", "Lavarse (baño)", [[0, "Dependiente"], [5, "Independiente"]]),
      O("vestir", "Vestirse", [[0, "Dependiente"], [5, "Necesita ayuda"], [10, "Independiente"]]), O("aseo", "Arreglarse (aseo personal)", [[0, "Dependiente"], [5, "Independiente"]]),
      O("deposicion", "Deposición", [[0, "Incontinente"], [5, "Accidente ocasional"], [10, "Continente"]]), O("miccion", "Micción", [[0, "Incontinente"], [5, "Accidente ocasional"], [10, "Continente"]]),
      O("retrete", "Uso del retrete", [[0, "Dependiente"], [5, "Necesita ayuda"], [10, "Independiente"]]),
      O("traslado", "Traslado cama-sillón", [[0, "Incapaz"], [5, "Gran ayuda"], [10, "Mínima ayuda"], [15, "Independiente"]]),
      O("deambula", "Deambulación", [[0, "Inmóvil"], [5, "Silla de ruedas"], [10, "Con ayuda"], [15, "Independiente"]]), O("escalones", "Escalones", [[0, "Incapaz"], [5, "Necesita ayuda"], [10, "Independiente"]]),
    ],
    total: { modo: "suma", max: 100 }, bandas: B([[19, "Dependencia total", "rojo"], [35, "Dependencia grave", "naranja"], [55, "Dependencia moderada", "amarillo"], [99, "Dependencia leve", "verdeClaro"], [100, "Independiente", "verde"]]),
    nota: "Total de 0 a 100: menos de 20 dependencia total, 20 a 35 grave, 40 a 55 moderada, 60 o más leve y 100 independiente.",
  },
  {
    id: "katz", grupo: "funcional", nombre: "Katz", sub: "Índice de Katz", mejorAlto: true, desc: "Seis funciones: independiente (1) o dependiente (0).",
    ref: "Katz et al., 1963", tipo: "items", calc: "katz",
    items: [
      S("banio", "Baño", 1, { h: "Independiente: se baña solo o necesita ayuda en una sola parte del cuerpo", sl: ["Independiente", "Dependiente"] }),
      S("vestido", "Vestido", 1, { h: "Independiente: se viste sin ayuda, salvo para atarse los zapatos", sl: ["Independiente", "Dependiente"] }),
      S("retrete", "Uso del retrete", 1, { h: "Independiente: va, se limpia y se arregla la ropa sin ayuda", sl: ["Independiente", "Dependiente"] }),
      S("movilidad", "Movilidad", 1, { h: "Independiente: se levanta y acuesta de la cama y del sillón sin ayuda", sl: ["Independiente", "Dependiente"] }),
      S("continencia", "Continencia", 1, { h: "Independiente: control completo de micción y deposición", sl: ["Independiente", "Dependiente"] }),
      S("alimentacion", "Alimentación", 1, { h: "Independiente: come sin ayuda", sl: ["Independiente", "Dependiente"] }),
    ],
    total: { modo: "suma", max: 6, t: "Funciones independientes" },
    nota: "Categorías A (independiente en las seis) a G (dependiente en las seis).",
  },
  {
    id: "lawton", grupo: "funcional", nombre: "Lawton y Brody", sub: "Actividades instrumentales", mejorAlto: true,
    desc: "Ocho actividades: 1 si la realiza con independencia y 0 si no.", ref: "Lawton y Brody, 1969", tipo: "items",
    items: [
      ["telefono", "Uso del teléfono", "Lo usa por iniciativa propia, marca números o contesta"], ["compras", "Compras", "Realiza todas las compras de forma independiente"],
      ["comida", "Preparación de la comida", "Planea, prepara y sirve las comidas"], ["casa", "Cuidado de la casa", "Mantiene la casa solo o con ayuda ocasional"],
      ["ropa", "Lavado de la ropa", "Lava toda su ropa o pequeñas prendas"], ["transporte", "Medio de transporte", "Viaja solo o acompañado en transporte público o en auto"],
      ["medicacion", "Responsabilidad sobre la medicación", "Toma la dosis correcta a la hora indicada"], ["dinero", "Manejo de asuntos económicos", "Maneja sus finanzas con independencia"],
    ].map(([id, t, h]) => S(id, t, 1, { h, sl: ["Independiente", "No"] })),
    total: { modo: "suma", max: 8 }, bandas: B([[1, "Dependencia total", "rojo"], [3, "Dependencia grave", "naranja"], [5, "Dependencia moderada", "amarillo"], [7, "Dependencia ligera", "verdeClaro"], [8, "Independiente", "verde"]]),
    nota: "Total de 0 a 8: 0 a 1 dependencia total, 2 a 3 grave, 4 a 5 moderada, 6 a 7 ligera y 8 independiente.",
  },

  // ═══ 5. PRONÓSTICO ═══
  {
    id: "pap", grupo: "pronostico", nombre: "PaP", sub: "Palliative Prognostic Score", desc: "Seis variables que suman puntos para estimar la supervivencia a 30 días.",
    ref: "Pirovano et al., 1999", tipo: "items",
    items: [
      O("disnea", "Disnea", [[0, "Ausente"], [1, "Presente"]]), O("anorexia", "Anorexia", [[0, "Ausente"], [1.5, "Presente"]]),
      O("karnofsky", "Índice de Karnofsky", [[0, "30 o más"], [2.5, "10 a 20"]]),
      O("clinica", "Predicción clínica de supervivencia", [[0, "Más de 12 semanas"], [2, "11 a 12 semanas"], [2.5, "9 a 10 semanas"], [2.5, "7 a 8 semanas"], [4.5, "5 a 6 semanas"], [6, "3 a 4 semanas"], [8.5, "1 a 2 semanas"]], { clave: true }),
      O("leucos", "Leucocitos (por mm³)", [[0, "Normal (4.800 a 8.500)"], [0.5, "Alto (8.501 a 11.000)"], [1.5, "Muy alto (más de 11.000)"]]),
      O("linfos", "Linfocitos (%)", [[0, "Normal (20 a 40)"], [1, "Bajo (12 a 19,9)"], [2.5, "Muy bajo (menos de 12)"]]),
    ],
    total: { modo: "suma", max: 17.5, dec: 1 },
    bandas: B([[5.5, "Grupo A · supervivencia a 30 días > 70 %", "verde"], [11, "Grupo B · 30 a 70 %", "amarillo"], [17.5, "Grupo C · < 30 %", "rojo"]]),
    nota: "Total de 0 a 17,5. Grupo A: 0 a 5,5; grupo B: 5,6 a 11; grupo C: 11,1 a 17,5.",
  },
  {
    id: "ppi", grupo: "pronostico", nombre: "PPI", sub: "Palliative Prognostic Index", desc: "Cinco variables que suman puntos para estimar la supervivencia en semanas.",
    ref: "Morita et al., 1999", tipo: "items",
    items: [
      O("pps", "PPS", [[0, "60 o más"], [2.5, "30 a 50"], [4, "10 a 20"]]), O("ingesta", "Ingesta oral", [[0, "Normal"], [1, "Moderadamente reducida"], [2.5, "Muy reducida (sorbos)"]]),
      O("edema", "Edema", [[0, "Ausente"], [1, "Presente"]]), O("disnea", "Disnea en reposo", [[0, "Ausente"], [3.5, "Presente"]]), O("delirium", "Delirium", [[0, "Ausente"], [4, "Presente"]]),
    ],
    total: { modo: "suma", max: 15, dec: 1 },
    bandas: B([[4, "Supervivencia probable > 6 semanas", "verde"], [6, "Menor de 6 semanas", "naranja"], [15, "Menor de 3 semanas", "rojo"]]),
    nota: "Total de 0 a 15. Más de 6 predice supervivencia menor de 3 semanas; más de 4, menor de 6 semanas.",
  },
  {
    id: "necpal", grupo: "pronostico", nombre: "NECPAL CCOMS-ICO", sub: "Identificación de necesidades paliativas", calc: "necpal",
    desc: "Identifica personas con enfermedad crónica avanzada que se beneficiarían de un enfoque paliativo.", ref: "Gómez-Batiste et al., 2013", tipo: "items",
    items: [
      S("sorpresa", "Pregunta sorpresa", 1, { h: "¿Me sorprendería que este paciente falleciera en los próximos 12 meses?", sl: ["No me sorprendería", "Me sorprendería"] }),
      S("demanda", "Elección o demanda", 1, { h: "Solicitud de atención paliativa por el paciente, la familia o el equipo", sl: ["Presente", "Ausente"] }),
      S("generales", "Indicadores clínicos generales", 1, { h: "Nutricionales, funcionales, de declive, síndromes geriátricos, malestar emocional, comorbilidad y uso de recursos", sl: ["Presente", "Ausente"] }),
      S("especificos", "Indicadores específicos", 1, { h: "Cáncer, EPOC, insuficiencia cardiaca, hepática o renal, enfermedad neurológica y demencia", sl: ["Presente", "Ausente"] }),
    ],
    total: null, nota: "Positivo cuando la respuesta a la pregunta sorpresa es «no me sorprendería» y hay al menos otro componente positivo.",
  },
  {
    id: "spict", grupo: "pronostico", nombre: "SPICT", sub: "Supportive and Palliative Care Indicators", calc: "spict",
    desc: "Indicadores generales y clínicos para identificar a personas con riesgo de deterioro y muerte.", ref: "Highet et al., 2014", tipo: "items",
    items: [
      ...[["g1", "Ingresos urgentes no planificados repetidos"], ["g2", "Estado funcional deficiente o en deterioro con escasa probabilidad de recuperación"],
        ["g3", "Dependencia de otros para el cuidado"], ["g4", "Pérdida de peso significativa"], ["g5", "Síntomas persistentes pese al tratamiento óptimo"],
        ["g6", "El paciente o su familia solicita cuidados paliativos o limitar el tratamiento"]].map(([id, t]) => S(id, t, 1, { g: "Indicadores generales", sl: ["Presente", "Ausente"] })),
      S("clinico", "Cáncer, demencia, enfermedad neurológica, cardiovascular, respiratoria, renal o hepática", 1, { g: "Indicadores clínicos", sl: ["Presente", "Ausente"] }),
    ],
    total: null, nota: "Sin puntuación numérica; la presencia de indicadores generales y clínicos sugiere valorar las necesidades paliativas.",
  },
  {
    id: "sorpresa", grupo: "pronostico", nombre: "Pregunta sorpresa", sub: "Riesgo de mortalidad a 12 meses", desc: "Juicio clínico simple; primer paso de NECPAL.", ref: "Moss et al., 2008", tipo: "nivel",
    niveles: [[1, "«No me sorprendería» que fallezca en el próximo año", "Mayor riesgo · valorar necesidades paliativas", "naranja"], [0, "«Me sorprendería»", "Menor riesgo · seguimiento habitual", "verde"]],
    nota: "Se usa como primer paso de NECPAL.",
  },

  // ═══ 6. COGNICIÓN Y DELIRIUM ═══
  {
    id: "pfeiffer", grupo: "cognicion", nombre: "Pfeiffer", sub: "SPMSQ", desc: "Diez preguntas orales; se cuenta un error por cada respuesta incorrecta.", ref: "Pfeiffer, 1975", tipo: "items",
    items: [
      ["fecha", "Fecha completa (día, mes y año)"], ["dia", "Día de la semana"], ["lugar", "Nombre del lugar"], ["telefono", "Número de teléfono o dirección"], ["edad", "Edad"],
      ["nacimiento", "Fecha de nacimiento"], ["presidente", "Presidente del Gobierno actual"], ["anterior", "Presidente anterior"], ["madre", "Apellidos de la madre"], ["resta", "Restar de 3 en 3 desde 20"],
    ].map(([id, t], i) => S(id, `${i + 1}. ${t}`, 1, { sl: ["Error", "Correcto"] })),
    total: { modo: "suma", max: 10, t: "Errores" },
    bandas: B([[2, "Normal", "verde"], [4, "Deterioro leve", "amarillo"], [7, "Deterioro moderado", "naranja"], [10, "Deterioro grave", "rojo"]]),
    nota: "0 a 2 errores normal, 3 a 4 leve, 5 a 7 moderado y 8 a 10 grave. Se admite un error más con baja escolaridad y uno menos con estudios superiores.",
  },
  {
    id: "mmse", grupo: "cognicion", nombre: "MMSE", sub: "Mini-Mental State Examination", mejorAlto: true, desc: "Examen cognitivo breve de 30 puntos en seis áreas.", ref: "Folstein et al., 1975", tipo: "items",
    items: [
      N("temporal", "Orientación temporal", 0, 5, { h: "Año, estación, fecha, día y mes" }), N("espacial", "Orientación espacial", 0, 5, { h: "País, provincia, ciudad, lugar y planta" }),
      N("fijacion", "Fijación", 0, 3, { h: "Repetir tres palabras" }), N("atencion", "Atención y cálculo", 0, 5, { h: "Restar 7 desde 100 cinco veces, o deletrear una palabra al revés" }),
      N("recuerdo", "Recuerdo diferido", 0, 3, { h: "Recordar las tres palabras" }),
      N("lenguaje", "Lenguaje y praxis", 0, 9, { h: "Nombrar dos objetos (2), repetir una frase (1), orden de tres pasos (3), leer y obedecer (1), escribir una frase (1), copiar dos pentágonos (1)" }),
    ],
    total: { modo: "suma", max: 30 }, bandas: B([[23, "Sugiere deterioro cognitivo", "rojo"], [30, "Sin deterioro", "verde"]]),
    nota: "Una puntuación menor de 24 sugiere deterioro cognitivo, con ajuste por edad y escolaridad.",
  },
  {
    id: "cam", grupo: "cognicion", nombre: "CAM", sub: "Confusion Assessment Method", rapida: true, calc: "cam",
    desc: "Algoritmo de cuatro características para el diagnóstico de delirium.", ref: "Inouye et al., 1990", tipo: "items",
    items: [
      S("c1", "1. Inicio agudo y curso fluctuante", 1, { h: "Cambio brusco respecto al estado basal que varía durante el día", sl: ["Presente", "Ausente"] }),
      S("c2", "2. Inatención", 1, { h: "Dificultad para mantener o dirigir la atención", sl: ["Presente", "Ausente"] }),
      S("c3", "3. Pensamiento desorganizado", 1, { h: "Discurso incoherente o ideas ilógicas", sl: ["Presente", "Ausente"] }),
      S("c4", "4. Alteración del nivel de conciencia", 1, { h: "Hiperalerta, letargia, estupor o coma", sl: ["Presente", "Ausente"] }),
    ],
    total: null, nota: "Hay delirium cuando están presentes las características 1 y 2 y, además, la 3 o la 4.",
  },
  {
    id: "mdas", grupo: "cognicion", nombre: "MDAS", sub: "Memorial Delirium Assessment Scale", desc: "Diez ítems evaluados por el clínico para medir la gravedad del delirium (0 a 3).", ref: "Breitbart et al., 1997", tipo: "items",
    items: [
      R("conciencia", "1. Nivel de conciencia", 0, 3, { h: "Reducción de la conciencia del entorno" }), R("desorientacion", "2. Desorientación", 0, 3, { h: "Tiempo, lugar y persona" }),
      R("memoria", "3. Memoria a corto plazo", 0, 3, { h: "Recuerdo de palabras" }), R("digitos", "4. Dígitos hacia atrás", 0, 3, { h: "Capacidad de concentración" }),
      R("atencion", "5. Atención", 0, 3, { h: "Mantener y cambiar la atención" }), R("pensamiento", "6. Pensamiento desorganizado", 0, 3, { h: "Coherencia del discurso" }),
      R("percepcion", "7. Alteración de la percepción", 0, 3, { h: "Ilusiones y alucinaciones" }), R("delirios", "8. Delirios", 0, 3, { h: "Ideas delirantes" }),
      R("psicomotor", "9. Actividad psicomotora", 0, 3, { h: "Aumento o disminución" }), R("sueno", "10. Ciclo sueño-vigilia", 0, 3, { h: "Inversión o fragmentación" }),
    ],
    total: { modo: "suma", max: 30 }, bandas: B([[12, "Bajo el corte de delirium", "verde"], [30, "Sugiere delirium", "rojo"]]),
    nota: "Total de 0 a 30; 13 o más sugiere delirium y mayor puntuación indica mayor gravedad.",
  },
  {
    id: "drs", grupo: "cognicion", nombre: "DRS-R-98", sub: "Delirium Rating Scale-Revised-98", desc: "Dieciséis ítems: trece de gravedad (0 a 3) y tres de diagnóstico.", ref: "Trzepacz et al., 2001", tipo: "items",
    items: [
      ...[["sueno", "Sueño-vigilia"], ["percepcion", "Alteraciones perceptivas"], ["delirios", "Delirios"], ["labilidad", "Labilidad afectiva"], ["lenguaje", "Lenguaje"], ["pensamiento", "Pensamiento"],
        ["agitacion", "Agitación psicomotora"], ["retardo", "Retardo psicomotor"], ["orientacion", "Orientación"], ["atencion", "Atención"], ["mcp", "Memoria a corto plazo"],
        ["mlp", "Memoria a largo plazo"], ["visuo", "Capacidad visuoespacial"]].map(([id, t]) => R(id, t, 0, 3, { g: "Gravedad (13 ítems)", s: "grav" })),
      R("inicio", "Inicio temporal de los síntomas", 0, 3, { g: "Diagnóstico (3 ítems)" }), R("fluct", "Fluctuación", 0, 2, { g: "Diagnóstico (3 ítems)" }), R("fisica", "Presencia de enfermedad física", 0, 2, { g: "Diagnóstico (3 ítems)" }),
    ],
    subs: [{ id: "grav", t: "Gravedad (0 a 39)", modo: "suma", max: 39, bandas: B([[14, "Bajo el corte", "verde"], [39, "Sugiere delirium (≥ 15)", "rojo"]]) }],
    total: { modo: "suma", max: 46 }, bandas: B([[17, "Bajo el corte", "verde"], [46, "Sugiere delirium (≥ 18)", "rojo"]]),
    nota: "Total de 0 a 46; los cortes habituales son 15 o más en gravedad y 18 o más en el total.",
  },
  {
    id: "nudesc", grupo: "cognicion", nombre: "Nu-DESC", sub: "Cribado de delirium por enfermería", desc: "Cinco ítems observados durante el turno (0 a 2).", ref: "Gaudreau et al., 2005", tipo: "items",
    items: [
      R("desorientacion", "Desorientación", 0, 2, { h: "Confusión de tiempo, lugar o persona" }), R("comportamiento", "Comportamiento inapropiado", 0, 2, { h: "Conducta fuera de lugar, como tirar de sondas" }),
      R("comunicacion", "Comunicación inapropiada", 0, 2, { h: "Discurso incoherente o sin sentido" }), R("ilusiones", "Ilusiones o alucinaciones", 0, 2, { h: "Ver u oír cosas inexistentes" }),
      R("retardo", "Retardo psicomotor", 0, 2, { h: "Lentitud de respuesta o inmovilidad" }),
    ],
    total: { modo: "suma", max: 10 }, bandas: B([[1, "Sin delirium probable", "verde"], [10, "Sugiere delirium", "rojo"]]),
    nota: "Total de 0 a 10; 2 o más sugiere delirium.",
  },

  // ═══ 7. EMOCIONAL Y ESPIRITUAL ═══
  {
    id: "hads", grupo: "emocional", nombre: "HADS", sub: "Hospital Anxiety and Depression Scale", desc: "Catorce ítems alternados de ansiedad y depresión (0 a 3). Cada subescala se interpreta por separado.", ref: "Zigmond y Snaith, 1983", tipo: "items",
    items: [
      ...[["tension", "Tensión o nerviosismo"], ["miedo", "Miedo a que algo malo ocurra"], ["preocupacion", "Preocupación"], ["relajarse", "Capacidad de relajarse"], ["nudo", "Sensación de nudo en el estómago"], ["inquietud", "Inquietud"], ["panico", "Crisis de pánico"]]
        .map(([id, t]) => R(`a_${id}`, t, 0, 3, { g: "Ansiedad (7 ítems)", s: "ans" })),
      ...[["disfrute", "Disfrute con lo habitual"], ["reir", "Capacidad de reír"], ["animo", "Ánimo alegre"], ["lentitud", "Sensación de lentitud"], ["aspecto", "Interés por el aspecto"], ["ilusion", "Ilusión por el futuro"], ["lectura", "Disfrute de lectura o televisión"]]
        .map(([id, t]) => R(`d_${id}`, t, 0, 3, { g: "Depresión (7 ítems)", s: "dep" })),
    ],
    subs: [
      { id: "ans", t: "Ansiedad", modo: "suma", max: 21, bandas: B([[7, "Normal", "verde"], [10, "Dudoso", "amarillo"], [21, "Caso probable", "rojo"]]) },
      { id: "dep", t: "Depresión", modo: "suma", max: 21, bandas: B([[7, "Normal", "verde"], [10, "Dudoso", "amarillo"], [21, "Caso probable", "rojo"]]) },
    ],
    total: null, nota: "En cada subescala: 0 a 7 normal, 8 a 10 dudoso y 11 a 21 caso probable.",
  },
  {
    id: "termometro", grupo: "emocional", nombre: "Termómetro de distrés", sub: "Distress Thermometer", rapida: true, desc: "Termómetro de 0 a 10 acompañado de una lista de problemas.", ref: "Roth et al., 1998", tipo: "items",
    items: [
      R("termometro", "Malestar global en la última semana", 0, 10),
      S("practicos", "Problemas prácticos", 1, { g: "Lista de problemas", h: "Vivienda, transporte, trabajo, cuidado de hijos", noSuma: true }),
      S("familiares", "Problemas familiares", 1, { g: "Lista de problemas", h: "Relación con hijos, pareja y otros familiares", noSuma: true }),
      S("emocionales", "Problemas emocionales", 1, { g: "Lista de problemas", h: "Depresión, miedo, nerviosismo, tristeza, preocupación, pérdida de interés", noSuma: true }),
      S("espirituales", "Problemas espirituales", 1, { g: "Lista de problemas", h: "Preocupaciones religiosas o de sentido", noSuma: true }),
      S("fisicos", "Problemas físicos", 1, { g: "Lista de problemas", h: "Dolor, náuseas, fatiga, sueño, apetito y otros síntomas", noSuma: true }),
    ],
    total: { modo: "suma", max: 10, t: "Termómetro", solo: "termometro" }, bandas: B([[3, "Sin distrés significativo", "verde"], [10, "Distrés significativo", "rojo"]]),
    nota: "El punto de corte habitual es 4 o más para distrés significativo.",
  },
  {
    id: "phq9", grupo: "emocional", nombre: "PHQ-9", sub: "Depresión · últimas dos semanas", desc: "Nueve ítems: 0 nunca · 1 varios días · 2 más de la mitad de los días · 3 casi todos los días.", ref: "Kroenke et al., 2001", tipo: "items", lab: LAB_FREC,
    items: [
      R("i1", "1. Poco interés o placer", 0, 3), R("i2", "2. Ánimo deprimido o desesperanza", 0, 3), R("i3", "3. Problemas de sueño", 0, 3), R("i4", "4. Cansancio o poca energía", 0, 3),
      R("i5", "5. Poco apetito o comer en exceso", 0, 3), R("i6", "6. Sentirse mal consigo mismo o culpable", 0, 3), R("i7", "7. Dificultad para concentrarse", 0, 3),
      R("i8", "8. Enlentecimiento o agitación", 0, 3), R("i9", "9. Ideas de muerte o de hacerse daño", 0, 3, { alerta: "Ítem 9 positivo: requiere valoración clínica." }),
    ],
    total: { modo: "suma", max: 27 }, bandas: B([[4, "Sin depresión", "verde"], [9, "Leve", "verdeClaro"], [14, "Moderada", "amarillo"], [19, "Moderadamente grave", "naranja"], [27, "Grave", "rojo"]]),
    nota: "Total de 0 a 27: 5 a 9 leve, 10 a 14 moderada, 15 a 19 moderadamente grave y 20 o más grave.",
  },
  {
    id: "gds30", grupo: "emocional", nombre: "GDS de Yesavage (30)", sub: "Depresión en el adulto mayor", desc: "Treinta preguntas de sí o no. Se anota el número de respuestas depresivas (0 a 30).", ref: "Yesavage et al., 1982", tipo: "items",
    items: [N("resp", "Respuestas depresivas", 0, 30, { h: "Un punto por cada respuesta depresiva" })],
    total: { modo: "suma", max: 30 }, bandas: B([[10, "Normal", "verde"], [20, "Depresión leve", "amarillo"], [30, "Depresión moderada a grave", "rojo"]]),
    nota: "0 a 10 normal, 11 a 20 depresión leve y 21 a 30 depresión moderada a grave.",
  },
  {
    id: "pdi", grupo: "emocional", nombre: "Patient Dignity Inventory", sub: "Malestar relacionado con la dignidad", desc: "Veinticinco ítems de 1 a 5. Se anota el total (25 a 125).", ref: "Chochinov et al., 2008", tipo: "items",
    items: [N("total", "Total del inventario", 25, 125, { h: "Suma de los 25 ítems" })],
    total: { modo: "suma", min: 25, max: 125 }, nota: "Mayor puntuación indica mayor malestar relacionado con la dignidad. Dominios: síntomas, existencial, dependencia, paz mental y apoyo social.",
  },
  {
    id: "fica", grupo: "emocional", nombre: "FICA", sub: "Anamnesis espiritual", desc: "Guía de entrevista sin puntuación.", ref: "Puchalski y Romer, 2000", tipo: "guia",
    items: [
      { id: "f", t: "F · Fe o creencias", h: "¿Se considera una persona con creencias espirituales o religiosas?" }, { id: "i", t: "I · Importancia e influencia", h: "¿Qué importancia tienen en su vida y cómo influyen en sus decisiones de salud?" },
      { id: "c", t: "C · Comunidad", h: "¿Pertenece a alguna comunidad espiritual o religiosa que le apoye?" }, { id: "a", t: "A · Abordaje en el cuidado", h: "¿Cómo quiere que se aborde esto en su atención?" },
    ],
    nota: "Es una guía de entrevista, sin puntuación.",
  },
  {
    id: "hope", grupo: "emocional", nombre: "HOPE", sub: "Anamnesis espiritual", desc: "Guía de entrevista espiritual en cuatro áreas.", ref: "Anandarajah y Hight, 2001", tipo: "guia",
    items: [
      { id: "h", t: "H · Fuentes de esperanza", h: "¿Qué le da esperanza y fortaleza? (significado, consuelo, paz, amor y conexión)" }, { id: "o", t: "O · Religión organizada", h: "¿Forma parte de una religión organizada?" },
      { id: "p", t: "P · Espiritualidad y prácticas personales", h: "¿Qué aspectos de su espiritualidad practica a título personal?" }, { id: "e", t: "E · Efectos sobre la atención médica", h: "¿Cómo influye su espiritualidad en su cuidado y en los temas del final de la vida?" },
    ],
    nota: "Es una guía de entrevista, sin puntuación.",
  },
  {
    id: "facitsp", grupo: "emocional", nombre: "FACIT-Sp (12)", sub: "Bienestar espiritual", mejorAlto: true, desc: "Dos subescalas con ítems de 0 a 4. Se anota la suma de cada una.", ref: "Peterman et al., 2002", tipo: "items",
    items: [N("paz", "Significado y paz (8 ítems)", 0, 32, { h: "Sentirse en paz, razón para vivir, propósito, armonía interior" }), N("fe", "Fe (4 ítems)", 0, 16, { h: "Consuelo y fortaleza en la fe, fe estable en momentos difíciles" })],
    total: { modo: "suma", max: 48 }, nota: "Total de 0 a 48; mayor puntuación indica mayor bienestar espiritual.",
  },

  // ═══ 8. FAMILIA, CUIDADOR Y DUELO ═══
  {
    id: "zarit", grupo: "familia", nombre: "Zarit", sub: "Sobrecarga del cuidador", desc: "Veintidós ítems de 1 (nunca) a 5 (casi siempre).", ref: "Zarit et al., 1980; Martín et al., 1996", tipo: "items", lab: ["", "Nunca", "Rara vez", "Algunas veces", "Bastantes veces", "Casi siempre"],
    items: [
      "¿Siente que su familiar pide más ayuda de la que realmente necesita?", "¿Siente que, por el tiempo que dedica a su familiar, ya no tiene tiempo suficiente para usted?",
      "¿Se siente agobiado por intentar compatibilizar el cuidado con otras responsabilidades?", "¿Siente vergüenza por la conducta de su familiar?", "¿Se siente enfadado cuando está cerca de su familiar?",
      "¿Piensa que el cuidar de su familiar afecta negativamente la relación con otros miembros de la familia?", "¿Tiene miedo por el futuro de su familiar?", "¿Piensa que su familiar depende de usted?",
      "¿Se siente tenso cuando está cerca de su familiar?", "¿Piensa que su salud ha empeorado por tener que cuidar a su familiar?", "¿Piensa que no tiene tanta intimidad como le gustaría por tener que cuidar a su familiar?",
      "¿Piensa que su vida social se ha visto afectada negativamente?", "¿Se siente incómodo por distanciarse de sus amistades por tener que cuidar a su familiar?",
      "¿Piensa que su familiar le considera a usted la única persona que le puede cuidar?", "¿Piensa que no tiene suficientes ingresos económicos para los gastos de cuidar, además de sus otros gastos?",
      "¿Siente que será incapaz de cuidar a su familiar por mucho más tiempo?", "¿Siente que ha perdido el control de su vida desde que comenzó la enfermedad de su familiar?",
      "¿Desearía poder dejar el cuidado de su familiar a otra persona?", "¿Se siente indeciso sobre qué hacer con su familiar?", "¿Piensa que debería hacer más por su familiar?",
      "¿Piensa que podría cuidar mejor de su familiar?", "Globalmente, ¿qué grado de «carga» experimenta por el hecho de cuidar a su familiar?",
    ].map((t, i) => R(`z${i + 1}`, `${i + 1}. ${t}`, 1, 5)),
    total: { modo: "suma", min: 22, max: 110 }, bandas: B([[46, "Sin sobrecarga", "verde"], [55, "Sobrecarga leve", "amarillo"], [110, "Sobrecarga intensa", "rojo"]]),
    nota: "Total de 22 a 110. Versión española: menos de 47 sin sobrecarga, 47 a 55 leve y más de 55 intensa.",
  },
  {
    id: "apgar", grupo: "familia", nombre: "APGAR familiar", sub: "Funcionalidad familiar", mejorAlto: true, desc: "Cinco preguntas: 0 casi nunca · 1 a veces · 2 casi siempre.", ref: "Smilkstein, 1978", tipo: "items", lab: ["Casi nunca", "A veces", "Casi siempre"],
    items: [
      R("adaptacion", "Adaptación", 0, 2, { h: "Satisfacción con la ayuda recibida de la familia cuando algo le preocupa" }), R("participacion", "Participación", 0, 2, { h: "Satisfacción con la forma en que la familia comparte decisiones y problemas" }),
      R("crecimiento", "Ganancia o crecimiento", 0, 2, { h: "La familia acepta los deseos de emprender nuevas actividades" }), R("afecto", "Afecto", 0, 2, { h: "Satisfacción con la forma en que la familia expresa afecto" }),
      R("recursos", "Recursos", 0, 2, { h: "Satisfacción con el tiempo que pasan juntos" }),
    ],
    total: { modo: "suma", max: 10 }, bandas: B([[3, "Disfunción grave", "rojo"], [6, "Disfunción leve", "amarillo"], [10, "Familia funcional", "verde"]]),
    nota: "Total de 0 a 10: 7 a 10 familia funcional, 4 a 6 disfunción leve y 0 a 3 disfunción grave.",
  },
  {
    id: "icg", grupo: "familia", nombre: "ICG", sub: "Inventory of Complicated Grief", desc: "Diecinueve ítems de 0 a 4. Se anota el total (0 a 76).", ref: "Prigerson et al., 1995", tipo: "items",
    items: [N("total", "Total del inventario", 0, 76, { h: "Suma de los 19 ítems (0 nunca … 4 siempre)" })],
    total: { modo: "suma", max: 76 }, bandas: B([[24, "Sin duelo complicado", "verde"], [76, "Sugiere duelo complicado", "rojo"]]),
    nota: "Una puntuación igual o mayor de 25 sugiere duelo complicado.",
  },

  // ═══ 9. CALIDAD DE VIDA ═══
  {
    id: "qlqc15", grupo: "calidad", nombre: "EORTC QLQ-C15-PAL", sub: "Versión reducida para fase avanzada", desc: "Se anotan las escalas ya transformadas a 0–100. En las funcionales y la global, más es mejor; en los síntomas, más es peor.", ref: "Groenvold et al., 2006", tipo: "items",
    items: [
      N("fisico", "Funcionamiento físico", 0, 100, { mejorAlto: true, g: "Funcionales" }), N("emocional", "Funcionamiento emocional", 0, 100, { mejorAlto: true, g: "Funcionales" }),
      N("global", "Calidad de vida global", 0, 100, { mejorAlto: true, g: "Funcionales" }),
      ...[["fatiga", "Fatiga"], ["nauseas", "Náuseas y vómitos"], ["dolor", "Dolor"], ["disnea", "Disnea"], ["insomnio", "Insomnio"], ["apetito", "Pérdida de apetito"], ["estrenimiento", "Estreñimiento"]]
        .map(([id, t]) => N(id, t, 0, 100, { g: "Síntomas" })),
    ],
    total: null, nota: "En las funcionales y la global, mayor puntuación es mejor; en las de síntomas, mayor puntuación es peor.",
  },
  {
    id: "qlqc30", grupo: "calidad", nombre: "EORTC QLQ-C30", sub: "Pacientes oncológicos", desc: "Se anotan las escalas transformadas a 0–100 (funcionales y global: más es mejor; síntomas: más es peor).", ref: "Aaronson et al., 1993", tipo: "items",
    items: [
      ...[["fisica", "Función física"], ["rol", "Función de rol"], ["emocional", "Función emocional"], ["cognitiva", "Función cognitiva"], ["social", "Función social"], ["global", "Salud global y calidad de vida"]]
        .map(([id, t]) => N(id, t, 0, 100, { mejorAlto: true, g: "Funcionales y global" })),
      ...[["fatiga", "Fatiga"], ["nauseas", "Náuseas y vómitos"], ["dolor", "Dolor"], ["disnea", "Disnea"], ["insomnio", "Insomnio"], ["apetito", "Pérdida de apetito"],
        ["estrenimiento", "Estreñimiento"], ["diarrea", "Diarrea"], ["economicas", "Dificultades económicas"]].map(([id, t]) => N(id, t, 0, 100, { g: "Síntomas" })),
    ],
    total: null, nota: "Se interpreta igual que la versión PAL.",
  },
  {
    id: "facitpal", grupo: "calidad", nombre: "FACIT-Pal", sub: "FACT-G + subescala paliativa", mejorAlto: true, desc: "Se anota la suma de cada componente (ítems de 0 a 4).", ref: "Lyons et al., 2009", tipo: "items",
    items: [N("fisico", "Bienestar físico", 0, 28), N("social", "Bienestar social o familiar", 0, 28), N("emocional", "Bienestar emocional", 0, 24), N("funcional", "Bienestar funcional", 0, 28), N("paliativa", "Subescala paliativa", 0, 76)],
    total: { modo: "suma", max: 184 }, nota: "Total de 0 a 184; mayor puntuación indica mejor calidad de vida.",
  },
  {
    id: "mcgill", grupo: "calidad", nombre: "McGill QoL", sub: "McGill Quality of Life Questionnaire", mejorAlto: true, desc: "Una puntuación por dominio (0 a 10) y una global (promedio).", ref: "Cohen et al., 1995", tipo: "items",
    items: [R("fisico", "Bienestar físico", 0, 10, { h: "Síntoma físico principal y estado físico" }), R("psico", "Bienestar psicológico", 0, 10, { h: "Ánimo, ansiedad y sentimientos negativos" }),
      R("existencial", "Bienestar existencial", 0, 10, { h: "Sentido de la vida y de la propia existencia" }), R("apoyo", "Apoyo", 0, 10, { h: "Apoyo de otras personas" }), R("global", "Calidad de vida global", 0, 10, { h: "Ítem general" })],
    total: { modo: "promedio", max: 10, dec: 1, t: "Puntuación global (promedio)" }, nota: "Mayor valor indica mejor calidad de vida.",
  },

  // ═══ 10. SEDACIÓN ═══
  {
    id: "rass", grupo: "sedacion", nombre: "RASS", sub: "Richmond Agitation-Sedation Scale", desc: "Se observa al paciente, se le llama por su nombre y, si no responde, se aplica un estímulo físico.", ref: "Sessler et al., 2002", tipo: "nivel",
    niveles: [
      [4, "Combativo", "Violento, peligro inmediato para el personal", "rojo"], [3, "Muy agitado", "Se retira tubos o catéteres, agresivo", "naranja"], [2, "Agitado", "Movimientos frecuentes sin propósito", "amarillo"],
      [1, "Inquieto", "Ansioso, sin movimientos agresivos", "verdeClaro"], [0, "Alerta y tranquilo", "", "verde"], [-1, "Somnoliento", "Despierto más de 10 segundos con contacto visual a la llamada", "azulClaro"],
      [-2, "Sedación leve", "Despierta menos de 10 segundos con contacto visual a la llamada", "azulClaro"], [-3, "Sedación moderada", "Movimiento o apertura ocular a la llamada, sin contacto visual", "azul"],
      [-4, "Sedación profunda", "Sin respuesta a la voz, responde al estímulo físico", "azulOscuro"], [-5, "No despertable", "Sin respuesta a la voz ni al estímulo físico", "azulOscuro"],
    ],
    nota: "Se interpreta según el objetivo de sedación fijado para cada paciente.",
  },
  {
    id: "ramsay", grupo: "sedacion", nombre: "Ramsay", sub: "Niveles de sedación", desc: "Seis niveles según la respuesta a estímulos.", ref: "Ramsay et al., 1974", tipo: "nivel",
    niveles: [
      [1, "Ansioso, agitado o inquieto", "Despierto", "naranja"], [2, "Cooperador, orientado y tranquilo", "Despierto · sedación ligera", "verde"], [3, "Responde solo a órdenes", "Despierto · sedación ligera", "verdeClaro"],
      [4, "Dormido: respuesta rápida a estímulo glabelar o sonido fuerte", "Dormido · sedación profunda", "azulClaro"], [5, "Dormido: respuesta lenta a esos estímulos", "Dormido · sedación profunda", "azul"], [6, "Sin respuesta", "Dormido · sedación profunda", "azulOscuro"],
    ],
    nota: "Los niveles 2 y 3 se consideran sedación ligera; del 4 al 6, sedación profunda.",
  },

  // ═══ 11. PEDIATRÍA ═══
  {
    id: "flacc", grupo: "pediatria", nombre: "FLACC", sub: "Niños pequeños o que no verbalizan", pediatrica: true, desc: "Cinco categorías conductuales observadas durante uno a cinco minutos.", ref: "Merkel et al., 1997", tipo: "items",
    items: [
      O("cara", "Cara (Face)", [[0, "Sin expresión particular o sonrisa"], [1, "Muecas o ceño ocasionales, retraído"], [2, "Mandíbula temblorosa, ceño constante"]]),
      O("piernas", "Piernas (Legs)", [[0, "Normales o relajadas"], [1, "Inquietas o tensas"], [2, "Pataleo o piernas encogidas"]]),
      O("actividad", "Actividad (Activity)", [[0, "Tranquilo, posición normal"], [1, "Se retuerce, tenso"], [2, "Arqueado, rígido o con sacudidas"]]),
      O("llanto", "Llanto (Cry)", [[0, "Sin llanto"], [1, "Gemidos o quejidos ocasionales"], [2, "Llanto constante, gritos"]]),
      O("consuelo", "Consuelo (Consolability)", [[0, "Contento, relajado"], [1, "Se tranquiliza con tacto o palabras"], [2, "Difícil de consolar"]]),
    ],
    total: { modo: "suma", max: 10 }, bandas: B([[0, "Relajado", "verde"], [3, "Malestar leve", "verdeClaro"], [6, "Dolor moderado", "naranja"], [10, "Dolor intenso", "rojo"]]),
    nota: "Total de 0 a 10: 0 relajado, 1 a 3 malestar leve, 4 a 6 dolor moderado y 7 a 10 dolor intenso.",
  },
  {
    id: "rflacc", grupo: "pediatria", nombre: "r-FLACC", sub: "Niños con deterioro cognitivo", pediatrica: true, desc: "Versión revisada: los padres aportan las conductas propias del niño ante el dolor.", ref: "Malviya et al., 2006", tipo: "items", lab: ["Sin signo", "Ocasional", "Marcado"],
    items: [
      ...[["cara", "Cara"], ["piernas", "Piernas"], ["actividad", "Actividad"], ["llanto", "Llanto"], ["consuelo", "Consuelo"]].map(([id, t]) => R(id, t, 0, 2)),
      { id: "individual", t: "Conductas propias del niño ante el dolor", h: "Descriptores individualizados aportados por los padres", txt: true, soloTxt: true },
    ],
    total: { modo: "suma", max: 10 }, bandas: B([[0, "Relajado", "verde"], [3, "Malestar leve", "verdeClaro"], [6, "Dolor moderado", "naranja"], [10, "Dolor intenso", "rojo"]]),
    nota: "Se interpreta igual que la FLACC.",
  },
  {
    id: "wong", grupo: "pediatria", nombre: "Caras de Wong-Baker", sub: "Autorreporte desde unos 3 a 4 años", pediatrica: true, desc: "Seis caras, desde sonriente hasta llorando.", ref: "Wong y Baker, 1988", tipo: "nivel",
    niveles: [[0, "😀 Muy feliz, no duele", ""], [2, "🙂 Duele un poco", ""], [4, "😐 Duele un poco más", ""], [6, "🙁 Duele aún más", ""], [8, "😣 Duele mucho", ""], [10, "😭 Duele lo máximo", ""]],
    nota: "A mayor valor, mayor dolor referido.",
  },
  {
    id: "fpsr", grupo: "pediatria", nombre: "FPS-R", sub: "Faces Pain Scale-Revised", pediatrica: true, desc: "Seis caras neutras, sin sonrisa ni lágrimas.", ref: "Hicks et al., 2001", tipo: "nivel",
    niveles: [[0, "Cara 1", "Sin dolor"], [2, "Cara 2", ""], [4, "Cara 3", ""], [6, "Cara 4", ""], [8, "Cara 5", ""], [10, "Cara 6", "El máximo dolor"]],
    nota: "A mayor valor, mayor dolor referido.",
  },
  {
    id: "cries", grupo: "pediatria", nombre: "CRIES", sub: "Neonatos con dolor posoperatorio", pediatrica: true, desc: "Cinco parámetros de 0 a 2.", ref: "Krechel y Bildner, 1995", tipo: "items",
    items: [
      O("llanto", "Llanto (Crying)", [[0, "Ausente o no estridente"], [1, "Estridente pero consolable"], [2, "Estridente e inconsolable"]]),
      O("oxigeno", "Requerimiento de oxígeno", [[0, "No"], [1, "Hasta 30 %"], [2, "Más de 30 %"]]),
      O("signos", "Aumento de signos vitales", [[0, "Sin aumento"], [1, "Aumento hasta 20 %"], [2, "Más de 20 %"]]),
      O("expresion", "Expresión", [[0, "Ninguna"], [1, "Mueca"], [2, "Mueca con quejido"]]),
      O("sueno", "Sueño (Sleeplessness)", [[0, "Continuo"], [1, "Despierta con frecuencia"], [2, "Despierto constante"]]),
    ],
    total: { modo: "suma", max: 10 }, nota: "Total de 0 a 10; mayor puntuación indica mayor dolor.",
  },
  {
    id: "pipp", grupo: "pediatria", nombre: "PIPP", sub: "Premature Infant Pain Profile · prematuros", pediatrica: true, desc: "Siete indicadores de 0 a 3 para el dolor en prematuros.", ref: "Stevens et al., 1996", tipo: "items",
    items: [
      O("edad", "Edad gestacional", [[0, "36 semanas o más"], [1, "32 a 35"], [2, "28 a 31"], [3, "Menos de 28"]]),
      O("estado", "Estado conductual", [[0, "Activo y despierto"], [1, "Quieto y despierto"], [2, "Activo y dormido"], [3, "Quieto y dormido"]]),
      O("fc", "Frecuencia cardiaca máxima (aumento)", [[0, "0 a 4 lpm"], [1, "5 a 14"], [2, "15 a 24"], [3, "25 o más"]]),
      O("sat", "Saturación mínima de oxígeno (descenso)", [[0, "0 a 2,4 %"], [1, "2,5 a 4,9"], [2, "5 a 7,4"], [3, "7,5 % o más"]]),
      O("cejas", "Fruncido de cejas (tiempo de presencia)", [[0, "Menos del 10 %"], [1, "10 a 39 %"], [2, "40 a 69 %"], [3, "70 % o más"]]),
      O("ojos", "Ojos apretados (tiempo de presencia)", [[0, "Menos del 10 %"], [1, "10 a 39 %"], [2, "40 a 69 %"], [3, "70 % o más"]]),
      O("surco", "Surco nasolabial (tiempo de presencia)", [[0, "Menos del 10 %"], [1, "10 a 39 %"], [2, "40 a 69 %"], [3, "70 % o más"]]),
    ],
    total: { modo: "suma", max: 21 }, bandas: B([[6, "Dolor mínimo o ausente", "verde"], [12, "Dolor leve a moderado", "amarillo"], [21, "Dolor moderado a intenso", "rojo"]]),
    nota: "Total de 0 a 21: 6 o menos dolor mínimo o ausente y más de 12 dolor moderado a intenso.",
  },
  {
    id: "comfort", grupo: "pediatria", nombre: "COMFORT", sub: "Sedación y malestar en cuidados intensivos", pediatrica: true, desc: "Ocho indicadores de 1 a 5.", ref: "Ambuel et al., 1992", tipo: "items",
    items: [
      R("alerta", "Alerta", 1, 5, { h: "De sueño profundo a hiperalerta" }), R("calma", "Calma o agitación", 1, 5, { h: "Ansiedad y agitación" }),
      R("resp", "Respuesta respiratoria o llanto", 1, 5, { h: "Sincronía con el ventilador o llanto" }), R("mov", "Movimiento físico", 1, 5, { h: "Ausente a movimientos vigorosos" }),
      R("pam", "Presión arterial media", 1, 5, { h: "Respecto al valor basal" }), R("fc", "Frecuencia cardiaca", 1, 5, { h: "Respecto al valor basal" }),
      R("tono", "Tono muscular", 1, 5, { h: "Relajado a rigidez extrema" }), R("tension", "Tensión facial", 1, 5, { h: "Relajada a muecas" }),
    ],
    total: { modo: "suma", min: 8, max: 40 }, bandas: B([[16, "Sedación excesiva", "azul"], [26, "Sedación adecuada", "verde"], [40, "Malestar o agitación", "rojo"]]),
    nota: "Total de 8 a 40; el rango de 17 a 26 suele considerarse sedación adecuada.",
  },
  {
    id: "lansky", grupo: "pediatria", nombre: "Lansky", sub: "Estado funcional en menores de 16 años", pediatrica: true, mejorAlto: true, desc: "Estado funcional según el nivel de juego y actividad.", ref: "Lansky et al., 1987", tipo: "nivel",
    niveles: [
      [100, "Plenamente activo, normal", "Actividad normal"], [90, "Restricción menor en actividad física extenuante", "Actividad normal"], [80, "Activo, pero se cansa más rápido", "Actividad normal"],
      [70, "Juego y actividad limitados", "Restricción"], [60, "Pasa tiempo de pie, juego tranquilo", "Restricción"], [50, "Se viste, pasa mucho tiempo en cama, juego muy limitado", "Restricción"],
      [40, "Mayormente en cama, juego tranquilo", "Encamado"], [30, "En cama, necesita ayuda incluso para juego tranquilo", "Encamado"], [20, "Duerme mucho, juego pasivo", "Encamado"], [10, "No juega, no se levanta de la cama", "Encamado"],
    ],
    nota: "A menor porcentaje, peor estado funcional.",
  },
  {
    id: "msas1018", grupo: "pediatria", nombre: "MSAS 10-18", sub: "Síntomas en niños y adolescentes con cáncer", pediatrica: true, desc: "Se anotan las subescalas ya calculadas (promedio de 0 a 4).", ref: "Collins et al., 2000", tipo: "items",
    items: [N("phys", "Subescala física", 0, 4, { dec: 2 }), N("psych", "Subescala psicológica", 0, 4, { dec: 2 }), N("gdi", "Índice global de malestar", 0, 4, { dec: 2 })],
    total: null, nota: "Se obtienen subescalas física y psicológica e índice global de malestar.",
  },
  {
    id: "pedsql", grupo: "pediatria", nombre: "PedsQL 4.0", sub: "Calidad de vida relacionada con la salud", pediatrica: true, mejorAlto: true, desc: "Dimensiones transformadas a 0–100 (más es mejor).", ref: "Varni et al., 2001", tipo: "items",
    items: [N("fisico", "Funcionamiento físico", 0, 100), N("emocional", "Funcionamiento emocional", 0, 100), N("social", "Funcionamiento social", 0, 100), N("escolar", "Funcionamiento escolar", 0, 100)],
    total: { modo: "promedio", max: 100, dec: 0, t: "Total (promedio)" }, nota: "Mayor puntuación indica mejor calidad de vida.",
  },
];

export const ESCALA_POR_ID = Object.fromEntries(ESCALAS.map((e) => [e.id, e]));

// ── Motor de puntaje ───────────────────────────────────────────────────────────
const num = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const redondear = (v, dec = 0) => (v === null ? null : Math.round(v * 10 ** dec) / 10 ** dec);
const PEOR_PRIMERO = [COLORES.rojo, COLORES.naranja, COLORES.amarillo, COLORES.verdeClaro, COLORES.verde];

/** Mínimo y máximo posibles de un ítem (en puntos) */
export function rangoItem(it) {
  if (it.r) return it.r;
  if (it.num) return it.num;
  if (it.desliz) return it.desliz;
  if (it.sino !== undefined) return [0, it.sino || 1];
  if (it.op) { const v = it.op.map((o) => o[0]); return [Math.min(...v), Math.max(...v)]; }
  return [0, 1];
}

export const bandaDe = (bandas, p) => (bandas && p !== null ? bandas.find((b) => p <= b.hasta) || bandas[bandas.length - 1] : null);

/** Puntos que aporta la respuesta de un ítem. Opciones: se guarda el número de la opción. Sí/No: 1/0. */
export function puntosItem(it, r) {
  if (it.soloTxt) return null;
  if (it.op) { const i = num(r); return i === null ? null : (it.op[i] ? it.op[i][0] : null); }
  if (it.sino !== undefined) return r === 1 || r === true ? it.sino : r === 0 || r === false ? 0 : null;
  return num(r);
}

/** 0 = lo mejor … 1 = lo peor, según el sentido del ítem (mejorAlto invierte) */
function fraccionItem(esc, it, r) {
  const p = puntosItem(it, r);
  if (p === null) return null;
  let f;
  if (it.sino !== undefined) f = p > 0 ? 1 : 0;
  else { const [a, b] = rangoItem(it); f = b === a ? 0 : (p - a) / (b - a); }
  return (it.mejorAlto ?? esc.mejorAlto) === true ? 1 - f : f;
}

/** Color de una respuesta de un ítem (mapa de calor) */
export function colorItem(esc, it, r) {
  const p = puntosItem(it, r);
  if (p === null) return null;
  if (esc.bi) return bandaDe(esc.bi, p)?.c || null;
  return colorCalor(fraccionItem(esc, it, r));
}

const CALCS = {
  katz(esc, resp) {
    const ids = esc.items.map((i) => i.id);
    if (!ids.every((id) => resp[id] === 0 || resp[id] === 1)) return null;
    const dep = ids.filter((id) => resp[id] === 0);
    const d = (id) => dep.includes(id);
    const n = dep.length;
    let cat = "Otro";
    if (n === 0) cat = "A"; else if (n === 1) cat = "B"; else if (n === 6) cat = "G";
    else if (d("banio") && n === 2) cat = "C";
    else if (d("banio") && d("vestido") && n === 3) cat = "D";
    else if (d("banio") && d("vestido") && d("retrete") && n === 4) cat = "E";
    else if (d("banio") && d("vestido") && d("retrete") && d("movilidad") && n === 5) cat = "F";
    const color = { A: "verde", B: "verdeClaro", C: "amarillo", D: "amarillo", E: "naranja", F: "rojo", G: "rojo", Otro: "gris" }[cat];
    return { t: `Categoría ${cat}`, c: hex(color) };
  },
  cam(esc, resp) {
    // Se concluye en cuanto las respuestas lo permiten (no hace falta llenar las cuatro)
    const { c1, c2, c3, c4 } = resp;
    const positivo = { t: "CAM positivo · hay delirium", c: hex("rojo") };
    const negativo = { t: "CAM negativo · sin delirium", c: hex("verde") };
    if (c1 === 0 || c2 === 0) return negativo;
    if (c1 === 1 && c2 === 1 && (c3 === 1 || c4 === 1)) return positivo;
    if (c1 === 1 && c2 === 1 && c3 === 0 && c4 === 0) return negativo;
    return null;
  },
  necpal(esc, resp) {
    if (resp.sorpresa === 0) return { t: "NECPAL negativo", c: hex("verde") };
    if (resp.sorpresa !== 1) return null;
    const otros = ["demanda", "generales", "especificos"].map((id) => resp[id]);
    if (otros.some((v) => v === 1)) return { t: "NECPAL positivo", c: hex("rojo") };
    return otros.every((v) => v === 0) ? { t: "NECPAL negativo", c: hex("verde") } : null;
  },
  spict(esc, resp) {
    if (!esc.items.some((i) => resp[i.id] === 0 || resp[i.id] === 1)) return null;
    const gen = ["g1", "g2", "g3", "g4", "g5", "g6"].filter((id) => resp[id] === 1).length;
    const cli = resp.clinico === 1;
    return gen >= 1 && cli
      ? { t: `Valorar necesidades paliativas (${gen} generales + clínico)`, c: hex("naranja") }
      : { t: `${gen} indicadores generales${cli ? " + clínico" : ""}`, c: hex("verde") };
  },
};

/**
 * Calcula puntaje, interpretación y color de una escala a partir de las respuestas.
 * Devuelve { vacio, puntaje, max, banda:{t,c}|null, subs:[…], peorF, respondidos, total, completo }.
 */
export function calcular(esc, resp) {
  resp = resp || {};
  const base = { vacio: true, puntaje: null, max: null, banda: null, subs: [], peorF: null, respondidos: 0, total: 0, completo: false };
  if (esc.tipo === "guia") {
    const n = esc.items.filter((i) => String(resp[i.id] || "").trim()).length;
    return { ...base, vacio: n === 0, respondidos: n, total: esc.items.length, completo: n === esc.items.length };
  }
  if (esc.tipo === "nivel") {
    const v = resp.nivel;
    if (v === undefined || v === null || v === "") return { ...base, total: 1 };
    const nv = esc.niveles.find((n) => String(n[0]) === String(v));
    if (!nv) return { ...base, total: 1 };
    const vals = esc.niveles.map((n) => n[0]);
    const f = (Number(v) - Math.min(...vals)) / ((Math.max(...vals) - Math.min(...vals)) || 1);
    const color = nv[3] ? hex(nv[3]) : colorCalor(esc.mejorAlto ? 1 - f : f);
    const sinTexto = ["pps", "karnofsky", "lansky"].includes(esc.id);
    return { ...base, vacio: false, puntaje: Number(v), max: Math.max(...vals), banda: { t: sinTexto ? null : (nv[2] || nv[1] || null), c: color }, respondidos: 1, total: 1, completo: true };
  }

  const items = esc.items.filter((i) => !i.soloTxt);
  const resumir = (lista, modo, solo) => {
    const usar = lista.filter((i) => !i.noSuma && (!solo || i.id === solo));
    const vals = usar.map((i) => puntosItem(i, resp[i.id])).filter((x) => x !== null);
    if (!vals.length) return null;
    const suma = vals.reduce((a, b) => a + b, 0);
    return modo === "promedio" ? suma / vals.length : suma;
  };

  const subs = (esc.subs || []).map((s) => {
    const p = redondear(resumir(items.filter((i) => i.s === s.id), s.modo), s.dec ?? (s.modo === "promedio" ? 1 : 0));
    const banda = p === null ? null : s.bandas ? bandaDe(s.bandas, p) : { t: null, c: colorCalor(p / (s.max || 1)) };
    return { id: s.id, t: s.t, puntaje: p, max: s.max, banda };
  });

  let puntaje = null, banda = null;
  if (esc.total) {
    puntaje = redondear(resumir(items, esc.total.modo, esc.total.solo), esc.total.dec ?? 0);
    if (puntaje !== null) {
      const min = esc.total.min || 0;
      const f = (puntaje - min) / ((esc.total.max - min) || 1);
      banda = esc.bandas ? bandaDe(esc.bandas, puntaje) : { t: null, c: colorCalor(esc.mejorAlto ? 1 - f : f) };
    }
  }
  let concluida = false; // algoritmos (CAM, NECPAL…) que ya se pueden concluir sin responder todo
  if (esc.calc) { const b = CALCS[esc.calc](esc, resp); if (b) { banda = b; concluida = true; } }

  const fr = items.map((i) => fraccionItem(esc, i, resp[i.id])).filter((x) => x !== null);
  const respondidos = items.filter((i) => puntosItem(i, resp[i.id]) !== null).length;
  const hayTexto = esc.items.some((i) => String(resp[i.soloTxt ? i.id : `${i.id}_txt`] || "").trim());
  return {
    vacio: respondidos === 0 && !hayTexto,
    puntaje, max: esc.total?.max ?? null, banda, subs, peorF: fr.length ? Math.max(...fr) : null,
    respondidos, total: items.length, completo: concluida || items.every((i) => i.noSuma || puntosItem(i, resp[i.id]) !== null),
  };
}

/** Texto corto del resultado, para las etiquetas: «7 · Moderado» */
export function resumenCorto(esc, c) {
  if (!c || c.vacio) return "";
  const coma = (x) => String(x).replace(".", ",");
  if (c.puntaje !== null && c.puntaje !== undefined) return [coma(c.puntaje), c.banda?.t].filter(Boolean).join(" · ");
  if (c.banda?.t) return c.banda.t;
  const subs = (c.subs || []).filter((s) => s.puntaje !== null);
  if (subs.length) return subs.map((s) => `${s.t.split(" ")[0]} ${coma(s.puntaje)}${s.banda?.t ? ` (${s.banda.t})` : ""}`).join(" · ");
  return c.total ? `${c.respondidos}/${c.total} ítems` : "";
}

/** Color principal del resultado. Con subescalas o sin total, el peor de ellos. */
export function colorResultado(c) {
  if (!c || c.vacio) return null;
  if (c.banda?.c) return c.banda.c;
  const cs = (c.subs || []).map((s) => s.banda?.c).filter(Boolean);
  if (cs.length) return cs.sort((x, y) => PEOR_PRIMERO.indexOf(x) - PEOR_PRIMERO.indexOf(y))[0];
  return c.peorF !== null && c.peorF !== undefined ? colorCalor(c.peorF) : null;
}

/** Lo que se envía al servidor para una escala */
export function paraGuardar(esc, resp) {
  const c = calcular(esc, resp);
  return { respuestas: resp, puntaje: c.puntaje, nivel_texto: resumenCorto(esc, c).slice(0, 120) || null, nivel_color: colorResultado(c) };
}
