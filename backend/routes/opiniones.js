/**
 * routes/opiniones.js — Opiniones verificadas de pacientes  (/api/opiniones)
 *
 * Solo opina quien fue atendido: el día siguiente a una consulta COMPLETADA el
 * paciente recibe por correo un enlace personal (un solo uso) para calificar a
 * su médico. Las estrellas de todas las respuestas cuentan para el promedio;
 * el médico (o el administrador) decide qué comentarios se publican.
 *
 * Es opcional por clínica: se activa desde el Dashboard (clinica_config
 * 'opiniones_activas' = '1'). Tabla nueva opiniones_pacientes; no modifica
 * ninguna existente.
 *
 * Públicas:  GET  /token/:token · POST /token/:token · GET /publicas?medico_slug=|clinica_slug=
 * Personal:  GET  /panel · PATCH /:id/publicar · GET/PUT /config
 */
const router    = require("express").Router();
const crypto    = require("crypto");
const rateLimit = require("express-rate-limit");
const dayjs     = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool      = require("../db");
const auth      = require("../middlewares/auth");
const sse       = require("../utils/sseManager");
const { enviarEmail } = require("../utils/mailer");
const { tituloMedico } = require("../utils/tituloMedico");

const DIAS_ENTRE_ENCUESTAS = 60; // no preguntar al mismo paciente más de una vez cada 60 días

let tablaLista = null;
function asegurarTabla() {
  if (!tablaLista) {
    tablaLista = pool.query(`
      CREATE TABLE IF NOT EXISTS opiniones_pacientes (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id    INT UNSIGNED NOT NULL,
        medico_id     INT UNSIGNED NOT NULL,
        paciente_id   INT UNSIGNED NOT NULL,
        cita_id       INT UNSIGNED NOT NULL UNIQUE,
        token         CHAR(64) NOT NULL UNIQUE,
        estrellas     TINYINT UNSIGNED NULL,
        comentario    VARCHAR(600) NULL,
        mostrar_nombre TINYINT(1) NOT NULL DEFAULT 0,
        publicada     TINYINT(1) NOT NULL DEFAULT 0,
        enviada_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
        respondida_en DATETIME NULL,
        INDEX idx_op_medico (medico_id, respondida_en),
        INDEX idx_op_clinica (clinica_id, respondida_en),
        INDEX idx_op_paciente (paciente_id, enviada_en)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((e) => { tablaLista = null; throw e; });
  }
  return tablaLista;
}

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "Andrea Sofía Cortés Garay" → "Andrea C."
function nombreCorto(nombres, apellidos) {
  const n = String(nombres || "").trim().split(/\s+/)[0] || "";
  const a = String(apellidos || "").trim().charAt(0);
  return a ? `${n} ${a.toUpperCase()}.` : n;
}

// ═════════════════════════════════════════════════════════════════════════════
// Envío diario de encuestas (lo llama el cron de server.js)
// ═════════════════════════════════════════════════════════════════════════════
async function enviarEncuestas() {
  try {
    await asegurarTabla();
    if (!process.env.FRONTEND_URL) return { enviadas: 0 };
    const base = process.env.FRONTEND_URL.replace(/\/+$/, "");
    const ayer = dayjs().tz("America/Tegucigalpa").subtract(1, "day").format("YYYY-MM-DD");

    // Consultas completadas ayer, en clínicas que activaron las opiniones
    const [citas] = await pool.query(
      `SELECT c.id AS cita_id, c.clinica_id, c.medico_id, c.paciente_id,
              p.nombres, p.email, cl.nombre AS clinica,
              CONCAT(u.nombres, ' ', u.apellidos) AS medico, u.tipo AS medico_tipo, u.sexo AS medico_sexo
       FROM citas c
       JOIN pacientes p ON p.id = c.paciente_id
       JOIN usuarios u  ON u.id = c.medico_id
       JOIN clinicas cl ON cl.id = c.clinica_id
       JOIN clinica_config cc ON cc.clinica_id = c.clinica_id AND cc.clave = 'opiniones_activas' AND cc.valor = '1'
       WHERE c.estado = 'COMPLETADA' AND c.inicio >= ? AND c.inicio < ? + INTERVAL 1 DAY
         AND cl.activo = 1 AND p.activo = 1 AND p.email IS NOT NULL AND p.email <> ''
         AND NOT EXISTS (SELECT 1 FROM opiniones_pacientes o WHERE o.cita_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM opiniones_pacientes o2
                         WHERE o2.paciente_id = c.paciente_id AND o2.enviada_en > NOW() - INTERVAL ? DAY)
       ORDER BY c.inicio`,
      [ayer, ayer, DIAS_ENTRE_ENCUESTAS]);

    let enviadas = 0;
    const yaPreguntados = new Set(); // un paciente con dos citas ayer recibe un solo correo
    for (const c of citas) {
      if (yaPreguntados.has(c.paciente_id)) continue;
      yaPreguntados.add(c.paciente_id);
      const token = crypto.randomBytes(32).toString("hex");
      const [r] = await pool.query(
        `INSERT IGNORE INTO opiniones_pacientes (clinica_id, medico_id, paciente_id, cita_id, token)
         VALUES (?, ?, ?, ?, ?)`, [c.clinica_id, c.medico_id, c.paciente_id, c.cita_id, token]);
      if (!r.affectedRows) continue;
      try {
        const titulo = tituloMedico(c.medico_sexo, { tipo: c.medico_tipo });
        await enviarEmail({
          to: c.email,
          subject: `¿Cómo fue tu consulta con ${titulo}${c.medico}?`,
          html: plantillaEncuesta({ nombre: String(c.nombres || "").split(" ")[0], medico: `${titulo}${c.medico}`, clinica: c.clinica, link: `${base}/opinion/${token}` }),
        });
        enviadas++;
      } catch (e) {
        console.error("[opiniones] correo:", e.message);
      }
    }
    if (enviadas) console.log(`⭐ [opiniones] ${enviadas} encuesta(s) enviada(s)`);
    return { enviadas };
  } catch (e) {
    console.error("[opiniones] enviarEncuestas:", e.message);
    return { enviadas: 0, error: e.message };
  }
}

function plantillaEncuesta({ nombre, medico, clinica, link }) {
  const estrellas = [1, 2, 3, 4, 5].map((n) =>
    `<a href="${link}?e=${n}" style="font-size:30px;text-decoration:none;color:#f59e0b;padding:0 3px">★</a>`).join("");
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:24px">
    <div style="background:#fff;border-radius:12px;max-width:520px;margin:auto;padding:32px;text-align:center">
      <h2 style="color:#0f172a;margin:0 0 8px">Hola ${esc(nombre)} 👋</h2>
      <p style="color:#475569">¿Cómo te fue ayer en tu consulta con <strong>${esc(medico)}</strong> en ${esc(clinica)}?</p>
      <p style="color:#475569;margin:20px 0 6px">Toca una estrella para calificar:</p>
      <div style="margin:0 0 20px">${estrellas}</div>
      <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600">Dejar mi opinión</a>
      <p style="color:#94a3b8;font-size:12.5px;margin-top:22px">Toma menos de un minuto. Tu opinión ayuda a otros pacientes y a mejorar la atención.</p>
    </div>
  </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// Públicas
// ═════════════════════════════════════════════════════════════════════════════
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
});
const limiterLectura = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes." },
});

async function buscarPorToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  await asegurarTabla();
  const [[o]] = await pool.query(
    `SELECT o.id, o.clinica_id, o.medico_id, o.estrellas, o.respondida_en,
            p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
            CONCAT(u.nombres, ' ', u.apellidos) AS medico, u.tipo AS medico_tipo, u.sexo AS medico_sexo, u.foto_url,
            cl.nombre AS clinica, cl.logo_url,
            (SELECT valor FROM clinica_config WHERE clinica_id = o.clinica_id AND clave = 'opiniones_google_url' LIMIT 1) AS google_url
     FROM opiniones_pacientes o
     JOIN pacientes p ON p.id = o.paciente_id
     JOIN usuarios u  ON u.id = o.medico_id
     JOIN clinicas cl ON cl.id = o.clinica_id
     WHERE o.token = ?`, [token]);
  return o || null;
}

function vistaToken(o) {
  return {
    paciente: String(o.paciente_nombres || "").split(" ")[0],
    nombre_corto: nombreCorto(o.paciente_nombres, o.paciente_apellidos),
    medico: `${tituloMedico(o.medico_sexo, { tipo: o.medico_tipo })}${o.medico}`,
    foto_url: o.foto_url,
    clinica: o.clinica,
    logo_url: o.logo_url,
    respondida: Boolean(o.respondida_en),
    estrellas: o.estrellas,
    // Solo tras una buena calificación se invita a dejar reseña en Google
    google_url: o.respondida_en && o.estrellas >= 4 && /^https:\/\//.test(o.google_url || "") ? o.google_url : null,
  };
}

router.get("/token/:token", limiter, async (req, res) => {
  try {
    const o = await buscarPorToken(req.params.token);
    if (!o) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    res.json({ ok: true, data: vistaToken(o) });
  } catch (e) {
    console.error("[opiniones] GET token:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar la encuesta." });
  }
});

router.post("/token/:token", limiter, async (req, res) => {
  try {
    const o = await buscarPorToken(req.params.token);
    if (!o) return res.status(404).json({ ok: false, msg: "El enlace no es válido." });
    if (o.respondida_en) return res.json({ ok: true, data: vistaToken(o) });

    const estrellas = Number(req.body?.estrellas);
    if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5)
      return res.status(400).json({ ok: false, msg: "Elige de 1 a 5 estrellas." });
    const comentario = String(req.body?.comentario || "").trim().slice(0, 600) || null;
    const mostrarNombre = req.body?.mostrar_nombre ? 1 : 0;

    // Una sola respuesta por enlace, aunque se envíe dos veces a la vez
    const [r] = await pool.query(
      `UPDATE opiniones_pacientes SET estrellas=?, comentario=?, mostrar_nombre=?, respondida_en=NOW()
       WHERE id=? AND respondida_en IS NULL`, [estrellas, comentario, mostrarNombre, o.id]);
    if (r.affectedRows) avisarMedico(o, estrellas);
    res.json({ ok: true, data: vistaToken(await buscarPorToken(req.params.token)) });
  } catch (e) {
    console.error("[opiniones] POST token:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo guardar tu opinión." });
  }
});

async function avisarMedico(o, estrellas) {
  try {
    const [usuarios] = await pool.query(
      `SELECT id FROM usuarios WHERE clinica_id=? AND activo=1 AND (id=? OR tipo='ADMIN')`, [o.clinica_id, o.medico_id]);
    if (!usuarios.length) return;
    const tipo = "OPINION_PACIENTE";
    const mensaje = `Nueva opinión de ${estrellas}★ para ${o.medico}. Revísala en el Dashboard para publicarla.`.slice(0, 300);
    await pool.query(
      "INSERT INTO notificaciones_usuario (usuario_id, clinica_id, tipo, mensaje) VALUES ?",
      [usuarios.map((u) => [u.id, o.clinica_id, tipo, mensaje])]);
    for (const u of usuarios) sse.notifyUser(u.id, "notificacion_portal", { tipo, mensaje });
  } catch (e) {
    console.error("[opiniones] aviso:", e.message);
  }
}

// GET /publicas?medico_slug=…  |  ?clinica_slug=…
router.get("/publicas", limiterLectura, async (req, res) => {
  try {
    await asegurarTabla();
    let filtro, valor;
    if (req.query.medico_slug) {
      const [[m]] = await pool.query("SELECT usuario_id FROM medico_perfiles WHERE slug=?", [String(req.query.medico_slug).slice(0, 120)])
        .catch(() => [[null]]);
      if (!m) return res.json({ ok: true, data: { total: 0, promedio: null, distribucion: {}, opiniones: [] } });
      filtro = "o.medico_id = ?"; valor = m.usuario_id;
    } else if (req.query.clinica_slug) {
      const [[c]] = await pool.query("SELECT id FROM clinicas WHERE slug=? AND activo=1", [String(req.query.clinica_slug).slice(0, 120)]);
      if (!c) return res.json({ ok: true, data: { total: 0, promedio: null, distribucion: {}, opiniones: [] } });
      filtro = "o.clinica_id = ?"; valor = c.id;
    } else {
      return res.status(400).json({ ok: false, msg: "Falta el perfil" });
    }

    const [dist] = await pool.query(
      `SELECT o.estrellas, COUNT(*) AS n FROM opiniones_pacientes o
       WHERE ${filtro} AND o.respondida_en IS NOT NULL GROUP BY o.estrellas`, [valor]);
    const [opiniones] = await pool.query(
      `SELECT o.estrellas, o.comentario, o.mostrar_nombre, DATE_FORMAT(o.respondida_en, '%Y-%m-%d') AS fecha,
              p.nombres, p.apellidos, CONCAT(u.nombres, ' ', u.apellidos) AS medico
       FROM opiniones_pacientes o
       JOIN pacientes p ON p.id = o.paciente_id
       JOIN usuarios u ON u.id = o.medico_id
       WHERE ${filtro} AND o.respondida_en IS NOT NULL AND o.publicada = 1 AND o.comentario IS NOT NULL
       ORDER BY o.respondida_en DESC LIMIT 30`, [valor]);

    const distribucion = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, 0]));
    let total = 0, suma = 0;
    for (const d of dist) { distribucion[d.estrellas] = Number(d.n); total += Number(d.n); suma += d.estrellas * Number(d.n); }
    res.json({
      ok: true,
      data: {
        total,
        promedio: total ? Math.round((suma / total) * 10) / 10 : null,
        distribucion,
        opiniones: opiniones.map((x) => ({
          estrellas: x.estrellas,
          comentario: x.comentario,
          fecha: x.fecha,
          autor: x.mostrar_nombre ? nombreCorto(x.nombres, x.apellidos) : "Paciente verificado",
          medico: req.query.clinica_slug ? x.medico : undefined,
        })),
      },
    });
  } catch (e) {
    console.error("[opiniones] publicas:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar las opiniones" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Personal de la clínica
// ═════════════════════════════════════════════════════════════════════════════
const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO"];

// GET /panel → resumen + respuestas (médico: las suyas; admin: toda la clínica)
router.get("/panel", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const esAdmin = req.user.tipo === "ADMIN";
    const filtro = esAdmin ? "" : " AND o.medico_id = ? ";
    const p = esAdmin ? [req.user.clinica_id] : [req.user.clinica_id, req.user.id];
    const [rows] = await pool.query(
      `SELECT o.id, o.estrellas, o.comentario, o.mostrar_nombre, o.publicada,
              DATE_FORMAT(o.respondida_en, '%Y-%m-%d') AS fecha,
              p.nombres, p.apellidos, CONCAT(u.nombres, ' ', u.apellidos) AS medico
       FROM opiniones_pacientes o
       JOIN pacientes p ON p.id = o.paciente_id
       JOIN usuarios u ON u.id = o.medico_id
       WHERE o.clinica_id = ? ${filtro} AND o.respondida_en IS NOT NULL
       ORDER BY o.respondida_en DESC LIMIT 200`, p);
    const [[env]] = await pool.query(
      `SELECT COUNT(*) AS enviadas, SUM(o.respondida_en IS NOT NULL) AS respondidas
       FROM opiniones_pacientes o WHERE o.clinica_id = ? ${filtro}`, p);
    const [[cfg]] = await pool.query(
      `SELECT MAX(CASE WHEN clave='opiniones_activas' THEN valor END) AS activas,
              MAX(CASE WHEN clave='opiniones_google_url' THEN valor END) AS google_url
       FROM clinica_config WHERE clinica_id = ?`, [req.user.clinica_id]);

    res.json({
      ok: true,
      data: {
        es_admin: esAdmin,
        activas: cfg?.activas === "1",
        google_url: cfg?.google_url || "",
        enviadas: Number(env.enviadas || 0),
        respondidas: Number(env.respondidas || 0),
        opiniones: rows.map((r) => ({
          id: r.id, estrellas: r.estrellas, comentario: r.comentario, publicada: Boolean(r.publicada),
          fecha: r.fecha, medico: r.medico,
          paciente: `${r.nombres} ${r.apellidos}`,
          autor_publico: r.mostrar_nombre ? nombreCorto(r.nombres, r.apellidos) : "Paciente verificado",
        })),
      },
    });
  } catch (e) {
    console.error("[opiniones] panel:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar las opiniones" });
  }
});

// PATCH /:id/publicar { publicada: true|false }
router.patch("/:id/publicar", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const esAdmin = req.user.tipo === "ADMIN";
    const [r] = await pool.query(
      `UPDATE opiniones_pacientes SET publicada=?
       WHERE id=? AND clinica_id=? ${esAdmin ? "" : "AND medico_id=?"} AND comentario IS NOT NULL`,
      esAdmin ? [req.body?.publicada ? 1 : 0, req.params.id, req.user.clinica_id]
              : [req.body?.publicada ? 1 : 0, req.params.id, req.user.clinica_id, req.user.id]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "Opinión no encontrada" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[opiniones] publicar:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo actualizar" });
  }
});

// PUT /config { activas, google_url }  (solo ADMIN)
router.put("/config", auth("ADMIN"), async (req, res) => {
  try {
    const activas = req.body?.activas ? "1" : "0";
    const google = String(req.body?.google_url || "").trim().slice(0, 500);
    if (google && !/^https:\/\//.test(google))
      return res.status(400).json({ ok: false, msg: "El enlace de Google debe empezar con https://" });
    for (const [clave, valor] of [["opiniones_activas", activas], ["opiniones_google_url", google]]) {
      const [u] = await pool.query("UPDATE clinica_config SET valor=? WHERE clinica_id=? AND clave=?", [valor, req.user.clinica_id, clave]);
      if (!u.affectedRows) {
        await pool.query("INSERT INTO clinica_config (clinica_id, clave, valor) VALUES (?, ?, ?)", [req.user.clinica_id, clave, valor]);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[opiniones] config:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo guardar" });
  }
});

module.exports = router;
module.exports.asegurarTabla = asegurarTabla;
module.exports.enviarEncuestas = enviarEncuestas;
