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

      const slots = [];
      for (const h of horarios) {
        let cursor = new Date(`${fechaReal}T${h.hora_inicio}`);
        const fin  = new Date(`${fechaReal}T${h.hora_fin}`);
        while (cursor < fin) {
          const slotFin = new Date(cursor.getTime() + h.slot_minutos * 60000);
          const ocup = ocupadas.some(c => new Date(c.inicio) < slotFin && new Date(c.fin) > cursor);
          if (!ocup) slots.push({ inicio: cursor.toISOString(), fin: slotFin.toISOString() });
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
        `SELECT c.id, c.inicio, c.fin, c.tipo_consulta, c.estado, c.motivo,
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

module.exports = router;
