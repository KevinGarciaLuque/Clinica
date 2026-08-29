/**
 * /api/registro   — Portal self-service de registro de pacientes
 *
 * POST /api/registro
 *   Body: { nombres, apellidos, dni, fecha_nacimiento, sexo, telefono, email,
 *           direccion, ciudad, pais, grupo_sanguineo, clinica_id }
 *   → Crea el paciente (sin auth) y envía email de verificación
 *
 * GET  /api/registro/verificar/:token
 *   → Activa email_verificado=1 del paciente
 *
 * POST /api/registro/reenviar
 *   Body: { email, clinica_id }
 *   → Reenvía el email de verificación
 */

const router  = require("express").Router();
const pool    = require("../db");
const { v4: uuidv4 } = require("uuid");
const jwt     = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { enviarEmail, templateVerificacion, templateBienvenida } = require("../utils/mailer");
const upload  = require("../middlewares/upload");
const cloudinary  = require("../utils/cloudinary");
const streamifier = require("streamifier");
const fs      = require("fs");
const path    = require("path");
const sse     = require("../utils/sseManager");
const webPush = require("../utils/webPush");

// ── Rate limiters ─────────────────────────────────────────
const limiterStrict = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta en 15 minutos." },
});
const limiterModerate = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta en 15 minutos." },
});

// ── Helper: genera session token para el paciente ────────
const SESSION_SECRET = process.env.JWT_SECRET || "clinica_session_fallback";
function generarSessionToken(pacienteId, clinicaId) {
  return jwt.sign(
    { paciente_id: pacienteId, clinica_id: clinicaId, tipo: "registro_session" },
    SESSION_SECRET,
    { expiresIn: "2h" }
  );
}

// ── Helper: valida session token ─────────────────────────
function validarSessionToken(req, res) {
  const token = req.headers["x-session-token"] || req.query.session_token || req.body?.session_token;
  if (!token) {
    res.status(401).json({ ok: false, msg: "Token de sesión requerido" });
    return null;
  }
  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    if (payload.tipo !== "registro_session") throw new Error("tipo inválido");
    return payload;
  } catch {
    res.status(401).json({ ok: false, msg: "Sesión inválida o expirada. Por favor vuelve a verificar tu identidad." });
    return null;
  }
}

async function crearNotificacionesPortal({
  clinicaId,
  tipo,
  mensaje,
  pacienteId = null,
  citaId = null,
}) {
  try {
    const [usuarios] = await pool.query(
      `SELECT id
       FROM usuarios
       WHERE clinica_id = ? AND activo = 1 AND tipo <> 'SUPER_ADMIN'`,
      [clinicaId]
    );
    if (!usuarios.length) return;

    const values = usuarios.map((u) => [u.id, clinicaId, tipo, mensaje, pacienteId, citaId]);
    await pool.query(
      `INSERT INTO notificaciones_usuario
       (usuario_id, clinica_id, tipo, mensaje, paciente_id, cita_id)
       VALUES ?`,
      [values]
    );

    for (const u of usuarios) {
      sse.notifyUser(u.id, "notificacion_portal", {
        tipo,
        mensaje,
        paciente_id: pacienteId,
        cita_id: citaId,
      });
    }

    await webPush.sendToUsers(
      pool,
      usuarios.map((u) => u.id),
      {
        title: "Nueva notificación",
        body: mensaje,
        tag: tipo,
        data: { tipo, paciente_id: pacienteId, cita_id: citaId, url: "/citas" },
      }
    );
  } catch (e) {
    console.error("[notificacion_portal]", e.message);
  }
}

// ── Helper: crea token y envía email ──────────────────────
async function crearYEnviarToken(pacienteId, clinicaId, email, nombres, apellidos, conn) {
  const token    = uuidv4();
  const expires  = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

  // Invalida tokens previos del mismo paciente
  await conn.query(
    "UPDATE verificaciones_email SET usado=1 WHERE paciente_id=? AND usado=0",
    [pacienteId]
  );

  await conn.query(
    `INSERT INTO verificaciones_email (paciente_id, clinica_id, token, expires_at)
     VALUES (?,?,?,?)`,
    [pacienteId, clinicaId, token, expires]
  );

  // Obtiene info de la clínica para el email
  const [[clinica]] = await conn.query(
    "SELECT nombre FROM clinicas WHERE id=? LIMIT 1",
    [clinicaId]
  );

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${frontendUrl}/verificar-email?token=${token}`;

  await enviarEmail({
    to:      email,
    subject: "Confirma tu registro",
    html:    templateVerificacion({
               nombres, apellidos, link,
               clinicaNombre: clinica?.nombre,
             }),
  });

  return token;
}

// ══════════════════════════════════════════════════════════
// POST /api/registro  — Registro público
// ══════════════════════════════════════════════════════════
router.post("/", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      nombres, apellidos, dni, fecha_nacimiento, sexo,
      telefono, email, direccion, ciudad,
      departamento, municipio,
      pais = "Honduras", grupo_sanguineo, clinica_id,
    } = req.body;

    const ciudadFinal = municipio?.trim() || ciudad?.trim() || null;

    // ── Validaciones básicas ────────────────────────────
    if (!nombres?.trim() || !apellidos?.trim())
      return res.status(400).json({ ok: false, msg: "Nombres y apellidos son obligatorios" });

    if (!email?.trim())
      return res.status(400).json({ ok: false, msg: "El email es obligatorio" });

    if (!clinica_id)
      return res.status(400).json({ ok: false, msg: "clinica_id es obligatorio" });

    // ── Validar que la clínica exista ───────────────────
    const [[clinica]] = await conn.query(
      "SELECT id FROM clinicas WHERE id=? LIMIT 1",
      [clinica_id]
    );
    if (!clinica)
      return res.status(400).json({ ok: false, msg: "Clínica no encontrada" });

    // ── Email duplicado en esta clínica ─────────────────
    const [[dup]] = await conn.query(
      "SELECT id FROM pacientes WHERE email=? AND clinica_id=? LIMIT 1",
      [email.trim().toLowerCase(), clinica_id]
    );
    if (dup)
      return res.status(409).json({ ok: false, msg: "Ya existe un paciente con ese email en esta clínica" });

    await conn.beginTransaction();

    // ── Insertar paciente ───────────────────────────────
    const [r] = await conn.query(
      `INSERT INTO pacientes
         (clinica_id, nombres, apellidos, dni, fecha_nacimiento, sexo,
          telefono, email, direccion, ciudad, pais, grupo_sanguineo,
          email_verificado, registro_self, activo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,1,1)`,
      [
        clinica_id,
        nombres.trim(),
        apellidos.trim(),
        dni?.trim()   || null,
        fecha_nacimiento || null,
        sexo            || null,
        telefono?.trim() || null,
        email.trim().toLowerCase(),
        direccion?.trim() || null,
        ciudadFinal,
        pais,
        grupo_sanguineo   || null,
      ]
    );

    const pacienteId = r.insertId;

    // ── Token + email de verificación ──────────────────
    // El fallo de SMTP no debe impedir el registro del paciente
    let emailEnviado = true;
    try {
      await crearYEnviarToken(pacienteId, clinica_id, email, nombres, apellidos, conn);
    } catch (emailErr) {
      emailEnviado = false;
      console.error("[POST /registro] Error al enviar email de verificación:", emailErr.message);
    }

    await conn.commit();

    const sessionToken = generarSessionToken(pacienteId, clinica_id);

    await crearNotificacionesPortal({
      clinicaId: clinica_id,
      tipo: "PACIENTE_REGISTRO_PORTAL",
      mensaje: "Se registró paciente desde link",
      pacienteId,
    });

    res.status(201).json({
      ok:  true,
      msg: emailEnviado
        ? "Registro exitoso. Revisa tu correo para verificar tu cuenta."
        : "Registro exitoso. El email de verificación no pudo enviarse; el personal de la clínica activará tu cuenta.",
      id:  pacienteId,
      session_token: sessionToken,
      email_enviado: emailEnviado,
    });
  } catch (e) {
    await conn.rollback();
    console.error("[POST /registro]", e);
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/registro/verificar/:token
// ══════════════════════════════════════════════════════════
router.get("/verificar/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [[rv]] = await pool.query(
      `SELECT rv.*, p.nombres, p.apellidos, p.email, p.clinica_id
       FROM verificaciones_email rv
       JOIN pacientes p ON p.id = rv.paciente_id
       WHERE rv.token = ? LIMIT 1`,
      [token]
    );

    if (!rv)
      return res.status(404).json({ ok: false, msg: "Token inválido o inexistente" });

    if (rv.usado)
      return res.status(400).json({ ok: false, msg: "Este enlace ya fue utilizado", ya_verificado: true });

    if (new Date() > new Date(rv.expires_at))
      return res.status(400).json({ ok: false, msg: "El enlace ha expirado. Solicita uno nuevo.", expirado: true });

    // Marcar verificado
    await pool.query("UPDATE pacientes SET email_verificado=1 WHERE id=?",           [rv.paciente_id]);
    await pool.query("UPDATE verificaciones_email SET usado=1 WHERE id=?",           [rv.id]);

    // Email de bienvenida (no crítico — no bloquea la verificación si falla)
    const [[clinica]] = await pool.query("SELECT nombre FROM clinicas WHERE id=?",   [rv.clinica_id]);
    try {
      await enviarEmail({
        to:      rv.email,
        subject: "¡Cuenta activada!",
        html:    templateBienvenida({ nombres: rv.nombres, clinicaNombre: clinica?.nombre }),
      });
    } catch (emailErr) {
      console.error("[GET /registro/verificar] Email bienvenida falló:", emailErr.message);
    }

    res.json({ ok: true, msg: "Email verificado correctamente. ¡Bienvenido/a!", nombres: rv.nombres });
  } catch (e) {
    console.error("[GET /registro/verificar]", e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/registro/reenviar  — Reenvía verificación
// ══════════════════════════════════════════════════════════
router.post("/reenviar", limiterStrict, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { email, clinica_id } = req.body;
    if (!email || !clinica_id)
      return res.status(400).json({ ok: false, msg: "email y clinica_id son requeridos" });

    const [[p]] = await conn.query(
      "SELECT * FROM pacientes WHERE email=? AND clinica_id=? LIMIT 1",
      [email.trim().toLowerCase(), clinica_id]
    );
    if (!p)
      return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    if (p.email_verificado)
      return res.status(400).json({ ok: false, msg: "El email ya está verificado" });

    await crearYEnviarToken(p.id, clinica_id, p.email, p.nombres, p.apellidos, conn);

    res.json({ ok: true, msg: "Email de verificación reenviado" });
  } catch (e) {
    console.error("[POST /registro/reenviar]", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo enviar el email. Verifica la configuración SMTP." });
  } finally {
    conn.release();
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/registro/:id/foto  — Foto de perfil durante registro (sin auth)
// ══════════════════════════════════════════════════════════
router.post("/:id/foto", limiterModerate, upload.single("foto"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });

    const { id }         = req.params;
    const { clinica_id } = req.body;
    if (!clinica_id)
      return res.status(400).json({ ok: false, msg: "clinica_id requerido" });

    // Validar session token — el paciente_id del token debe coincidir con :id
    const session = validarSessionToken(req, res);
    if (!session) return;
    if (String(session.paciente_id) !== String(id) || String(session.clinica_id) !== String(clinica_id))
      return res.status(403).json({ ok: false, msg: "No autorizado" });

    const [[p]] = await pool.query(
      "SELECT id, foto_cloudinary_id FROM pacientes WHERE id=? AND clinica_id=?",
      [id, clinica_id]
    );
    if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    // Eliminar foto anterior de Cloudinary si existe
    if (p.foto_cloudinary_id) {
      try { await cloudinary.uploader.destroy(p.foto_cloudinary_id); } catch { /* ignorar */ }
    }

    // Subir a Cloudinary desde el buffer en memoria
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `clinica/pacientes/${clinica_id}/perfil`, resource_type: "image" },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    await pool.query(
      "UPDATE pacientes SET foto_perfil=?, foto_cloudinary_id=? WHERE id=?",
      [uploadResult.secure_url, uploadResult.public_id, id]
    );

    res.json({ ok: true, foto_perfil: uploadResult.secure_url });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/registro/info?clinica_id=X  — Público
// ══════════════════════════════════════════════════════════
router.get("/info", async (req, res) => {
  try {
    const { clinica_id } = req.query;
    if (!clinica_id)
      return res.status(400).json({ ok: false, msg: "clinica_id es requerido" });

    const [[clinica]] = await pool.query(
      "SELECT nombre, telefono, direccion, titulo_medico FROM clinicas WHERE id=? LIMIT 1",
      [clinica_id]
    );
    if (!clinica)
      return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    // Médico principal: primer MEDICO activo (o ADMIN si no hay médico)
    const [[medico]] = await pool.query(
      `SELECT nombres, apellidos, e.nombre AS especialidad
       FROM usuarios u
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE u.clinica_id=? AND u.activo=1 AND u.tipo IN ('MEDICO','ADMIN','SUPER_ADMIN')
       ORDER BY FIELD(u.tipo,'MEDICO','ADMIN','SUPER_ADMIN'), u.id ASC
       LIMIT 1`,
      [clinica_id]
    );

    res.json({
      ok: true,
      nombre: clinica.nombre,
      telefono: clinica.telefono || null,
      titulo_medico: clinica.titulo_medico == null ? 1 : Number(clinica.titulo_medico),
      medico: medico ? { nombres: medico.nombres, apellidos: medico.apellidos, especialidad: medico.especialidad } : null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/registro/buscar-dni?dni=XXX&clinica_id=X  — Público
// ══════════════════════════════════════════════════════════
router.get("/buscar-dni", limiterStrict, async (req, res) => {
  try {
    const { dni, clinica_id } = req.query;
    if (!dni || !clinica_id)
      return res.status(400).json({ ok: false, msg: "dni y clinica_id son requeridos" });

    const [[p]] = await pool.query(
      "SELECT id, nombres, apellidos, email FROM pacientes WHERE dni=? AND clinica_id=? AND activo=1 LIMIT 1",
      [dni.trim(), clinica_id]
    );
    if (!p)
      return res.status(404).json({ ok: false, encontrado: false, msg: "No se encontró paciente con ese DNI en esta clínica" });

    // Enmascarar email: ana***@gmail.com
    const emailMasked = p.email
      ? p.email.replace(/^(..)(.*?)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.max(b.length, 3)) + c)
      : null;

    const sessionToken = generarSessionToken(p.id, clinica_id);

    res.json({
      ok: true,
      encontrado: true,
      session_token: sessionToken,
      paciente: { id: p.id, nombres: p.nombres, apellidos: p.apellidos, email: emailMasked },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/registro/doctores?clinica_id=X  — Público
// ══════════════════════════════════════════════════════════
router.get("/doctores", async (req, res) => {
  try {
    const { clinica_id } = req.query;
    if (!clinica_id)
      return res.status(400).json({ ok: false, msg: "clinica_id es requerido" });

    const [rows] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos,
              e.nombre AS especialidad
       FROM usuarios u
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE u.clinica_id=? AND u.activo=1 AND u.tipo = 'MEDICO'
       ORDER BY u.apellidos, u.nombres`,
      [clinica_id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/registro/slots?medico_id=X&fecha=YYYY-MM-DD&clinica_id=X  — Público
// ══════════════════════════════════════════════════════════
router.get("/slots", async (req, res) => {
  try {
    const { medico_id, fecha, clinica_id } = req.query;
    if (!medico_id || !fecha || !clinica_id)
      return res.status(400).json({ ok: false, msg: "medico_id, fecha y clinica_id son obligatorios" });

    const [[tzRow]] = await pool.query(
      "SELECT valor FROM clinica_config WHERE clinica_id=? AND clave='zona_horaria'",
      [clinica_id]
    );
    const tz = tzRow?.valor || "America/Tegucigalpa";

    const nombreDia = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
      .format(new Date(fecha + "T12:00:00Z"));
    const WD_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const diaJS    = WD_MAP[nombreDia];
    const diaLunes = diaJS === 0 ? 6 : diaJS - 1; // 0=Lun … 6=Dom

    const [horarios] = await pool.query(
      "SELECT hora_inicio, hora_fin, slot_minutos FROM horarios_medico WHERE medico_id=? AND clinica_id=? AND dia_semana=? AND activo=1",
      [medico_id, clinica_id, diaLunes]
    );
    if (!horarios.length) return res.json({ ok: true, data: [] });

    const [ocupadas] = await pool.query(
      `SELECT inicio, fin FROM citas
       WHERE clinica_id=? AND medico_id=? AND DATE(inicio)=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')`,
      [clinica_id, medico_id, fecha]
    );

    // Convierte "HH:MM:SS" local de la clínica → Date UTC correcto
    const localTimeToUTC = (dateStr, timeStr) => {
      const asUTC    = new Date(`${dateStr}T${timeStr}Z`);
      const localStr = asUTC.toLocaleString("en-US", { timeZone: tz });
      const offset   = asUTC.getTime() - new Date(localStr + " UTC").getTime();
      return new Date(asUTC.getTime() + offset);
    };

    // Formatea un Date UTC como "HH:MM" en la zona horaria de la clínica
    const toTZTime = (d) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(d);
      const h = parts.find(p => p.type === "hour")?.value   || "00";
      const m = parts.find(p => p.type === "minute")?.value || "00";
      return `${h}:${m}`;
    };

    const slots = [];
    for (const h of horarios) {
      let cursor = localTimeToUTC(fecha, h.hora_inicio);
      const fin  = localTimeToUTC(fecha, h.hora_fin);
      while (cursor < fin) {
        const slotFin = new Date(cursor.getTime() + h.slot_minutos * 60000);
        const ocup = ocupadas.some(
          c => new Date(c.inicio) < slotFin && new Date(c.fin) > cursor
        );
        if (!ocup) {
          slots.push({
            inicio: cursor.toISOString(),
            fin:    slotFin.toISOString(),
            label:  toTZTime(cursor) + " - " + toTZTime(slotFin),
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

// ══════════════════════════════════════════════════════════
// POST /api/registro/cita  — Crear cita (público, sin auth)
// ══════════════════════════════════════════════════════════
router.post("/cita", limiterModerate, async (req, res) => {
  try {
    const { paciente_id, medico_id, motivo, clinica_id } = req.body;
    let { inicio, fin } = req.body;
    if (!paciente_id || !medico_id || !inicio || !fin || !clinica_id)
      return res.status(400).json({ ok: false, msg: "paciente_id, medico_id, inicio, fin, clinica_id son obligatorios" });

    // MySQL DATETIME no acepta la Z de UTC ni milisegundos — convertir a 'YYYY-MM-DD HH:MM:SS'
    const toMysqlDt = (v) => new Date(v).toISOString().replace("T", " ").substring(0, 19);
    inicio = toMysqlDt(inicio);
    fin    = toMysqlDt(fin);

    // Validar session token — el paciente_id del token debe coincidir con el del body
    const session = validarSessionToken(req, res);
    if (!session) return;
    if (String(session.paciente_id) !== String(paciente_id) || String(session.clinica_id) !== String(clinica_id))
      return res.status(403).json({ ok: false, msg: "No autorizado" });

    // Verificar que paciente y médico pertenecen a la clínica
    const [[p]] = await pool.query(
      "SELECT id FROM pacientes WHERE id=? AND clinica_id=? AND activo=1",
      [paciente_id, clinica_id]
    );
    if (!p) return res.status(403).json({ ok: false, msg: "Paciente no pertenece a esta clínica" });

    const [[m]] = await pool.query(
      "SELECT id FROM usuarios WHERE id=? AND clinica_id=? AND activo=1",
      [medico_id, clinica_id]
    );
    if (!m) return res.status(403).json({ ok: false, msg: "Médico no pertenece a esta clínica" });

    // Verificar solapamiento
    const [solap] = await pool.query(
      `SELECT id FROM citas
       WHERE clinica_id=? AND medico_id=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')
         AND NOT (fin <= ? OR inicio >= ?)
       LIMIT 1`,
      [clinica_id, medico_id, inicio, fin]
    );
    if (solap.length > 0)
      return res.status(409).json({ ok: false, msg: "Ese horario ya no está disponible. Por favor elige otro." });

    const [r] = await pool.query(
      `INSERT INTO citas (clinica_id, paciente_id, medico_id, inicio, fin, tipo_consulta, motivo, canal)
       VALUES (?,?,?,?,?,?,?,?)`,
      [clinica_id, paciente_id, medico_id, inicio, fin, "CONTROL", motivo || null, "PORTAL"]
    );

    const [[pac]] = await pool.query(
      "SELECT nombres, apellidos FROM pacientes WHERE id=?",
      [paciente_id]
    );
    const nombrePac = pac ? `${pac.nombres} ${pac.apellidos}` : `Paciente #${paciente_id}`;
    const horaStr = new Date(inicio).toLocaleString("es-HN", {
      timeZone: "America/Tegucigalpa",
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });

    await crearNotificacionesPortal({
      clinicaId: clinica_id,
      tipo: "CITA_AGENDADA_PORTAL",
      mensaje: `${nombrePac} agendó cita para el ${horaStr}`,
      pacienteId: Number(paciente_id),
      citaId: r.insertId,
    });

    res.json({ ok: true, id: r.insertId, msg: "Cita agendada exitosamente" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/registro/estudios-pendientes — Protegido con session token
// ══════════════════════════════════════════════════════════
router.get("/estudios-pendientes", limiterModerate, async (req, res) => {
  try {
    // Validar session token — extraer paciente_id y clinica_id del token, no de la query
    const session = validarSessionToken(req, res);
    if (!session) return;
    const paciente_id = session.paciente_id;
    const clinica_id  = session.clinica_id;

    const [rows] = await pool.query(
      `SELECT es.id, es.tipo, es.descripcion, es.urgente, es.creado_en,
              u.nombres AS medico_nombres, u.apellidos AS medico_apellidos
       FROM estudios_solicitudes es
       JOIN usuarios u ON u.id = es.medico_id
       WHERE es.paciente_id = ? AND es.clinica_id = ?
         AND es.estado IN ('SOLICITADO','EN_PROCESO')
       ORDER BY es.creado_en DESC`,
      [paciente_id, clinica_id]
    );

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
