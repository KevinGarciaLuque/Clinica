const router    = require("express").Router();
const pool      = require("../db");
const rateLimit = require("express-rate-limit");
const sse       = require("../utils/sseManager");
const webPush   = require("../utils/webPush");

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta de nuevo en 15 minutos." },
});

const agendarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Has enviado demasiadas solicitudes de cita. Intenta más tarde." },
});

async function notificarSolicitudCita({ clinicaId, pacienteNombre, inicio, citaId }) {
  try {
    const [usuarios] = await pool.query(
      `SELECT id FROM usuarios WHERE clinica_id = ? AND activo = 1 AND tipo <> 'SUPER_ADMIN'`,
      [clinicaId]
    );
    if (!usuarios.length) return;

    const fechaLabel = new Date(inicio).toLocaleString("es-HN", {
      dateStyle: "medium", timeStyle: "short",
    });
    const mensaje = `Nueva solicitud de cita de ${pacienteNombre} para el ${fechaLabel}`;
    const tipo    = "CITA_SOLICITUD_PORTAL";

    const values = usuarios.map((u) => [u.id, clinicaId, tipo, mensaje, null, citaId]);
    await pool.query(
      `INSERT INTO notificaciones_usuario (usuario_id, clinica_id, tipo, mensaje, paciente_id, cita_id) VALUES ?`,
      [values]
    );

    for (const u of usuarios) {
      sse.notifyUser(u.id, "notificacion_portal", { tipo, mensaje, cita_id: citaId });
    }

    await webPush.sendToUsers(
      pool,
      usuarios.map((u) => u.id),
      { title: "Solicitud de cita", body: mensaje, tag: tipo, data: { tipo, cita_id: citaId, url: "/citas" } }
    );
  } catch (e) {
    console.error("[notificarSolicitudCita]", e.message);
  }
}

// ─── GET /api/public/clinica/:slug ──────────────────────────────────────────
router.get("/clinica/:slug", publicLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const [[clinica]] = await pool.query(
      `SELECT id, nombre, slug, logo_url, email, telefono, ciudad, pais
       FROM clinicas WHERE slug = ? AND activo = 1 LIMIT 1`,
      [slug]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const [config] = await pool.query(
      `SELECT clave, valor FROM clinica_config
       WHERE clinica_id = ? AND clave IN (
         'perfil_descripcion','perfil_nombre_doctor','perfil_titulo_doctor',
         'perfil_whatsapp','perfil_instagram','perfil_tiktok',
         'perfil_facebook','perfil_google_maps','perfil_foto_doctor',
         'perfil_color_primario','perfil_agendar_activo'
       )`,
      [clinica.id]
    );

    const cfg = {};
    config.forEach(r => { cfg[r.clave] = r.valor; });

    if (!cfg.perfil_foto_doctor) {
      const [[medico]] = await pool.query(
        `SELECT foto_url FROM usuarios
         WHERE clinica_id = ? AND activo = 1 AND tipo IN ('MEDICO','ADMIN','PSICOLOGO')
         ORDER BY FIELD(tipo,'MEDICO','PSICOLOGO','ADMIN') ASC, id ASC LIMIT 1`,
        [clinica.id]
      );
      if (medico?.foto_url) cfg.perfil_foto_doctor = medico.foto_url;
    }

    res.json({ ok: true, data: { ...clinica, perfil: cfg } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ─── GET /api/public/directorio ─────────────────────────────────────────────
// Lista de médicos que optaron por aparecer en el directorio de medickg.com
router.get("/directorio", publicLimiter, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.slug, c.ciudad, c.pais,
              MAX(CASE WHEN cc.clave='perfil_nombre_doctor'  THEN cc.valor END) AS nombre_doctor,
              MAX(CASE WHEN cc.clave='perfil_titulo_doctor'  THEN cc.valor END) AS titulo_doctor,
              MAX(CASE WHEN cc.clave='perfil_descripcion'    THEN cc.valor END) AS descripcion,
              MAX(CASE WHEN cc.clave='perfil_foto_doctor'    THEN cc.valor END) AS foto_doctor,
              MAX(CASE WHEN cc.clave='perfil_color_primario' THEN cc.valor END) AS color_primario
       FROM clinicas c
       JOIN clinica_config cc ON cc.clinica_id = c.id
       WHERE c.activo = 1
         AND c.id IN (
           SELECT clinica_id FROM clinica_config
           WHERE clave = 'perfil_mostrar_directorio' AND valor = '1'
         )
       GROUP BY c.id
       ORDER BY nombre_doctor ASC`
    );

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ─── GET /api/public/clinica/:slug/servicios ────────────────────────────────
router.get("/clinica/:slug/servicios", publicLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const [[clinica]] = await pool.query(
      "SELECT id FROM clinicas WHERE slug = ? AND activo = 1 LIMIT 1", [slug]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const [servicios] = await pool.query(
      `SELECT id, nombre, descripcion FROM catalogos_tipos_cita
       WHERE clinica_id = ? AND activo = 1 ORDER BY orden ASC, nombre ASC`,
      [clinica.id]
    );
    res.json({ ok: true, data: servicios });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ─── GET /api/public/clinica/:slug/medicos ──────────────────────────────────
// Devuelve médicos activos con sus días disponibles
router.get("/clinica/:slug/medicos", publicLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const [[clinica]] = await pool.query(
      "SELECT id FROM clinicas WHERE slug = ? AND activo = 1 LIMIT 1", [slug]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const [medicos] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos, u.foto_url, e.nombre AS especialidad
       FROM usuarios u
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE u.clinica_id = ? AND u.activo = 1 AND u.tipo IN ('MEDICO','PSICOLOGO')
       ORDER BY u.nombres`,
      [clinica.id]
    );

    // Días disponibles por médico (0=Lun,...,6=Dom)
    const [horarios] = await pool.query(
      `SELECT medico_id, dia_semana FROM horarios_medico
       WHERE clinica_id = ? AND activo = 1
       GROUP BY medico_id, dia_semana`,
      [clinica.id]
    );

    const diasPorMedico = {};
    horarios.forEach(h => {
      if (!diasPorMedico[h.medico_id]) diasPorMedico[h.medico_id] = [];
      diasPorMedico[h.medico_id].push(h.dia_semana);
    });

    const data = medicos.map(m => ({
      ...m,
      dias_disponibles: diasPorMedico[m.id] || [],
    }));

    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ─── GET /api/public/clinica/:slug/slots?medico_id=X&fecha=YYYY-MM-DD ───────
router.get("/clinica/:slug/slots", publicLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const { medico_id, fecha } = req.query;

    if (!medico_id || !fecha) {
      return res.status(400).json({ ok: false, msg: "medico_id y fecha son obligatorios" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ ok: false, msg: "Formato de fecha inválido" });
    }

    const fechaDate = new Date(fecha + "T12:00:00Z");
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const maxFecha = new Date(); maxFecha.setMonth(maxFecha.getMonth() + 3);
    if (isNaN(fechaDate) || fechaDate < hoy || fechaDate > maxFecha) {
      return res.status(400).json({ ok: false, msg: "Fecha fuera del rango permitido" });
    }

    const medicoIdInt = parseInt(medico_id, 10);
    if (!medicoIdInt || medicoIdInt <= 0) {
      return res.status(400).json({ ok: false, msg: "medico_id inválido" });
    }

    const [[clinica]] = await pool.query(
      "SELECT id FROM clinicas WHERE slug = ? AND activo = 1 LIMIT 1", [slug]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const clinicaId = clinica.id;

    const [[tzRow]] = await pool.query(
      "SELECT valor FROM clinica_config WHERE clinica_id=? AND clave='zona_horaria'",
      [clinicaId]
    );
    const tz = tzRow?.valor || "America/Tegucigalpa";

    const nombreDia = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
      .format(new Date(fecha + "T12:00:00Z"));
    const WD_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const diaJS    = WD_MAP[nombreDia];
    const diaLunes = diaJS === 0 ? 6 : diaJS - 1;

    const [horarios] = await pool.query(
      `SELECT hora_inicio, hora_fin, slot_minutos FROM horarios_medico
       WHERE medico_id=? AND clinica_id=? AND dia_semana=? AND activo=1`,
      [medicoIdInt, clinicaId, diaLunes]
    );
    if (!horarios.length) return res.json({ ok: true, data: [] });

    const [ocupadas] = await pool.query(
      `SELECT inicio, fin FROM citas
       WHERE clinica_id=? AND medico_id=? AND DATE(inicio)=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION','PENDIENTE_APROBACION')`,
      [clinicaId, medicoIdInt, fecha]
    );

    const toLocalISO = d => {
      const p = n => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
    };

    const slots = [];
    for (const h of horarios) {
      let cursor = new Date(`${fecha}T${h.hora_inicio}`);
      const fin  = new Date(`${fecha}T${h.hora_fin}`);
      while (cursor < fin) {
        const slotFin = new Date(cursor.getTime() + h.slot_minutos * 60000);
        const ocup = ocupadas.some(
          c => new Date(c.inicio) < slotFin && new Date(c.fin) > cursor
        );
        if (!ocup) {
          slots.push({
            inicio: toLocalISO(cursor),
            fin:    toLocalISO(slotFin),
            label:  `${cursor.toTimeString().slice(0,5)} - ${slotFin.toTimeString().slice(0,5)}`,
          });
        }
        cursor = slotFin;
      }
    }

    res.json({ ok: true, data: slots });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ─── POST /api/public/clinica/:slug/agendar ─────────────────────────────────
router.post("/clinica/:slug/agendar", agendarLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const { nombres, apellidos, telefono, email, medico_id, inicio, fin, servicio_id, motivo } = req.body;

    if (!nombres || !apellidos || !telefono || !medico_id || !inicio || !fin) {
      return res.status(400).json({ ok: false, msg: "Faltan campos obligatorios" });
    }

    if (String(nombres).length > 80 || String(apellidos).length > 80) {
      return res.status(400).json({ ok: false, msg: "Nombre o apellido demasiado largo" });
    }
    if (String(telefono).length > 20) {
      return res.status(400).json({ ok: false, msg: "Teléfono inválido" });
    }
    if (email && String(email).length > 120) {
      return res.status(400).json({ ok: false, msg: "Email inválido" });
    }
    if (motivo && String(motivo).length > 500) {
      return res.status(400).json({ ok: false, msg: "El motivo no puede superar 500 caracteres" });
    }

    const medicoIdInt = parseInt(medico_id, 10);
    if (!medicoIdInt || medicoIdInt <= 0) {
      return res.status(400).json({ ok: false, msg: "medico_id inválido" });
    }

    const [[clinica]] = await pool.query(
      "SELECT id FROM clinicas WHERE slug = ? AND activo = 1 LIMIT 1", [slug]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    // Verificar que el perfil público tiene activo el agendado de citas
    const [[cfgAgendar]] = await pool.query(
      "SELECT valor FROM clinica_config WHERE clinica_id=? AND clave='perfil_agendar_activo' LIMIT 1",
      [clinica.id]
    );
    if (cfgAgendar && cfgAgendar.valor === "0") {
      return res.status(403).json({ ok: false, msg: "El agendado de citas no está disponible en este momento." });
    }

    const clinicaId = clinica.id;

    // Verificar que el médico pertenece a la clínica
    const [[medico]] = await pool.query(
      "SELECT id FROM usuarios WHERE id=? AND clinica_id=? AND activo=1 LIMIT 1",
      [medicoIdInt, clinicaId]
    );
    if (!medico) return res.status(400).json({ ok: false, msg: "Médico no encontrado" });

    // Verificar que el slot sigue disponible (incluye solicitudes pendientes de aprobación)
    const [solap] = await pool.query(
      `SELECT id FROM citas
       WHERE clinica_id=? AND medico_id=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION','PENDIENTE_APROBACION')
         AND NOT (fin <= ? OR inicio >= ?)
       LIMIT 1`,
      [clinicaId, medicoIdInt, inicio, fin]
    );
    if (solap.length) {
      return res.status(409).json({ ok: false, msg: "Este horario ya no está disponible. Por favor elige otro." });
    }

    // Buscar paciente existente por teléfono en la clínica
    let pacienteId;
    const [[pacExistente]] = await pool.query(
      "SELECT id FROM pacientes WHERE clinica_id=? AND telefono=? LIMIT 1",
      [clinicaId, telefono]
    );

    if (pacExistente) {
      pacienteId = pacExistente.id;
    } else {
      // Crear paciente nuevo
      const [ins] = await pool.query(
        `INSERT INTO pacientes (clinica_id, nombres, apellidos, telefono, email)
         VALUES (?,?,?,?,?)`,
        [clinicaId, nombres.trim(), apellidos.trim(), telefono.trim(), email?.trim() || null]
      );
      pacienteId = ins.insertId;
    }

    // Crear la cita en estado PENDIENTE_APROBACION — el doctor debe aceptarla desde la campana
    const [citaRes] = await pool.query(
      `INSERT INTO citas (clinica_id, paciente_id, medico_id, inicio, fin, tipo_consulta, motivo, canal, servicio_id, estado)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [clinicaId, pacienteId, medicoIdInt, inicio, fin,
       "CONSULTA", motivo?.trim() || null, "PORTAL", servicio_id || null, "PENDIENTE_APROBACION"]
    );

    await notificarSolicitudCita({
      clinicaId,
      pacienteNombre: `${nombres.trim()} ${apellidos.trim()}`,
      inicio,
      citaId: citaRes.insertId,
    });

    res.status(201).json({ ok: true, id: citaRes.insertId, msg: "¡Tu solicitud fue enviada! El doctor confirmará tu cita pronto." });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
