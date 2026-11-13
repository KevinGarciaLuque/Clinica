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
  { key: "dia1",   label: "Día 1" },
  { key: "dia3",   label: "Día 3" },
  { key: "dia7",   label: "Semana 1" },
  { key: "dia15",  label: "2 semanas" },
  { key: "dia30",  label: "1 mes" },
  { key: "dia90",  label: "3 meses" },
  { key: "dia180", label: "6 meses" },
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
export const ZONAS_CUERPO = ["Papada", "Cuello", "Escote", "Mamas", "Brazos", "Abdomen", "Flancos", "Espalda", "Glúteos", "Muslos", "Manos", "Cuero cabelludo"];

/** Zonas de la cara para el dibujo (components/MapaFacial). der./izq. = lado del paciente */
export const ZONAS_CARA = [
  { id: "frente",          label: "Frente",                formas: [{ cx: 130, cy: 62, rx: 58, ry: 22 }] },
  { id: "entrecejo",       label: "Entrecejo",             formas: [{ cx: 130, cy: 100, rx: 13, ry: 11 }] },
  { id: "patas_gallo_der", label: "Patas de gallo der.",   formas: [{ cx: 58, cy: 122, rx: 9, ry: 15 }] },
  { id: "patas_gallo_izq", label: "Patas de gallo izq.",   formas: [{ cx: 202, cy: 122, rx: 9, ry: 15 }] },
  { id: "ojera_der",       label: "Ojera der.",            formas: [{ cx: 96, cy: 140, rx: 18, ry: 7 }] },
  { id: "ojera_izq",       label: "Ojera izq.",            formas: [{ cx: 164, cy: 140, rx: 18, ry: 7 }] },
  { id: "nariz",           label: "Nariz",                 formas: [{ cx: 130, cy: 150, rx: 11, ry: 26 }] },
  { id: "pomulo_der",      label: "Pómulo der.",           formas: [{ cx: 78, cy: 168, rx: 19, ry: 15 }] },
  { id: "pomulo_izq",      label: "Pómulo izq.",           formas: [{ cx: 182, cy: 168, rx: 19, ry: 15 }] },
  { id: "surco_der",       label: "Surco nasogeniano der.", formas: [{ cx: 106, cy: 194, rx: 6, ry: 16 }] },
  { id: "surco_izq",       label: "Surco nasogeniano izq.", formas: [{ cx: 154, cy: 194, rx: 6, ry: 16 }] },
  { id: "labios",          label: "Labios",                formas: [{ cx: 130, cy: 222, rx: 24, ry: 10 }] },
  { id: "comisuras",       label: "Comisuras",             formas: [{ cx: 100, cy: 228, rx: 6, ry: 6 }, { cx: 160, cy: 228, rx: 6, ry: 6 }] },
  { id: "menton",          label: "Mentón",                formas: [{ cx: 130, cy: 262, rx: 22, ry: 12 }] },
  { id: "mandibula_der",   label: "Mandíbula der.",        formas: [{ cx: 74, cy: 236, rx: 9, ry: 22 }] },
  { id: "mandibula_izq",   label: "Mandíbula izq.",        formas: [{ cx: 186, cy: 236, rx: 9, ry: 22 }] },
];

export const nombreZona = (id) => ZONAS_CARA.find((z) => z.id === id)?.label || id;
