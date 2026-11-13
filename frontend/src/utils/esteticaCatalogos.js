// Listas compartidas de Estética (pantallas del menú y pestaña Estética de la consulta)

export const PLANTILLAS_CONSENTIMIENTO = [
  {
    id: 1, procedimiento: "Rinoplastia",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informado/a de manera clara y comprensible sobre el procedimiento de RINOPLASTIA, incluyendo sus beneficios, riesgos, complicaciones posibles, alternativas terapéuticas y el proceso de recuperación esperado. Autorizo al equipo médico a realizar dicho procedimiento y cualquier medida que sea necesaria durante su ejecución para garantizar mi seguridad.`,
    riesgos: ["Hematoma postoperatorio","Infección de la herida","Asimetría residual","Alteraciones en la respiración","Cicatrices visibles"],
  },
  {
    id: 2, procedimiento: "Abdominoplastia",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informado/a sobre el procedimiento de ABDOMINOPLASTIA (plastia abdominal), sus riesgos inherentes, cuidados postoperatorios y resultados esperados. Doy mi consentimiento libre y voluntario para la realización de dicho procedimiento.`,
    riesgos: ["Trombosis venosa profunda","Seromas","Necrosis cutánea","Cicatriz prominente","Cambios en la sensibilidad"],
  },
  {
    id: 3, procedimiento: "Liposucción",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro haber recibido información completa sobre el procedimiento de LIPOSUCCIÓN, sus beneficios, limitaciones, riesgos y proceso de recuperación. Consiento voluntariamente la realización del procedimiento.`,
    riesgos: ["Irregularidades en el contorno","Hematomas","Cambios en la sensibilidad","Infección","Resultados asimétricos"],
  },
  {
    id: 4, procedimiento: "Aumento mamario",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informada sobre el procedimiento de MAMOPLASTIA DE AUMENTO (implantes mamarios), sus riesgos específicos, la vida útil de los implantes, y la necesidad de controles periódicos. Otorgo mi consentimiento libre e informado.`,
    riesgos: ["Contractura capsular","Rotura del implante","Cambios en la sensibilidad del pezón","Asimetría","Interferencia con mamografías"],
  },
  {
    id: 5, procedimiento: "Bichectomía",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informado/a sobre la BICHECTOMÍA (extirpación de las bolsas de Bichat), sus resultados esperados y posibles riesgos. Consiento voluntariamente la realización de dicha intervención.`,
    riesgos: ["Asimetría facial","Paresia del nervio facial","Infección intraoral","Cicatriz intraoral","Resultado excesivo"],
  },
];

/** Fases del control post-procedimiento (mismas claves que la pantalla de Seguimiento) */
export const FASES_CONTROL = [
  { key: "dia1",   label: "Día 1",     dias: 1 },
  { key: "dia3",   label: "Día 3",     dias: 3 },
  { key: "dia7",   label: "Semana 1",  dias: 7 },
  { key: "dia15",  label: "2 semanas", dias: 15 },
  { key: "dia30",  label: "1 mes",     dias: 30 },
  { key: "dia90",  label: "3 meses",   dias: 90 },
  { key: "dia180", label: "6 meses",   dias: 180 },
];
export const EDEMA_OPC = ["Ausente", "Leve", "Moderado", "Severo"];
export const CICATRIZ_OPC = ["Sin alteraciones", "Eritematosa", "Elevada", "Deprimida", "Queloidea", "Hipopigmentada"];
export const RESULTADO_OPC = ["Excelente", "Muy bueno", "Bueno", "Regular", "Requiere revisión"];

export const PROCEDIMIENTOS_COMUNES = [
  { nombre: "Toxina botulínica", unidad: "U" },
  { nombre: "Ácido hialurónico (relleno)", unidad: "ml" },
  { nombre: "Bioestimulador de colágeno", unidad: "ml" },
  { nombre: "Hilos tensores", unidad: "hilos" },
  { nombre: "Plasma rico en plaquetas", unidad: "ml" },
  { nombre: "Mesoterapia", unidad: "ml" },
  { nombre: "Peeling químico", unidad: "sesión" },
  { nombre: "Láser", unidad: "disparos" },
  { nombre: "Radiofrecuencia", unidad: "sesión" },
  { nombre: "Blefaroplastia", unidad: "" },
  { nombre: "Rinoplastia", unidad: "" },
  { nombre: "Bichectomía", unidad: "" },
  { nombre: "Liposucción", unidad: "ml" },
  { nombre: "Abdominoplastia", unidad: "" },
  { nombre: "Aumento mamario", unidad: "cc" },
];
export const UNIDADES = ["U", "ml", "cc", "jeringas", "hilos", "disparos", "sesión"];
export const ANESTESIA_OPC = ["Ninguna", "Tópica (crema)", "Local", "Bloqueo regional", "Sedación", "General"];

export const CONTRAINDICACIONES = [
  "Embarazo o lactancia", "Anticoagulantes / aspirina", "Infección activa en la zona",
  "Herpes recurrente", "Alergias conocidas", "Enfermedad autoinmune",
  "Isotretinoína (últimos 6 meses)", "Tendencia a queloides", "Expectativas poco realistas",
];

/** Zonas del cuerpo (las de la cara se marcan en el dibujo) */
export const ZONAS_CUERPO = ["Papada", "Escote", "Mamas", "Brazos", "Abdomen", "Flancos", "Espalda", "Glúteos", "Muslos", "Manos", "Cuero cabelludo"];

/**
 * Zonas de la cara (components/MapaFacial). Coordenadas sobre la ilustración
 * /img/cara-estetica.webp en una cuadrícula de 880×1168.
 * der./izq. = lado del paciente: la izquierda del dibujo es su lado derecho.
 * Cada forma es una elipse { cx, cy, rx, ry, rot } (rot en grados).
 */
export const ANCHO_CARA = 880;
const par = (id, label, f) => [
  { id: `${id}_der`, label: `${label} der.`, formas: [{ ...f }] },
  { id: `${id}_izq`, label: `${label} izq.`, formas: [{ ...f, cx: ANCHO_CARA - f.cx, rot: f.rot ? -f.rot : 0 }] },
];
export const ZONAS_CARA = [
  { id: "frente",    label: "Frente",                 formas: [{ cx: 440, cy: 258, rx: 185, ry: 72 }] },
  { id: "entrecejo", label: "Entrecejo (glabela)",    formas: [{ cx: 440, cy: 410, rx: 34, ry: 32 }] },
  ...par("sien", "Sien", { cx: 172, cy: 400, rx: 24, ry: 56 }),
  ...par("patas_gallo", "Patas de gallo", { cx: 192, cy: 482, rx: 20, ry: 36 }),
  ...par("ojera", "Surco lagrimal / ojera", { cx: 300, cy: 527, rx: 62, ry: 16, rot: 6 }),
  { id: "nariz",     label: "Nariz",                  formas: [{ cx: 440, cy: 562, rx: 32, ry: 82 }] },
  ...par("pomulo", "Pómulo", { cx: 262, cy: 602, rx: 56, ry: 38, rot: -15 }),
  ...par("masetero", "Masetero", { cx: 214, cy: 722, rx: 28, ry: 52 }),
  ...par("surco", "Surco nasogeniano", { cx: 346, cy: 712, rx: 14, ry: 50, rot: 20 }),
  { id: "codigo_barras", label: "Código de barras (líneas periorales)", formas: [{ cx: 440, cy: 707, rx: 46, ry: 14 }] },
  { id: "labios",    label: "Labios",                 formas: [{ cx: 440, cy: 781, rx: 108, ry: 40 }] },
  { id: "comisuras", label: "Comisuras",              formas: [{ cx: 318, cy: 778, rx: 14, ry: 14 }, { cx: 562, cy: 778, rx: 14, ry: 14 }] },
  ...par("marioneta", "Línea de marioneta", { cx: 330, cy: 842, rx: 14, ry: 36, rot: -12 }),
  { id: "menton",    label: "Mentón",                 formas: [{ cx: 440, cy: 900, rx: 66, ry: 34 }] },
  ...par("mandibula", "Mandíbula", { cx: 252, cy: 862, rx: 20, ry: 66, rot: -45 }),
  { id: "cuello",    label: "Bandas del cuello (platisma)", formas: [{ cx: 440, cy: 1045, rx: 130, ry: 38 }] },
];

export const nombreZona = (id) => ZONAS_CARA.find((z) => z.id === id)?.label || id;
