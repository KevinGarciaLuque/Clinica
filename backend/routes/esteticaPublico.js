/**
 * routes/esteticaPublico.js — Enlaces de estética para el paciente  (/api/estetica-publico)
 *
 * La clínica envía al paciente (correo o WhatsApp) un enlace personal que abre
 * un solo documento, sin iniciar sesión:
 *   - «firma»:        el paciente lee el consentimiento y lo firma con el dedo.
 *   - «indicaciones»: las indicaciones para la casa después del procedimiento,
 *                      con sus controles y el mantenimiento.
 *   - «como_va»:      «¿Cómo va?» unos días después: dolor, inflamación, señales
 *                      de alarma, comentario y hasta 2 fotos. Se guarda como un
 *                      control post-procedimiento (origen «paciente») y avisa a la
 *                      clínica; si marca una señal de alarma, el aviso es urgente.
 *
 * Seguridad: clave aleatoria de 32 bytes; en la base solo se guarda su huella
 * (SHA-256). El enlace vence (7 días la firma, 60 las indicaciones) y el de
 * firma sirve una sola vez. Tabla nueva estetica_enlaces.
 *
 *  GET  /api/estetica-publico/:token          → datos para mostrar
 *  POST /api/estetica-publico/:token/firmar   → { firma, nombre, relacion, leido }
 *  POST /api/estetica-publico/:token/responder → { dolor, inflamacion, alarmas, comentario, fotos }
 */
const router    = require("express").Router();
const crypto    = require("crypto");
const rateLimit = require("express-rate-limit");
const pool      = require("../db");
const { urlPublica } = require("../utils/urlPublica");

const DIAS = { firma: 7, indicaciones: 60, como_va: 14 };

/** Señales de alarma que el paciente puede marcar (claves fijas) */
const ALARMAS = {
  dolor_fuerte:   "Dolor fuerte que no mejora",
  piel_color:     "Piel blanca, morada o fría en la zona",
  vision:         "Visión borrosa o pérdida de visión",
  fiebre:         "Fiebre o escalofríos",
  pus:            "Pus, secreción o mal olor",
  bulto:          "Bulto duro, enrojecido o caliente",
  respirar:       "Dificultad para respirar o hinchazón de la cara/garganta",
};
const INFLAMACION = { Nada: "Ausente", Poca: "Leve", Moderada: "Moderado", Mucha: "Severo" };
const faseDe = (dias) => (dias <= 1 ? "dia1" : dias <= 4 ? "dia3" : dias <= 10 ? "dia7" : dias <= 20 ? "dia15" : dias <= 45 ? "dia30" : dias <= 120 ? "dia90" : "dia180");
const diasDesde = (fecha) => (fecha ? Math.max(0, Math.round((Date.now() - new Date(`${String(fecha).slice(0, 10)}T12:00:00`).getTime()) / 86400000)) : null);
const TOKEN_RE = /^[a-f0-9]{64}$/;
const huella = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const leer = (t) => { try { return JSON.parse(t); } catch { return {}; } };

let tablaLista = null;
function asegurarTabla() {
  if (!tablaLista) {
    tablaLista = pool.query(`
      CREATE TABLE IF NOT EXISTS estetica_enlaces (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id  INT UNSIGNED NOT NULL,
        paciente_id INT UNSIGNED NOT NULL,
        registro_id INT UNSIGNED NOT NULL,
        tipo        VARCHAR(20) NOT NULL,
        token_hash  CHAR(64) NOT NULL UNIQUE,
        expira_en   DATETIME NOT NULL,
        abierto_en  DATETIME NULL,
        usado_en    DATETIME NULL,
        creado_por  INT UNSIGNED NULL,
        creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ee_registro (registro_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((e) => { tablaLista = null; throw e; });
  }
  return tablaLista;
}

/** Crea un enlace nuevo para un registro (lo usa routes/esteticaDatos.js) */
async function crearEnlace({ clinicaId, pacienteId, registroId, tipo, usuarioId }) {
  await asegurarTabla();
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO estetica_enlaces (clinica_id, paciente_id, registro_id, tipo, token_hash, expira_en, creado_por)
     VALUES (?,?,?,?,?, DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
    [clinicaId, pacienteId, registroId, tipo, huella(token), DIAS[tipo] || 7, usuarioId || null]);
  return { url: `${urlPublica()}/mi-estetica/${token}`, dias: DIAS[tipo] || 7 };
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intente de nuevo en unos minutos." },
});

async function buscar(token) {
  if (!TOKEN_RE.test(String(token || ""))) return null;
  await asegurarTabla();
  const [[e]] = await pool.query(
    `SELECT e.*, (e.expira_en < NOW()) AS vencido, r.datos, r.tipo AS reg_tipo, r.activo AS reg_activo, r.historia_id,
            p.nombres, p.apellidos, c.nombre AS clinica_nombre, c.telefono AS clinica_telefono, c.logo_url AS clinica_logo
     FROM estetica_enlaces e
     JOIN estetica_registros r ON r.id = e.registro_id
     JOIN pacientes p ON p.id = e.paciente_id
     JOIN clinicas c ON c.id = e.clinica_id
     WHERE e.token_hash = ?`, [huella(token)]);
  return e || null;
}

router.get("/:token", limiter, async (req, res) => {
  try {
    const e = await buscar(req.params.token);
    if (!e || !e.reg_activo) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    if (e.vencido) return res.status(410).json({ ok: false, msg: "Este enlace ya venció. Pida a la clínica que le envíe uno nuevo." });
    if (!e.abierto_en) await pool.query("UPDATE estetica_enlaces SET abierto_en = NOW() WHERE id = ?", [e.id]);
    const d = leer(e.datos);
    const base = {
      tipo: e.tipo,
      paciente: String(e.nombres || "").split(" ")[0],
      paciente_completo: `${e.nombres || ""} ${e.apellidos || ""}`.trim(),
      clinica: { nombre: e.clinica_nombre, telefono: e.clinica_telefono || null, logo_url: e.clinica_logo || null },
    };
    if (e.tipo === "firma") {
      return res.json({ ok: true, data: {
        ...base,
        procedimiento: d.procedimiento || "Procedimiento", contenido: d.contenido || "", riesgos: d.riesgos || [],
        firmado: !!d.firmado, firmado_en: d.firmado_en || null,
      } });
    }
    if (e.tipo === "como_va") {
      const fecha = String(d.creado_en || "").slice(0, 10) || null;
      return res.json({ ok: true, data: {
        ...base,
        procedimiento: d.nombre || "su procedimiento", fecha, dias: diasDesde(fecha),
        respondido: !!e.usado_en, alarmas: ALARMAS,
      } });
    }
    let medico = "";
    if (e.historia_id) {
      const [[m]] = await pool.query("SELECT u.* FROM historias_clinicas h JOIN usuarios u ON u.id = h.medico_id WHERE h.id = ?", [e.historia_id]).catch(() => [[null]]);
      if (m) medico = m.nombre_display || `${require("../utils/tituloMedico").tituloMedico(m.sexo, { tipo: m.tipo })}${m.nombres} ${m.apellidos}`.trim();
    }
    res.json({ ok: true, data: {
      ...base, medico,
      procedimiento: d.nombre || "Procedimiento",
      fecha: String(d.creado_en || "").slice(0, 10) || null,
      indicaciones: d.indicaciones || "",
      controles: (d.controles_agendados || []).map((c) => ({ label: c.label, fecha: c.fecha, hora: c.hora })),
      mantenimiento_fecha: d.mantenimiento_fecha || null,
    } });
  } catch (err) {
    console.error("[estetica-publico] GET:", err.message);
    res.status(500).json({ ok: false, msg: "No se pudo abrir el enlace." });
  }
});

router.post("/:token/firmar", limiter, async (req, res) => {
  try {
    const e = await buscar(req.params.token);
    if (!e || !e.reg_activo || e.tipo !== "firma") return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    if (e.vencido) return res.status(410).json({ ok: false, msg: "Este enlace ya venció. Pida a la clínica que le envíe uno nuevo." });
    const { firma, nombre, relacion, leido } = req.body || {};
    if (!leido) return res.status(400).json({ ok: false, msg: "Confirme que leyó el documento." });
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(String(firma || "")) || firma.length > 400000)
      return res.status(400).json({ ok: false, msg: "La firma no es válida. Vuelva a firmar." });
    const quien = String(nombre || "").trim().slice(0, 120);
    if (!quien) return res.status(400).json({ ok: false, msg: "Escriba su nombre." });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[r]] = await conn.query("SELECT id, datos FROM estetica_registros WHERE id = ? AND activo = 1 FOR UPDATE", [e.registro_id]);
      const d = leer(r?.datos);
      if (!r) { await conn.rollback(); return res.status(404).json({ ok: false, msg: "El documento ya no existe." }); }
      if (d.firmado) { await conn.rollback(); return res.json({ ok: true, ya: true }); }
      const nuevo = {
        ...d, firmado: true, firmado_en: new Date().toISOString(), firma_paciente: firma, firma_papel: false,
        firmante_nombre: quien, firmante_relacion: ["Paciente", "Padre, madre o tutor", "Representante legal"].includes(relacion) ? relacion : "Paciente",
        firma_remota: true, firma_ip: String(req.ip || "").slice(0, 45),
      };
      await conn.query("UPDATE estetica_registros SET datos = ?, actualizado_en = NOW() WHERE id = ?", [JSON.stringify(nuevo), r.id]);
      await conn.query("UPDATE estetica_enlaces SET usado_en = NOW() WHERE id = ?", [e.id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
    avisarClinica(e, leer(e.datos).procedimiento).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[estetica-publico] firmar:", err.message);
    res.status(500).json({ ok: false, msg: "No se pudo guardar la firma. Intente de nuevo." });
  }
});

/** Guarda una foto del paciente (data:image/jpeg) en la nube o en el servidor */
async function guardarFoto(dataUrl, clinicaId) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length || buf.length > 2.5e6) return null;
  const nube = !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
  if (nube) {
    const cloudinary = require("../utils/cloudinary");
    const r = await new Promise((ok, mal) => {
      const st = cloudinary.uploader.upload_stream({ folder: `clinica/estetica-paciente/${clinicaId}` }, (err, x) => (err ? mal(err) : ok(x)));
      require("streamifier").createReadStream(buf).pipe(st);
    });
    return r.secure_url;
  }
  const path = require("path"), fs = require("fs");
  const dir = path.join(__dirname, "../uploads/estetica-paciente");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const nombre = `paciente_${Date.now()}_${crypto.randomBytes(8).toString("hex")}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
  fs.writeFileSync(path.join(dir, nombre), buf);
  return `/uploads/estetica-paciente/${nombre}`;
}

router.post("/:token/responder", limiter, async (req, res) => {
  try {
    const e = await buscar(req.params.token);
    if (!e || !e.reg_activo || e.tipo !== "como_va") return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    if (e.vencido) return res.status(410).json({ ok: false, msg: "Este enlace ya venció. Si necesita algo, comuníquese con la clínica." });
    if (e.usado_en) return res.json({ ok: true, ya: true });
    const b = req.body || {};
    const dolor = Math.min(10, Math.max(0, Math.round(Number(b.dolor) || 0)));
    const inflamacion = Object.keys(INFLAMACION).includes(b.inflamacion) ? b.inflamacion : "Nada";
    const alarmas = (Array.isArray(b.alarmas) ? b.alarmas : []).filter((k) => ALARMAS[k]).slice(0, 10);
    const comentario = String(b.comentario || "").trim().slice(0, 1500);
    const fotos = [];
    for (const f of (Array.isArray(b.fotos) ? b.fotos : []).slice(0, 2)) {
      try { const url = await guardarFoto(f, e.clinica_id); if (url) fotos.push(url); } catch (err) { console.error("[estetica-publico] foto:", err.message); }
    }
    const d = leer(e.datos);
    const fecha = String(d.creado_en || "").slice(0, 10) || null;
    const urgente = alarmas.length > 0 || dolor >= 7 || inflamacion === "Mucha";
    const datos = {
      origen: "paciente", procedimiento: d.nombre || "", fase: faseDe(diasDesde(fecha) ?? 3), pac_id: String(e.paciente_id),
      dolor_eva: String(dolor), edema: INFLAMACION[inflamacion], alarmas: alarmas.map((k) => ALARMAS[k]),
      comentario, fotos, urgente, procedimiento_registro_id: e.registro_id, creado_en: new Date().toISOString(),
    };
    // Una sola respuesta por enlace (si dos pestañas envían a la vez, gana la primera)
    const [u] = await pool.query("UPDATE estetica_enlaces SET usado_en = NOW() WHERE id = ? AND usado_en IS NULL", [e.id]);
    if (!u.affectedRows) return res.json({ ok: true, ya: true });
    await pool.query(
      "INSERT INTO estetica_registros (clinica_id, paciente_id, tipo, datos) VALUES (?,?, 'seguimiento', ?)",
      [e.clinica_id, e.paciente_id, JSON.stringify(datos)]);
    const quien = `${e.nombres} ${e.apellidos || ""}`.replace(/\s+/g, " ").trim();
    const mensaje = urgente
      ? `⚠️ ${quien} reporta después de ${d.nombre || "su procedimiento"}: ${[...datos.alarmas, dolor >= 7 ? `dolor ${dolor}/10` : "", inflamacion === "Mucha" ? "mucha inflamación" : ""].filter(Boolean).join(", ")}`
      : `${quien} contó cómo va después de ${d.nombre || "su procedimiento"} (dolor ${dolor}/10, inflamación ${inflamacion.toLowerCase()})`;
    avisarClinica(e, null, {
      mensaje, tipo: urgente ? "ESTETICA_ALERTA" : "ESTETICA_COMO_VA",
      titulo: urgente ? "⚠️ Alerta después de un procedimiento" : "Respuesta de un paciente",
      url: `/estetica/seguimiento?paciente_id=${e.paciente_id}`,
    }).catch(() => {});
    res.json({ ok: true, urgente });
  } catch (err) {
    console.error("[estetica-publico] responder:", err.message);
    res.status(500).json({ ok: false, msg: "No se pudo enviar. Intente de nuevo." });
  }
});

/** Aviso a la clínica: notificación en la campana, en tiempo real y push */
async function avisarClinica(e, procedimiento, opciones = null) {
  const [usuarios] = await pool.query(
    "SELECT id FROM usuarios WHERE clinica_id = ? AND activo = 1 AND tipo <> 'SUPER_ADMIN'", [e.clinica_id]);
  if (!usuarios.length) return;
  const mensaje = (opciones?.mensaje || `${e.nombres} ${e.apellidos || ""} firmó desde su teléfono el consentimiento de ${procedimiento || "su procedimiento"}`).replace(/\s+/g, " ").slice(0, 300);
  const tipo = opciones?.tipo || "CONSENTIMIENTO_FIRMADO";
  await pool.query(
    "INSERT INTO notificaciones_usuario (usuario_id, clinica_id, tipo, mensaje, paciente_id, cita_id) VALUES ?",
    [usuarios.map((u) => [u.id, e.clinica_id, tipo, mensaje, e.paciente_id, null])]);
  const sse = require("../utils/sseManager");
  for (const u of usuarios) sse.notifyUser(u.id, "notificacion_portal", { tipo, mensaje });
  await require("../utils/webPush").sendToUsers(pool, usuarios.map((u) => u.id), {
    title: opciones?.titulo || "Consentimiento firmado", body: mensaje, tag: tipo,
    data: { tipo, url: opciones?.url || `/estetica/consentimientos?paciente_id=${e.paciente_id}` },
  });
}

module.exports = router;
module.exports.asegurarTabla = asegurarTabla;
module.exports.crearEnlace = crearEnlace;
