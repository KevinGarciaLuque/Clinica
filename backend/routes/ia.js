/**
 * routes/ia.js
 * Asistente de IA con OpenAI GPT-4o + Function Calling
 * Capacidades:
 *  - Responder preguntas sobre la clínica (servicios, horarios, médicos)
 *  - Buscar disponibilidad de un médico
 *  - Crear citas directamente desde el chat
 *  - Buscar pacientes
 *
 * POST /api/ia/chat     → { sesion_id, mensaje }
 * GET  /api/ia/historial?sesion_id=...
 */

const router = require("express").Router();
const pool   = require("../db");
const OpenAI = require("openai");
const auth   = require("../middlewares/auth");
const gcal   = require("../utils/googleCalendar");

// Inicialización lazy — solo falla si se usa sin API key, no al cargar el módulo
let _openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurada. Agrega la clave en el archivo .env");
  }
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─────────────────────────────────────────────
// Definición de herramientas (function calling)
// ─────────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_medicos",
      description: "Lista los médicos disponibles en la clínica, opcionalmente filtrados por especialidad.",
      parameters: {
        type: "object",
        properties: {
          especialidad: { type: "string", description: "Nombre de la especialidad, ej: Pediatría. Opcional." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_disponibilidad",
      description: "Consulta los slots libres de un médico en una fecha dada.",
      parameters: {
        type: "object",
        required: ["medico_id", "fecha"],
        properties: {
          medico_id: { type: "integer" },
          fecha: { type: "string", description: "Fecha YYYY-MM-DD. Acepta 'hoy' o 'mañana'." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_paciente",
      description: "Busca un paciente en el sistema por nombre, DNI o email.",
      parameters: {
        type: "object",
        required: ["q"],
        properties: {
          q: { type: "string", description: "Nombre, DNI o email del paciente." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_cita",
      description: "Agenda una nueva cita para un paciente con un médico.",
      parameters: {
        type: "object",
        required: ["paciente_id", "medico_id", "inicio", "fin"],
        properties: {
          paciente_id:   { type: "integer" },
          medico_id:     { type: "integer" },
          inicio:        { type: "string", description: "ISO 8601, ej: 2025-02-21T10:00:00" },
          fin:           { type: "string", description: "ISO 8601, ej: 2025-02-21T10:30:00" },
          tipo_consulta: { type: "string", enum: ["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"] },
          motivo:        { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obtener_servicios",
      description: "Devuelve el catálogo de servicios y precios de la clínica.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_especialidades",
      description: "Lista todas las especialidades médicas disponibles en la clínica.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_citas_paciente",
      description: "Lista las próximas citas de un paciente. Útil para que el paciente consulte sus turnos.",
      parameters: {
        type: "object",
        required: ["paciente_id"],
        properties: {
          paciente_id: { type: "integer" },
          desde: { type: "string", description: "Fecha YYYY-MM-DD desde la que mostrar. Por defecto: hoy." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_cita",
      description: "Cancela una cita existente. Requiere confirmación previa del paciente.",
      parameters: {
        type: "object",
        required: ["cita_id"],
        properties: {
          cita_id: { type: "integer", description: "ID de la cita a cancelar." },
          motivo:  { type: "string",  description: "Motivo de cancelación." },
        },
      },
    },
  },
];

// ─────────────────────────────────────────────
// Implementación de cada herramienta
// ─────────────────────────────────────────────
async function ejecutarHerramienta(nombre, args, clinicaId) {
  switch (nombre) {

    case "buscar_medicos": {
      let sql = `SELECT u.id, u.nombres, u.apellidos, e.nombre AS especialidad
                 FROM usuarios u LEFT JOIN especialidades e ON e.id = u.especialidad_id
                 WHERE u.clinica_id=? AND u.tipo='MEDICO' AND u.activo=1`;
      const params = [clinicaId];
      if (args.especialidad) { sql += " AND e.nombre LIKE ?"; params.push(`%${args.especialidad}%`); }
      const [rows] = await pool.query(sql, params);
      return rows;
    }

    case "buscar_disponibilidad": {
      let fechaReal = args.fecha;
      if (fechaReal === "hoy")    fechaReal = new Date().toISOString().slice(0,10);
      if (fechaReal === "mañana") {
        const d = new Date(); d.setDate(d.getDate()+1);
        fechaReal = d.toISOString().slice(0,10);
      }
      const diaSemana = new Date(fechaReal).getDay();
      const diaLunes  = diaSemana === 0 ? 6 : diaSemana - 1;

      const [horarios] = await pool.query(
        "SELECT hora_inicio, hora_fin, slot_minutos FROM horarios_medico WHERE medico_id=? AND clinica_id=? AND dia_semana=? AND activo=1",
        [args.medico_id, clinicaId, diaLunes]
      );
      if (!horarios.length) return { disponible: false, mensaje: "El médico no trabaja ese día." };

      const [ocupadas] = await pool.query(
        `SELECT inicio, fin FROM citas WHERE clinica_id=? AND medico_id=? AND DATE(inicio)=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')`,
        [clinicaId, args.medico_id, fechaReal]
      );

      const toLocalISO = d => {
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      };

      const slots = [];
      for (const h of horarios) {
        let cursor = new Date(`${fechaReal}T${h.hora_inicio}`);
        const fin  = new Date(`${fechaReal}T${h.hora_fin}`);
        while (cursor < fin) {
          const slotFin = new Date(cursor.getTime() + h.slot_minutos * 60000);
          const ocup = ocupadas.some(c => new Date(c.inicio) < slotFin && new Date(c.fin) > cursor);
          if (!ocup) slots.push({ inicio: toLocalISO(cursor), fin: toLocalISO(slotFin) });
          cursor = slotFin;
        }
      }
      return { fecha: fechaReal, slots_libres: slots };
    }

    case "buscar_paciente": {
      const [rows] = await pool.query(
        `SELECT id, nombres, apellidos, dni, telefono, email FROM pacientes
         WHERE clinica_id=? AND (nombres LIKE ? OR apellidos LIKE ? OR dni=? OR email=?) LIMIT 5`,
        [clinicaId, `%${args.q}%`, `%${args.q}%`, args.q, args.q]
      );
      return rows;
    }

    case "crear_cita": {
      const { paciente_id, medico_id, inicio, fin, tipo_consulta, motivo } = args;
      const [solap] = await pool.query(
        `SELECT id FROM citas WHERE clinica_id=? AND medico_id=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')
         AND NOT (fin <= ? OR inicio >= ?) LIMIT 1`,
        [clinicaId, medico_id, inicio, fin]
      );
      if (solap.length) return { ok: false, error: "Horario no disponible (solapamiento)" };

      const [r] = await pool.query(
        `INSERT INTO citas (clinica_id,paciente_id,medico_id,inicio,fin,tipo_consulta,motivo,canal)
         VALUES (?,?,?,?,?,?,?,?)`,
        [clinicaId, paciente_id, medico_id, inicio, fin, tipo_consulta||"CONTROL", motivo||null, "IA"]
      );

      // Sincronizar con Google Calendar del médico (si lo conectó) — no bloquea
      try {
        const [[pac]] = await pool.query("SELECT nombres, apellidos FROM pacientes WHERE id=?", [paciente_id]);
        const [[tzRow]] = await pool.query(
          "SELECT valor FROM clinica_config WHERE clinica_id=? AND clave='zona_horaria'", [clinicaId]
        );
        const googleEventId = await gcal.crearEvento(medico_id, {
          paciente_nombre: pac ? `${pac.nombres} ${pac.apellidos}` : "Paciente",
          motivo, inicio, fin,
        }, tzRow?.valor || "America/Tegucigalpa");
        if (googleEventId) {
          await pool.query("UPDATE citas SET google_event_id=? WHERE id=?", [googleEventId, r.insertId]);
        }
      } catch (e) {
        console.error("[ia/crear_cita] error sincronizando con Google Calendar:", e.message);
      }

      return { ok: true, cita_id: r.insertId, mensaje: `Cita agendada con ID ${r.insertId}` };
    }

    case "obtener_servicios": {
      const [rows] = await pool.query(
        "SELECT nombre, descripcion, precio, moneda, duracion_min FROM servicios WHERE clinica_id=? AND activo=1 ORDER BY nombre",
        [clinicaId]
      );
      return rows;
    }

    case "buscar_especialidades": {
      const [rows] = await pool.query(
        `SELECT DISTINCT
           e.nombre AS especialidad,
           COUNT(u.id) AS cantidad_medicos
         FROM usuarios u
         LEFT JOIN especialidades e ON e.id = u.especialidad_id
         WHERE u.clinica_id = ? AND u.tipo = 'MEDICO' AND u.activo = 1
           AND e.nombre IS NOT NULL
         GROUP BY e.nombre
         ORDER BY e.nombre`,
        [clinicaId]
      );
      return rows;
    }

    case "listar_citas_paciente": {
      const desde = args.desde || new Date().toISOString().slice(0, 10);
      const [rows] = await pool.query(
        `SELECT c.id,
                DATE_FORMAT(c.inicio, '%Y-%m-%dT%H:%i:%s') AS inicio,
                DATE_FORMAT(c.fin, '%Y-%m-%dT%H:%i:%s') AS fin,
                c.tipo_consulta, c.estado, c.motivo,
                u.nombres AS med_nombres, u.apellidos AS med_apellidos, e.nombre AS especialidad
         FROM citas c
         JOIN usuarios u ON u.id = c.medico_id
         LEFT JOIN especialidades e ON e.id = u.especialidad_id
         WHERE c.clinica_id = ? AND c.paciente_id = ?
           AND DATE(c.inicio) >= ?
           AND c.estado NOT IN ('CANCELADA','COMPLETADA')
         ORDER BY c.inicio ASC
         LIMIT 10`,
        [clinicaId, args.paciente_id, desde]
      );
      return rows.length ? rows : { mensaje: "No se encontraron citas próximas." };
    }

    case "cancelar_cita": {
      const [[cita]] = await pool.query(
        "SELECT id, estado FROM citas WHERE id = ? AND clinica_id = ?",
        [args.cita_id, clinicaId]
      );
      if (!cita) return { ok: false, error: "Cita no encontrada." };
      if (["CANCELADA", "COMPLETADA"].includes(cita.estado))
        return { ok: false, error: `La cita ya está en estado ${cita.estado}.` };

      const motivo = args.motivo || "Cancelada mediante asistente virtual";
      await pool.query(
        "UPDATE citas SET estado = 'CANCELADA', notas_internas = CONCAT(COALESCE(notas_internas,''), ' | Cancelación: ', ?) WHERE id = ?",
        [motivo, args.cita_id]
      );
      return { ok: true, mensaje: `Cita #${args.cita_id} cancelada exitosamente.` };
    }

    default:
      return { error: "Herramienta no reconocida" };
  }
}

// ─────────────────────────────────────────────
// POST /api/ia/chat
// ─────────────────────────────────────────────
router.post("/chat", async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { sesion_id, mensaje } = req.body;
    if (!mensaje)   return res.status(400).json({ ok: false, msg: "mensaje requerido" });
    if (!sesion_id) return res.status(400).json({ ok: false, msg: "sesion_id requerido" });

    // Historial de la sesión (últimos 20 mensajes user/assistant)
    const [historial] = await pool.query(
      `SELECT rol, contenido FROM ia_conversaciones
       WHERE clinica_id=? AND sesion_id=? AND rol IN ('user','assistant')
       ORDER BY creado_en ASC LIMIT 20`,
      [clinicaId, sesion_id]
    );

    const [[clinica]] = await pool.query("SELECT nombre, telefono FROM clinicas WHERE id=?", [clinicaId]);

    const hoy = new Date().toLocaleDateString("es-PE", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const systemPrompt = `Eres el asistente virtual de "${clinica?.nombre || "la clínica"}". Hoy es ${hoy}.
Puedes ayudar a los pacientes y personal a:
- Obtener información de servicios, médicos, especialidades y precios
- Verificar disponibilidad de horarios
- Agendar nuevas citas (siempre confirma los datos antes de crear)
- Consultar las próximas citas de un paciente
- Cancelar una cita (siempre pide confirmación antes de cancelar)

Reglas:
- Responde siempre en español, de forma amable y concisa.
- NO inventes información médica ni diagnósticos.
- Para emergencias indica que llamen al ${clinica?.telefono || "la clínica"} o vayan a urgencias.
- Antes de cancelar una cita, muestra los detalles y pide confirmación explícita.
- Si el usuario pide agendar, busca primero la disponibilidad y luego el paciente.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...historial.map(h => ({ role: h.rol, content: h.contenido })),
      { role: "user", content: mensaje },
    ];

    // Guardar mensaje del usuario
    await pool.query(
      "INSERT INTO ia_conversaciones (clinica_id, sesion_id, rol, contenido) VALUES (?,?,?,?)",
      [clinicaId, sesion_id, "user", mensaje]
    );

    // Loop de function calling (max 5 rondas)
    let respuestaFinal = "";
    let totalTokens = 0;
    const openai = getOpenAI();

    for (let i = 0; i < 5; i++) {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: Number(process.env.OPENAI_MAX_TOKENS || 2000),
      });

      totalTokens += response.usage?.total_tokens || 0;
      const msg = response.choices[0].message;
      messages.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        respuestaFinal = msg.content || "";
        break;
      }

      for (const tc of msg.tool_calls) {
        const args     = JSON.parse(tc.function.arguments || "{}");
        const resultado = await ejecutarHerramienta(tc.function.name, args, clinicaId);

        await pool.query(
          "INSERT INTO ia_conversaciones (clinica_id,sesion_id,rol,contenido,tool_calls,tool_result) VALUES (?,?,?,?,?,?)",
          [clinicaId, sesion_id, "tool", `Tool: ${tc.function.name}`,
           JSON.stringify(msg.tool_calls), JSON.stringify(resultado)]
        );

        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(resultado) });
      }
    }

    // Guardar respuesta del asistente
    await pool.query(
      "INSERT INTO ia_conversaciones (clinica_id,sesion_id,rol,contenido,tokens_usados) VALUES (?,?,?,?,?)",
      [clinicaId, sesion_id, "assistant", respuestaFinal, totalTokens]
    );

    res.json({ ok: true, respuesta: respuestaFinal, tokens: totalTokens });
  } catch (e) {
    console.error("[ia/chat]", e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/ia/historial?sesion_id=...
router.get("/historial", async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { sesion_id } = req.query;
    if (!sesion_id) return res.status(400).json({ ok: false, msg: "sesion_id requerido" });

    const [rows] = await pool.query(
      `SELECT rol, contenido, creado_en FROM ia_conversaciones
       WHERE clinica_id=? AND sesion_id=? AND rol IN ('user','assistant')
       ORDER BY creado_en ASC`,
      [clinicaId, sesion_id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Banco de frases SOAP por especialidad (fallback sin OpenAI)
// ═══════════════════════════════════════════════════════════════════════════════
const FRASES_SOAP = {
  "Medicina General": {
    subjetivo: [
      "sin alergias medicamentosas conocidas.",
      "con evolución de aproximadamente 3 días.",
      "niega fiebre, náuseas o vómitos asociados.",
      "refiere mejoría parcial con analgésicos de venta libre.",
      "presenta los síntomas desde hace 48 horas sin factores desencadenantes claros.",
    ],
    objetivo: [
      "Al examen: buen estado general, consciente y orientado en tiempo y espacio.",
      "Tórax simétrico, sin tirajes. Murmullo vesicular conservado bilateralmente.",
      "Abdomen blando, depresible, no doloroso a la palpación profunda. RHA presentes.",
      "Faringe hiperémica sin exudados. Amígdalas sin hipertrofia.",
      "Sin adenopatías cervicales palpables. Piel y mucosas bien hidratadas.",
    ],
    plan: [
      "Control en 7 días o antes si presenta fiebre > 38.5°C o empeoramiento.",
      "Hidratación adecuada, reposo relativo 48 horas.",
      "Evitar automedicación. Acudir a urgencias si hay dificultad respiratoria.",
      "Dieta blanda, abundantes líquidos. Seguimiento por consulta externa.",
    ],
  },
  "Pediatría": {
    subjetivo: [
      "Madre refiere que el niño presenta los síntomas desde hace 2 días.",
      "sin antecedentes patológicos de importancia hasta la fecha.",
      "vacunas al día según esquema nacional de inmunizaciones.",
      "niega alergias medicamentosas conocidas. Desarrollo psicomotor normal para la edad.",
      "sin hospitalizaciones previas. Alimentación adecuada para la edad.",
    ],
    objetivo: [
      "Paciente activo, reactivo, hidratado. Llanto fuerte. RCTD.",
      "Otoscopia: membrana timpánica íntegra bilateralmente, sin signos inflamatorios.",
      "Sin signos de dificultad respiratoria. SpO2 98% a aire ambiente.",
      "Fontanela anterior normotensa, de dimensiones adecuadas para la edad.",
      "Peso y talla en percentil adecuado para la edad.",
    ],
    plan: [
      "Paracetamol 15 mg/kg/dosis cada 6 horas según fiebre.",
      "Control en 48-72 horas o antes si persiste o se agrava la sintomatología.",
      "Lactancia materna/fórmula a libre demanda. Hidratación oral abundante.",
      "Signos de alarma explicados a los padres. Consultar si dificultad respiratoria.",
    ],
  },
  "Endocrinología": {
    subjetivo: [
      "con glucemias en ayunas reportadas entre 180-250 mg/dL en controles domiciliarios.",
      "refiere poliuria, polidipsia y pérdida de peso no intencional.",
      "en control con metformina 850 mg cada 12 horas con buena tolerancia.",
      "sin episodios de hipoglucemia en las últimas semanas.",
      "cumple dieta y actividad física indicadas. HbA1c en objetivo.",
    ],
    objetivo: [
      "Al examen: normopeso, PA controlada, sin alteraciones tiroideas palpables.",
      "Sin retención de líquidos. Reflejos osteotendinosos conservados.",
      "No presenta lesiones cutáneas sugestivas de complicaciones metabólicas.",
    ],
    plan: [
      "Ajuste de dosis según glucometría de 7 puntos. Control HbA1c en 3 meses.",
      "Dieta baja en carbohidratos refinados. Actividad física 30 min/día 5 veces/semana.",
      "Control oftalmológico anual y podológico semestral.",
      "Ecografía tiroidea solicitada. Control con resultados en 4 semanas.",
    ],
  },
  "Ginecología": {
    subjetivo: [
      "con ciclos menstruales regulares de 28 días, sangrado de 4-5 días.",
      "FUR hace ___ días. Niega dispareunia, leucorrea patológica ni sangrado intermenstrual.",
      "en uso de anticonceptivos orales sin efectos adversos reportados.",
      "G_P_A_. Último control ginecológico hace ___ años.",
      "sin síntomas genitourinarios ni molestias pélvicas actualmente.",
    ],
    objetivo: [
      "Genitales externos sin lesiones visibles. Especuloscopia: cuello sin lesiones aparentes.",
      "Útero en AVF, de tamaño normal, móvil y no doloroso a la movilización.",
      "Mamas simétricas, sin tumoraciones palpables, sin descarga por el pezón.",
      "Anexos no palpables. Sin masas ni adenopatías inguinales.",
    ],
    plan: [
      "Papanicolaou realizado hoy. Resultados disponibles en 2-3 semanas.",
      "Control anual o antes si presenta sintomatología.",
      "Ecografía pélvica transvaginal solicitada. Resultado en próxima consulta.",
      "Anticoncepción actual mantenida. Consejería sobre salud sexual brindada.",
    ],
  },
  "Cardiología": {
    subjetivo: [
      "con historia de hipertensión arterial en tratamiento farmacológico.",
      "niega angina de reposo, ortopnea ni disnea paroxística nocturna.",
      "en tratamiento con enalapril 10 mg/día y atorvastatina 40 mg/noche.",
      "cumple dieta hiposódica y restricción de grasas saturadas.",
      "automonitoreo de PA en domicilio con valores entre 120-140/80-90 mmHg.",
    ],
    objetivo: [
      "Ruidos cardíacos rítmicos, normofonéticos, sin soplos audibles.",
      "No ingurgitación yugular. Pulsos periféricos presentes y simétricos.",
      "Sin edemas en miembros inferiores. ECG: ritmo sinusal sin alteraciones agudas.",
      "PA controlada en este momento. FC dentro de límites normales.",
    ],
    plan: [
      "Meta de PA < 130/80 mmHg. Autocontrol diario con registro.",
      "Ecocardiograma transtorácico solicitado para evaluación de función ventricular.",
      "Dieta DASH, restricción de sodio < 2 g/día. Actividad aeróbica moderada.",
      "Control en 1 mes con exámenes de laboratorio: perfil lipídico, función renal.",
    ],
  },
  "Traumatología": {
    subjetivo: [
      "refiere dolor de intensidad 7/10 que aumenta con la movilización.",
      "mecanismo de lesión: trauma directo / caída / movimiento en falso.",
      "sin pérdida de conocimiento posterior al traumatismo.",
      "niega parestesias o déficit motor en el miembro afectado.",
      "no ha recibido tratamiento analgésico previo a la consulta.",
    ],
    objetivo: [
      "Zona afectada con edema moderado, eritema y aumento de temperatura local.",
      "Rango de movimiento articular limitado por dolor. Sin crepitaciones palpables.",
      "Pulsos distales conservados. Sensibilidad y motricidad íntegras.",
      "Radiografía sin evidencia de fractura ósea. Partes blandas con edema.",
    ],
    plan: [
      "RICE: reposo, hielo 15 min c/2h, compresión y elevación del miembro.",
      "Antiinflamatorio + analgésico por 5-7 días. Protección articular con vendaje.",
      "Control radiológico en 10 días. Fisioterapia después de la fase aguda.",
      "Restricción de actividad física intensa por 3 semanas.",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/ia/soap-sugerencia
// Predicción de texto para campos SOAP — usa GPT-4o-mini si hay API key,
// si no, devuelve una frase del banco local según especialidad.
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/soap-sugerencia", auth(), async (req, res) => {
  try {
    const {
      campo = "",
      texto = "",
      especialidad = "Medicina General",
      diagnostico_cie = "",
      diagnostico_desc = "",
    } = req.body;

    if (!texto || texto.trim().length < 8) return res.json({ ok: true, sugerencia: "" });

    // ── Con OpenAI ─────────────────────────────────────────────────────────────
    if (process.env.OPENAI_API_KEY) {
      const openai = getOpenAI();
      const campoLabel = {
        subjetivo: "Subjetivo (síntomas referidos por el paciente)",
        objetivo:  "Objetivo (hallazgos al examen físico)",
        plan:      "Plan (tratamiento, indicaciones y seguimiento)",
      }[campo] || campo;

      const dxContext = diagnostico_cie
        ? `Diagnóstico activo: ${diagnostico_cie} — ${diagnostico_desc}.`
        : "";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Eres un asistente de documentación clínica para médicos de ${especialidad}.
El médico está escribiendo la sección "${campoLabel}" de una nota SOAP. ${dxContext}
Tu tarea: continúa el texto de forma natural, clínica y concisa.
Reglas:
- Devuelve SOLO la continuación (no repitas lo ya escrito).
- Máximo 2-3 oraciones cortas.
- En español, tono médico profesional.
- Sin markdown, asteriscos ni numeraciones.`,
          },
          { role: "user", content: texto.trim() },
        ],
        max_tokens: 100,
        temperature: 0.35,
      });

      const sugerencia = completion.choices[0]?.message?.content?.trim() || "";
      return res.json({ ok: true, sugerencia });
    }

    // ── Sin OpenAI: banco de frases local ──────────────────────────────────────
    const bancoPorEspecialidad = FRASES_SOAP[especialidad] || FRASES_SOAP["Medicina General"];
    const opciones = bancoPorEspecialidad[campo] || [];
    if (!opciones.length) return res.json({ ok: true, sugerencia: "" });

    const textoLow = texto.toLowerCase();
    const candidatas = opciones.filter(f =>
      !textoLow.includes(f.toLowerCase().slice(0, 15))
    );
    if (!candidatas.length) return res.json({ ok: true, sugerencia: "" });

    const sugerencia = candidatas[Math.floor(Math.random() * candidatas.length)];
    return res.json({ ok: true, sugerencia });

  } catch (e) {
    // Nunca exponer errores al usuario — la sugerencia es opcional
    return res.json({ ok: true, sugerencia: "" });
  }
});

module.exports = router;
