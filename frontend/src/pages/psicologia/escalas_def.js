import dayjs from "dayjs";

export const categoriaEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return "adulto";
  const age = dayjs().diff(dayjs(fechaNacimiento), "year");
  return age < 12 ? "nino" : age < 18 ? "adolescente" : "adulto";
};

export const getItemsDef = (def) => {
  if (def.itemsConOpciones) return def.itemsConOpciones;
  if (def.items && def.opciones) return def.items.map(pregunta => ({ pregunta, opciones: def.opciones }));
  return [];
};

const sum = (r) => (r || []).reduce((a, b) => a + (Number(b) || 0), 0);

// ─── Items con valores especiales ─────────────────────────────────────────────
const AUDIT_ITEMS = [
  { pregunta: "¿Con qué frecuencia consume alguna bebida alcohólica?", opciones: ["Nunca (0)", "Una vez al mes o menos (1)", "2 a 4 veces al mes (2)", "2 a 3 veces a la semana (3)", "4 o más veces a la semana (4)"] },
  { pregunta: "¿Cuántas bebidas alcohólicas consume en un día de consumo normal?", opciones: ["1 o 2 (0)", "3 o 4 (1)", "5 o 6 (2)", "7 a 9 (3)", "10 o más (4)"] },
  { pregunta: "¿Con qué frecuencia toma 6 o más bebidas en una sola ocasión?", opciones: ["Nunca (0)", "Menos de una vez al mes (1)", "Mensualmente (2)", "Semanalmente (3)", "A diario o casi a diario (4)"] },
  { pregunta: "¿Con qué frecuencia en el último año no pudo parar de beber una vez que empezó?", opciones: ["Nunca (0)", "Menos de una vez al mes (1)", "Mensualmente (2)", "Semanalmente (3)", "A diario o casi a diario (4)"] },
  { pregunta: "¿Con qué frecuencia en el último año no pudo cumplir con sus obligaciones por haber bebido?", opciones: ["Nunca (0)", "Menos de una vez al mes (1)", "Mensualmente (2)", "Semanalmente (3)", "A diario o casi a diario (4)"] },
  { pregunta: "¿Con qué frecuencia en el último año necesitó beber por la mañana para recuperarse?", opciones: ["Nunca (0)", "Menos de una vez al mes (1)", "Mensualmente (2)", "Semanalmente (3)", "A diario o casi a diario (4)"] },
  { pregunta: "¿Con qué frecuencia en el último año tuvo remordimientos después de beber?", opciones: ["Nunca (0)", "Menos de una vez al mes (1)", "Mensualmente (2)", "Semanalmente (3)", "A diario o casi a diario (4)"] },
  { pregunta: "¿Con qué frecuencia en el último año no pudo recordar lo que ocurrió la noche anterior?", opciones: ["Nunca (0)", "Menos de una vez al mes (1)", "Mensualmente (2)", "Semanalmente (3)", "A diario o casi a diario (4)"] },
  { pregunta: "¿Usted u otra persona resultaron heridos a causa de su consumo de alcohol?", opciones: ["No (0)", "Sí, pero no en el último año (2)", "Sí, en el último año (4)"], valores: [0, 2, 4] },
  { pregunta: "¿Un familiar, médico u otro profesional ha mostrado preocupación por su consumo de alcohol?", opciones: ["No (0)", "Sí, pero no en el último año (2)", "Sí, en el último año (4)"], valores: [0, 2, 4] },
];

const DASS21_D = [2, 4, 9, 12, 15, 16, 20];
const DASS21_A = [1, 3, 6, 8, 14, 18, 19];
const DASS21_S = [0, 5, 7, 10, 11, 13, 17];

// ══════════════════════════════════════════════════════════════════════════════
export const ESCALAS_DEF = {

  // ── Adultos + Adolescentes ────────────────────────────────────────────────
  PHQ9: {
    nombre: "PHQ-9", subtitulo: "Cuestionario de Salud del Paciente — Depresión",
    categorias: ["adulto", "adolescente"], tipo: "cuestionario",
    opciones: ["Nunca (0)", "Varios días (1)", "Más de la mitad (2)", "Casi todos los días (3)"],
    items: [
      "Poco interés o placer en hacer cosas",
      "Sentirse deprimido/a o sin esperanza",
      "Problemas para dormir o dormir demasiado",
      "Cansancio o poca energía",
      "Poco apetito o comer en exceso",
      "Sentirse mal consigo mismo/a o sentirse un fracaso",
      "Dificultad para concentrarse",
      "Moverse o hablar muy lento, o estar muy agitado/a",
      "Pensamientos de hacerse daño o de que estaría mejor muerto/a",
    ],
    calcPuntaje: (r) => sum(r),
    interpretar: (r) => { const p = sum(r); return p <= 4 ? "Sin depresión" : p <= 9 ? "Depresión leve" : p <= 14 ? "Depresión moderada" : p <= 19 ? "Moderadamente grave" : "Depresión grave"; },
  },

  GAD7: {
    nombre: "GAD-7", subtitulo: "Escala de Ansiedad Generalizada",
    categorias: ["adulto", "adolescente"], tipo: "cuestionario",
    opciones: ["Nunca (0)", "Varios días (1)", "Más de la mitad (2)", "Casi todos los días (3)"],
    items: [
      "Sentirse nervioso/a, ansioso/a o con los nervios de punta",
      "No poder dejar de preocuparse o controlar la preocupación",
      "Preocuparse demasiado por cosas diferentes",
      "Dificultad para relajarse",
      "Estar tan inquieto/a que es difícil quedarse quieto/a",
      "Molestarse o irritarse fácilmente",
      "Sentir miedo de que algo terrible pudiera pasar",
    ],
    calcPuntaje: (r) => sum(r),
    interpretar: (r) => { const p = sum(r); return p <= 4 ? "Sin ansiedad" : p <= 9 ? "Ansiedad leve" : p <= 14 ? "Ansiedad moderada" : "Ansiedad grave"; },
  },

  DASS21: {
    nombre: "DASS-21", subtitulo: "Escalas de Depresión, Ansiedad y Estrés",
    categorias: ["adulto"], tipo: "cuestionario",
    opciones: ["No me ocurrió (0)", "Me ocurrió a veces (1)", "Me ocurrió bastante (2)", "Me ocurrió casi siempre (3)"],
    items: [
      "Me costó mucho relajarme",
      "Me di cuenta de que tenía la boca seca",
      "No podía sentir ningún sentimiento positivo",
      "Se me hizo difícil respirar en algunos momentos",
      "Me costó mucho tener iniciativa para hacer cosas",
      "Reaccioné de manera exagerada en ciertas situaciones",
      "Noté que me temblaban las manos o el cuerpo",
      "Sentí que estaba muy nervioso/a",
      "Me preocupé por situaciones en las que podría entrar en pánico",
      "Sentí que no tenía nada por lo que esperar en el futuro",
      "Me noté agitado/a e inquieto/a",
      "Me fue difícil relajarme",
      "Me sentí desanimado/a y triste",
      "Estuve impaciente cuando me interrumpían",
      "Estuve al borde del pánico",
      "Fui incapaz de entusiasmarme por algo",
      "Sentí que no valía mucho como persona",
      "Noté que era demasiado sensible o susceptible",
      "Era consciente de los latidos de mi corazón sin esfuerzo físico",
      "Me sentí asustado/a sin razón aparente",
      "Sentí que la vida no tenía sentido",
    ],
    calcPuntaje: (r) => sum(r),
    interpretar: (r) => {
      const D = DASS21_D.reduce((a, i) => a + (Number(r[i]) || 0), 0) * 2;
      const A = DASS21_A.reduce((a, i) => a + (Number(r[i]) || 0), 0) * 2;
      const S = DASS21_S.reduce((a, i) => a + (Number(r[i]) || 0), 0) * 2;
      const dL = D <= 9 ? "Normal" : D <= 13 ? "Leve" : D <= 20 ? "Mod." : D <= 27 ? "Grave" : "Extremo";
      const aL = A <= 7 ? "Normal" : A <= 9 ? "Leve" : A <= 14 ? "Mod." : A <= 19 ? "Grave" : "Extremo";
      const sL = S <= 14 ? "Normal" : S <= 18 ? "Leve" : S <= 25 ? "Mod." : S <= 33 ? "Grave" : "Extremo";
      return `D:${D}(${dL}) A:${A}(${aL}) E:${S}(${sL})`;
    },
    subescalas: (r) => {
      const D = DASS21_D.reduce((a, i) => a + (Number(r[i]) || 0), 0) * 2;
      const A = DASS21_A.reduce((a, i) => a + (Number(r[i]) || 0), 0) * 2;
      const S = DASS21_S.reduce((a, i) => a + (Number(r[i]) || 0), 0) * 2;
      return [
        { label: "Depresión", valor: D, nivel: D <= 9 ? "Normal" : D <= 13 ? "Leve" : D <= 20 ? "Moderado" : D <= 27 ? "Grave" : "Extremo", color: "#6d28d9" },
        { label: "Ansiedad",  valor: A, nivel: A <= 7 ? "Normal" : A <= 9 ? "Leve" : A <= 14 ? "Moderado" : A <= 19 ? "Grave" : "Extremo", color: "#2196f3" },
        { label: "Estrés",    valor: S, nivel: S <= 14 ? "Normal" : S <= 18 ? "Leve" : S <= 25 ? "Moderado" : S <= 33 ? "Grave" : "Extremo", color: "#f59e0b" },
      ];
    },
  },

  BDIII: {
    nombre: "BDI-II", subtitulo: "Inventario de Depresión de Beck",
    categorias: ["adulto"], tipo: "cuestionario",
    itemsConOpciones: [
      { pregunta: "Tristeza", opciones: ["No me siento triste", "Me siento triste gran parte del tiempo", "Me siento triste continuamente", "Me siento tan triste que no puedo soportarlo"] },
      { pregunta: "Pesimismo", opciones: ["No estoy desanimado/a sobre mi futuro", "Me siento más desanimado/a sobre mi futuro", "No espero que las cosas mejoren", "Mi futuro es desesperanzador y seguirá empeorando"] },
      { pregunta: "Fracasos pasados", opciones: ["No me siento fracasado/a", "He fracasado más de lo que debería", "Al recordar mi vida veo muchos fracasos", "Como persona soy un fracaso total"] },
      { pregunta: "Pérdida de placer", opciones: ["Obtengo tanta satisfacción de las cosas como antes", "No disfruto tanto las cosas como solía", "Obtengo muy poca satisfacción de las cosas", "No obtengo ninguna satisfacción de nada"] },
      { pregunta: "Sentimientos de culpa", opciones: ["No me siento culpable", "Me siento culpable de muchas cosas", "Me siento bastante culpable la mayor parte del tiempo", "Me siento culpable constantemente"] },
      { pregunta: "Sentimientos de castigo", opciones: ["No creo que esté siendo castigado/a", "Siento que puedo ser castigado/a", "Espero ser castigado/a", "Siento que estoy siendo castigado/a"] },
      { pregunta: "Autoestima", opciones: ["Tengo la misma opinión sobre mí como siempre", "He perdido confianza en mí mismo/a", "Estoy decepcionado/a conmigo mismo/a", "Me odio"] },
      { pregunta: "Autocrítica", opciones: ["No me critico más de lo normal", "Me critico más que antes por mis errores", "Me critico a mí mismo/a por todos mis errores", "Me culpo por todo lo malo que sucede"] },
      { pregunta: "Pensamientos suicidas", opciones: ["No tengo pensamientos de hacerme daño", "Tengo pensamientos de hacerme daño pero no los llevaría a cabo", "Me gustaría suicidarme", "Me suicidaría si tuviera la oportunidad"] },
      { pregunta: "Llanto", opciones: ["No lloro más de lo usual", "Lloro más de lo que solía", "Lloro por cualquier cosa", "Tengo ganas de llorar pero no puedo"] },
      { pregunta: "Agitación", opciones: ["No estoy más inquieto/a de lo normal", "Me siento más inquieto/a de lo normal", "Estoy tan inquieto/a que me cuesta quedarme quieto/a", "Estoy tan agitado/a que debo estar en movimiento"] },
      { pregunta: "Pérdida de interés", opciones: ["No he perdido interés por personas o actividades", "Estoy menos interesado/a en otras personas o cosas", "He perdido la mayor parte de mi interés", "Me es difícil interesarme en algo"] },
      { pregunta: "Indecisión", opciones: ["Tomo decisiones tan bien como siempre", "Me resulta más difícil tomar decisiones", "Tengo muchas más dificultades para decidir", "Tengo problemas para cualquier decisión"] },
      { pregunta: "Inutilidad", opciones: ["No me siento inútil", "No me considero tan valioso/a como antes", "Me siento más inútil en comparación con otros", "Me siento completamente inútil"] },
      { pregunta: "Pérdida de energía", opciones: ["Tengo tanta energía como siempre", "Tengo menos energía que antes", "No tengo suficiente energía para muchas cosas", "No tengo energía para nada"] },
      { pregunta: "Cambios en el sueño", opciones: ["No he tenido cambios en mi sueño", "Duermo algo más / menos de lo normal", "Duermo mucho más / menos de lo normal", "Duermo la mayor parte del día / me despierto muy temprano"] },
      { pregunta: "Irritabilidad", opciones: ["No estoy más irritable de lo normal", "Estoy más irritable de lo normal", "Estoy mucho más irritable", "Estoy irritable constantemente"] },
      { pregunta: "Cambios en el apetito", opciones: ["No he tenido cambios en el apetito", "Mi apetito es algo menor / mayor", "Mi apetito es mucho menor / mayor", "No tengo apetito o tengo necesidad de comer constantemente"] },
      { pregunta: "Concentración", opciones: ["Me concentro tan bien como siempre", "No me concentro tan bien como antes", "Me es difícil mantener la mente en algo", "Me es imposible concentrarme en nada"] },
      { pregunta: "Cansancio o fatiga", opciones: ["No estoy más cansado/a de lo normal", "Me canso más fácilmente de lo normal", "Me canso al hacer cualquier cosa", "Estoy demasiado cansado/a para hacer nada"] },
      { pregunta: "Pérdida de interés en el sexo", opciones: ["No he notado cambios en mi interés sexual", "Estoy menos interesado/a en el sexo", "Estoy mucho menos interesado/a", "He perdido por completo el interés en el sexo"] },
    ],
    calcPuntaje: (r) => sum(r),
    interpretar: (r) => { const p = sum(r); return p <= 13 ? "Mínima depresión" : p <= 19 ? "Depresión leve" : p <= 28 ? "Depresión moderada" : "Depresión grave"; },
  },

  BAI: {
    nombre: "BAI", subtitulo: "Inventario de Ansiedad de Beck",
    categorias: ["adulto"], tipo: "cuestionario",
    opciones: ["En absoluto (0)", "Levemente (1)", "Moderadamente (2)", "Gravemente (3)"],
    items: [
      "Entumecimiento u hormigueo", "Sensación de calor", "Temblores en las piernas",
      "Incapaz de relajarme", "Miedo a lo peor", "Aturdimiento o mareos",
      "Palpitaciones o corazón acelerado", "Sin estabilidad / inestable",
      "Aterrorizado/a", "Nerviosismo", "Sensación de ahogo", "Temblores de manos",
      "Tembloroso/a en general", "Miedo a perder el control", "Dificultad para respirar",
      "Miedo a morir", "Asustado/a", "Indigestión o malestar estomacal",
      "Desmayo o sensación de desmayo", "Rubor facial", "Sudoración sin calor",
    ],
    calcPuntaje: (r) => sum(r),
    interpretar: (r) => { const p = sum(r); return p <= 9 ? "Ansiedad mínima" : p <= 18 ? "Ansiedad leve" : p <= 29 ? "Ansiedad moderada" : "Ansiedad grave"; },
  },

  AUDIT: {
    nombre: "AUDIT", subtitulo: "Test de Identificación de Trastornos por Alcohol",
    categorias: ["adulto"], tipo: "cuestionario",
    itemsConOpciones: AUDIT_ITEMS,
    calcPuntaje: (r) => AUDIT_ITEMS.reduce((acc, item, i) => {
      const idx = Number(r[i]) || 0;
      return acc + (item.valores ? (item.valores[idx] ?? idx) : idx);
    }, 0),
    interpretar: (r) => {
      const p = AUDIT_ITEMS.reduce((acc, item, i) => {
        const idx = Number(r[i]) || 0;
        return acc + (item.valores ? (item.valores[idx] ?? idx) : idx);
      }, 0);
      return p <= 7 ? "Bajo riesgo (Zona I)" : p <= 15 ? "Consumo de riesgo (Zona II)" : p <= 19 ? "Consumo perjudicial (Zona III)" : "Dependencia probable (Zona IV)";
    },
  },

  WHODAS: {
    nombre: "WHODAS 2.0", subtitulo: "Evaluación de Discapacidad OMS — 12 ítems",
    categorias: ["adulto"], tipo: "cuestionario",
    opciones: ["Ninguna (0)", "Leve (1)", "Moderada (2)", "Grave (3)", "Extrema/No puede (4)"],
    items: [
      "Mantenerse de pie durante 30 minutos",
      "Llevar a cabo sus responsabilidades domésticas más importantes",
      "Aprender una tarea nueva (ej. llegar a un lugar nuevo)",
      "Participar en actividades comunitarias (fiestas, actividades religiosas u otras)",
      "¿En cuánto le ha afectado emocionalmente su problema de salud?",
      "Concentrarse en algo durante diez minutos",
      "Caminar una distancia larga como un kilómetro",
      "Lavar todo su cuerpo",
      "Vestirse",
      "Tratar con personas que no conoce",
      "Mantener una amistad",
      "Su trabajo diario (laboral, hogar, escuela o voluntario)",
    ],
    calcPuntaje: (r) => sum(r),
    interpretar: (r) => {
      const p = sum(r); const pct = Math.round((p / 48) * 100);
      return p <= 4 ? `Sin discapacidad (${pct}%)` : p <= 12 ? `Discapacidad leve (${pct}%)` : p <= 24 ? `Discapacidad moderada (${pct}%)` : p <= 36 ? `Discapacidad grave (${pct}%)` : `Discapacidad completa (${pct}%)`;
    },
  },

  // ── Registro adultos ──────────────────────────────────────────────────────
  CSSRS: {
    nombre: "C-SSRS", subtitulo: "Escala de Columbia — Seriedad del Suicidio",
    categorias: ["adulto", "adolescente"], tipo: "registro",
    campos: [
      { key: "ideacion", label: "Nivel de ideación suicida", tipo: "select", opciones: ["0 — Sin ideación", "1 — Pasiva (deseo de estar muerto/a)", "2 — Activa sin método ni plan", "3 — Con método pero sin plan", "4 — Con plan específico", "5 — Con plan e intención"] },
      { key: "conducta", label: "Conducta suicida", tipo: "select", opciones: ["0 — Sin conducta", "1 — Preparatoria", "2 — Intento interrumpido por sí mismo", "3 — Intento interrumpido por otros", "4 — Intento real no fatal", "5 — Suicidio completado"] },
      { key: "letalidad", label: "Letalidad del intento más grave (0–6)", tipo: "numero", min: 0, max: 6 },
      { key: "fecha_evento", label: "Fecha del evento más reciente", tipo: "fecha" },
      { key: "observaciones", label: "Observaciones clínicas", tipo: "texto_largo" },
    ],
    calcPuntaje: (c) => Number((c.ideacion || "0").charAt(0)) || 0,
    interpretar: (c) => {
      const n = Number((c.ideacion || "0").charAt(0)) || 0;
      const b = Number((c.conducta || "0").charAt(0)) || 0;
      if (b >= 4) return `Riesgo muy alto — Intento real (conducta ${b})`;
      if (n >= 4) return `Riesgo alto — Ideación con plan (nivel ${n})`;
      if (n >= 2) return `Riesgo moderado — Ideación activa (nivel ${n})`;
      if (n === 1) return "Riesgo bajo — Ideación pasiva";
      return "Sin ideación ni conducta suicida";
    },
  },

  // ── Niños y adolescentes ──────────────────────────────────────────────────
  CDI: {
    nombre: "CDI", subtitulo: "Inventario de Depresión Infantil (7–17 años)",
    categorias: ["nino", "adolescente"], tipo: "cuestionario",
    itemsConOpciones: [
      { pregunta: "Estado de ánimo general", opciones: ["Nunca me siento triste", "Me siento triste muchas veces", "Me siento triste siempre"] },
      { pregunta: "Expectativas futuras", opciones: ["Las cosas me irán bien", "No sé si las cosas me irán bien", "Las cosas me irán mal"] },
      { pregunta: "Sensación de fracaso", opciones: ["Hago las cosas bien", "Hago muchas cosas mal", "Todo lo hago mal"] },
      { pregunta: "Capacidad de disfrutar", opciones: ["Me divierto con muchas cosas", "Me divierto con pocas cosas", "Nada me divierte"] },
      { pregunta: "Comportamiento con otros", opciones: ["No soy tan malo/a como otros", "Soy malo/a muchas veces", "Soy malo/a siempre"] },
      { pregunta: "Anticipación negativa", opciones: ["No creo que me vayan a pasar cosas malas", "Tengo miedo de que me pasen cosas malas", "Estoy seguro/a de que me pasarán cosas malas"] },
      { pregunta: "Autoestima", opciones: ["Me quiero a mí mismo/a", "No me quiero a mí mismo/a", "Me odio"] },
      { pregunta: "Culpa", opciones: ["No me siento culpable de cosas malas", "Me siento culpable de muchas cosas malas", "Me siento culpable de todo lo malo"] },
      { pregunta: "Autoacusación", opciones: ["No creo que merezca castigo", "Creo que merezco castigo", "Quiero que me castiguen"] },
      { pregunta: "Pensamientos de hacerse daño", opciones: ["Nunca pienso en hacerme daño", "Pienso en hacerme daño pero no lo haría", "Quiero hacerme daño"] },
      { pregunta: "Relaciones con otros", opciones: ["Me llevo bien con la gente", "Me llevo mal con la gente muchas veces", "No me llevo bien con nadie"] },
      { pregunta: "Rendimiento escolar", opciones: ["Me va bien en el colegio", "Me va mal muchas veces", "Me va muy mal en el colegio"] },
      { pregunta: "Energía / Cansancio", opciones: ["No me siento cansado/a", "Me siento cansado/a muchas veces", "Siempre me siento cansado/a"] },
      { pregunta: "Apetito", opciones: ["Como bastante bien", "Muchos días no tengo ganas de comer", "Casi nunca tengo ganas de comer"] },
      { pregunta: "Sueño", opciones: ["Duermo muy bien", "Muchas noches me cuesta dormir", "Siempre me cuesta dormir"] },
      { pregunta: "Soledad", opciones: ["No me siento solo/a", "Muchas veces me siento solo/a", "Siempre me siento solo/a"] },
      { pregunta: "Capacidad de divertirse", opciones: ["Cuando quiero puedo divertirme", "No siempre puedo divertirme cuando quiero", "No puedo divertirme nunca"] },
      { pregunta: "Llanto", opciones: ["Pocas veces tengo ganas de llorar", "Muchas veces tengo ganas de llorar", "Tengo ganas de llorar todos los días"] },
      { pregunta: "Preocupación", opciones: ["Pocas veces me preocupo por cosas", "Muchas veces me preocupo por cosas", "Siempre me preocupo por cosas"] },
      { pregunta: "Motivación", opciones: ["No estoy aburrido/a de todo", "A veces me aburro de todo", "Siempre me aburro de todo"] },
      { pregunta: "Amistades", opciones: ["Tengo amigos/as", "No sé si tengo amigos/as", "No tengo amigos/as"] },
      { pregunta: "Rendimiento académico", opciones: ["Mi trabajo escolar es bueno como antes", "Mi trabajo no es tan bueno como antes", "Soy muy malo/a en asignaturas en que era bueno/a"] },
      { pregunta: "Seguir instrucciones", opciones: ["Puedo seguir instrucciones", "Muchas veces no puedo seguirlas", "No puedo seguir instrucciones"] },
      { pregunta: "Imagen corporal", opciones: ["Me gusta mi aspecto físico", "Algunas cosas de mi cuerpo no me gustan", "Soy horrible físicamente"] },
      { pregunta: "Relaciones con compañeros", opciones: ["Me llevo bien con otros chicos/as", "Muchas veces me peleo con otros", "Nunca me llevo bien con nadie"] },
      { pregunta: "Sentirse bien en el colegio", opciones: ["Me siento bien en el colegio", "Muchas veces me siento mal en el colegio", "Siempre me siento mal en el colegio"] },
      { pregunta: "Autoconcepto", opciones: ["Soy tan bueno/a como los otros chicos", "No soy tan bueno/a como los otros", "No soy bueno/a en absoluto"] },
    ],
    calcPuntaje: (r) => sum(r),
    interpretar: (r) => { const p = sum(r); return p <= 12 ? "Sin depresión significativa" : p <= 19 ? "Depresión leve" : p <= 28 ? "Depresión moderada" : "Depresión grave"; },
  },

  SCARED: {
    nombre: "SCARED", subtitulo: "Escala de Ansiedad Infantil (8–18 años)",
    categorias: ["nino", "adolescente"], tipo: "cuestionario",
    opciones: ["Nunca o casi nunca (0)", "A veces (1)", "Muy seguido o siempre (2)"],
    items: [
      "Cuando me asusto, me cuesta respirar",
      "Me duele la cabeza cuando estoy en el colegio",
      "No me gusta estar con gente que no conozco bien",
      "Me asusto si duermo fuera de casa",
      "Me preocupa gustarle a otras personas",
      "Cuando me asusto, siento que me voy a desmayar",
      "Soy nervioso/a",
      "Me sigo a mis padres por todas partes",
      "La gente me dice que me veo nervioso/a",
      "Me pongo muy nervioso/a con gente que no conozco",
      "Me duele la barriga cuando voy al colegio",
      "Cuando me asusto, siento que estoy perdiendo la cabeza",
      "Me preocupa dormir solo/a",
      "Me preocupa ser tan bueno/a como los otros chicos",
      "Cuando me asusto, siento que las cosas no son reales",
      "Tengo pesadillas de que algo malo le pasa a mis padres",
      "Me preocupa ir al colegio",
      "Cuando me asusto, mi corazón late muy rápido",
      "Noto que me tiemblo",
      "Tengo pesadillas de que algo malo me pasa a mí",
      "Me preocupan los exámenes o las evaluaciones",
      "Cuando me asusto, sudo mucho",
      "Me preocupa el futuro",
      "Tengo miedo de la oscuridad, animales o insectos",
      "Me cuesta concentrarme cuando estoy nervioso/a",
      "Me da vergüenza conocer gente nueva",
      "La gente se burla de mí",
      "Me preocupa que algo malo me vaya a pasar",
      "Me preocupa separarme de mis padres",
      "Tengo miedo de que me ataque el pánico en público",
      "Me preocupa que algo malo pase en mi casa cuando estoy fuera",
      "Me da vergüenza hablar delante de personas que no conozco",
      "Me preocupa lo que pueda pasarme en el futuro",
      "Cuando me asusto, siento que me ahogo",
      "La gente me dice que me preocupo demasiado",
      "No me gusta estar lejos de mis padres",
      "Me da miedo tener ataques de ansiedad",
      "Me preocupa que mis padres me dejen",
      "Me siento tímido/a con la gente",
      "Tengo miedo de muchas cosas",
      "Hago muchas cosas para evitar lo que me da miedo",
    ],
    calcPuntaje: (r) => sum(r),
    interpretar: (r) => { const p = sum(r); return p < 25 ? "Sin ansiedad significativa" : p <= 34 ? "Ansiedad leve a moderada" : "Ansiedad moderada a grave"; },
  },

  // ── Registro niños/adolescentes ───────────────────────────────────────────
  CONNERS: {
    nombre: "Conners-3", subtitulo: "Escala de TDAH — Registro de resultado",
    categorias: ["nino", "adolescente"], tipo: "registro",
    campos: [
      { key: "forma", label: "Forma aplicada", tipo: "select", opciones: ["Conners-3 Padres", "Conners-3 Maestros", "Conners-3 Autorreporte (adolescente)", "Conners-2", "Otra"] },
      { key: "indice_adhd", label: "Índice Global TDAH (T-score)", tipo: "numero", min: 30, max: 90, placeholder: "Ej: 65" },
      { key: "inatención", label: "Inatención (T-score)", tipo: "numero", min: 30, max: 90, placeholder: "Ej: 68" },
      { key: "hiperactividad", label: "Hiperactividad / Impulsividad (T-score)", tipo: "numero", min: 30, max: 90, placeholder: "Ej: 62" },
      { key: "oposicionismo", label: "Conducta Desafiante Oposicionista (T-score)", tipo: "numero", min: 30, max: 90, placeholder: "Ej: 55" },
      { key: "dsm_inatento", label: "DSM — Subtipo Inatento (T-score)", tipo: "numero", min: 30, max: 90, placeholder: "Ej: 70" },
      { key: "dsm_hiper", label: "DSM — Subtipo Hiperactivo/Impulsivo (T-score)", tipo: "numero", min: 30, max: 90 },
      { key: "observaciones", label: "Observaciones", tipo: "texto_largo" },
    ],
    calcPuntaje: (c) => Number(c.indice_adhd) || 0,
    interpretar: (c) => { const t = Number(c.indice_adhd) || 0; return !t ? "Sin T-score registrado" : t < 60 ? "Rango normal (T < 60)" : t < 65 ? "Limítrofe (T 60-64)" : t < 70 ? "Elevado (T 65-69)" : "Muy elevado (T ≥ 70)"; },
  },

  CBCL: {
    nombre: "CBCL / BASC-3", subtitulo: "Conducta Infantil — Registro de resultado",
    categorias: ["nino", "adolescente"], tipo: "registro",
    campos: [
      { key: "instrumento", label: "Instrumento aplicado", tipo: "select", opciones: ["CBCL 6-18 (padres)", "TRF — Reporte del maestro", "YSR — Autorreporte adolescente", "BASC-3 PRS — Padres", "BASC-3 TRS — Maestros", "BASC-3 SRP — Autorreporte", "Otro"] },
      { key: "internalizantes", label: "Problemas Internalizantes (T-score)", tipo: "numero", min: 30, max: 100, placeholder: "Ej: 65" },
      { key: "externalizantes", label: "Problemas Externalizantes (T-score)", tipo: "numero", min: 30, max: 100, placeholder: "Ej: 58" },
      { key: "total_problemas", label: "Total de Problemas (T-score)", tipo: "numero", min: 30, max: 100, placeholder: "Ej: 63" },
      { key: "ansiedad_dep", label: "Ansiedad / Depresión (T-score)", tipo: "numero", min: 30, max: 100 },
      { key: "retraimiento", label: "Retraimiento / Depresión (T-score)", tipo: "numero", min: 30, max: 100 },
      { key: "conducta_agresiva", label: "Conducta Agresiva (T-score)", tipo: "numero", min: 30, max: 100 },
      { key: "atencion", label: "Problemas de Atención (T-score)", tipo: "numero", min: 30, max: 100 },
      { key: "observaciones", label: "Observaciones clínicas", tipo: "texto_largo" },
    ],
    calcPuntaje: (c) => Number(c.total_problemas) || 0,
    interpretar: (c) => { const t = Number(c.total_problemas) || 0; return !t ? "Sin T-score registrado" : t < 60 ? "Rango normal (T < 60)" : t < 64 ? "Limítrofe (T 60-63)" : "Rango clínico (T ≥ 64)"; },
  },

  WISC: {
    nombre: "WISC-V", subtitulo: "Escalas de Inteligencia Wechsler — Registro de resultado",
    categorias: ["nino", "adolescente"], tipo: "registro",
    campos: [
      { key: "fsiq", label: "FSIQ — Coeficiente Intelectual Total", tipo: "numero", min: 40, max: 160, placeholder: "Ej: 95", required: true },
      { key: "vci",  label: "VCI — Comprensión Verbal", tipo: "numero", min: 40, max: 160, placeholder: "Ej: 98" },
      { key: "vsi",  label: "VSI — Visuoespacial", tipo: "numero", min: 40, max: 160, placeholder: "Ej: 102" },
      { key: "fri",  label: "FRI — Razonamiento Fluido", tipo: "numero", min: 40, max: 160, placeholder: "Ej: 90" },
      { key: "wmi",  label: "WMI — Memoria de Trabajo", tipo: "numero", min: 40, max: 160, placeholder: "Ej: 88" },
      { key: "psi",  label: "PSI — Velocidad de Procesamiento", tipo: "numero", min: 40, max: 160, placeholder: "Ej: 94" },
      { key: "evaluador", label: "Evaluador/a", tipo: "texto" },
      { key: "fecha_aplicacion", label: "Fecha de aplicación", tipo: "fecha" },
      { key: "observaciones", label: "Observaciones / Consideraciones", tipo: "texto_largo" },
    ],
    calcPuntaje: (c) => Number(c.fsiq) || 0,
    interpretar: (c) => {
      const f = Number(c.fsiq);
      if (!f) return "Sin FSIQ registrado";
      const nivel = f < 70 ? "Extremadamente bajo" : f < 80 ? "Limítrofe" : f < 90 ? "Promedio bajo" : f < 110 ? "Promedio" : f < 120 ? "Promedio alto" : f < 130 ? "Superior" : "Muy superior";
      return `FSIQ ${f} — ${nivel}`;
    },
  },
};

export const ETIQUETA_CATEGORIA = {
  adulto: "Adulto/a", adolescente: "Adolescente", nino: "Niño/a",
};

export const COLOR_CATEGORIA = {
  adulto: "#6d28d9", adolescente: "#2196f3", nino: "#10b981",
};
