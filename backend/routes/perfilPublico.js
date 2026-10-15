/**
 * routes/perfilPublico.js — Perfil público por médico + estadísticas de visitas
 * Montado en /api/perfil-publico
 *
 * Públicas:
 *   GET  /medico/:slug          datos del perfil del médico (/dr/:slug)
 *   POST /evento                registra una visita / clic (anónimo)
 *   GET  /qr/medico/:slug.png   QR del perfil del médico (?ref=qr)
 *   GET  /qr/clinica/:slug.png  QR de la página de la clínica (?ref=qr)
 * Personal de la clínica:
 *   GET  /mis-enlaces           enlaces del médico (o de todos, si es ADMIN)
 *   GET  /estadisticas?periodo= 7d | 30d | 90d | mes
 *
 * Tablas nuevas (no modifica ninguna existente):
 *   medico_perfiles  slug público de cada médico
 *   perfil_eventos   visitas y clics anónimos (sin cookies ni datos personales;
 *                    el visitante se guarda como un hash diario irreversible)
 */
const router    = require("express").Router();
const crypto    = require("crypto");
const rateLimit = require("express-rate-limit");
const QRCode    = require("qrcode");
const dayjs     = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool      = require("../db");
const auth      = require("../middlewares/auth");

const TIPOS   = ["VISTA", "WHATSAPP", "AGENDAR_CLIC", "CITA"];
const ORIGENES = ["DIRECTO", "QR", "GOOGLE", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK", "OTRO"];
const ROLES_MEDICO = ["MEDICO", "PSICOLOGO"];

let tablasListas = null;
function asegurarTablas() {
  if (!tablasListas) {
    tablasListas = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS medico_perfiles (
          usuario_id  INT UNSIGNED NOT NULL PRIMARY KEY,
          clinica_id  INT UNSIGNED NOT NULL,
          slug        VARCHAR(120) NOT NULL UNIQUE,
          creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_mp_clinica (clinica_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS perfil_eventos (
          id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          clinica_id  INT UNSIGNED NOT NULL,
          medico_id   INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = página de la clínica',
          tipo        ENUM('VISTA','WHATSAPP','AGENDAR_CLIC','CITA') NOT NULL,
          origen      ENUM('DIRECTO','QR','GOOGLE','FACEBOOK','INSTAGRAM','WHATSAPP','TIKTOK','OTRO') NOT NULL DEFAULT 'DIRECTO',
          visitante   CHAR(32) NOT NULL,
          fecha       DATE NOT NULL,
          creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_pe_visita (visitante, fecha, tipo, clinica_id, medico_id),
          INDEX idx_pe_clinica_fecha (clinica_id, fecha),
          INDEX idx_pe_medico_fecha (medico_id, fecha)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch((e) => { tablasListas = null; throw e; });
  }
  return tablasListas;
}

// ── Slugs ────────────────────────────────────────────────────────────────────
function slugificar(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 100) || "medico";
}

/** Devuelve el slug del médico, creándolo la primera vez (nombre-apellido, -2, -3…). */
async function slugDeMedico(medico) {
  await asegurarTablas();
  const [[existe]] = await pool.query("SELECT slug FROM medico_perfiles WHERE usuario_id=?", [medico.id]);
  if (existe) return existe.slug;
  const primerApellido = String(medico.apellidos || "").trim().split(/\s+/)[0];
  const base = slugificar(`${String(medico.nombres || "").trim().split(/\s+/)[0]} ${primerApellido}`);
  for (let n = 1; n < 200; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [r] = await pool.query(
      "INSERT IGNORE INTO medico_perfiles (usuario_id, clinica_id, slug) VALUES (?, ?, ?)",
      [medico.id, medico.clinica_id, slug]);
    if (r.affectedRows) return slug;
    const [[mio]] = await pool.query("SELECT slug FROM medico_perfiles WHERE usuario_id=?", [medico.id]);
    if (mio) return mio.slug; // otra petición lo creó al mismo tiempo
  }
  throw new Error("No se pudo generar el enlace del médico");
}

const frontendUrl = () => (process.env.FRONTEND_URL || "https://medickg.com").replace(/\/+$/, "");

// ── Rate limits ──────────────────────────────────────────────────────────────
const limiterPublico = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes." },
});
const limiterEventos = rateLimit({
  windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  message: { ok: false },
});

// ── GET /medico/:slug ────────────────────────────────────────────────────────
router.get("/medico/:slug", limiterPublico, async (req, res) => {
  try {
    await asegurarTablas();
    const [[m]] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos, u.foto_url, u.tipo, e.nombre AS especialidad,
              c.id AS clinica_id, c.nombre AS clinica, c.slug AS clinica_slug, c.logo_url,
              c.telefono AS clinica_telefono, c.direccion, c.ciudad
       FROM medico_perfiles mp
       JOIN usuarios u ON u.id = mp.usuario_id
       JOIN clinicas c ON c.id = u.clinica_id
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE mp.slug = ? AND u.activo = 1 AND c.activo = 1`,
      [String(req.params.slug || "").slice(0, 120)]);
    if (!m) return res.status(404).json({ ok: false, msg: "Perfil no encontrado" });

    const [config] = await pool.query(
      `SELECT clave, valor FROM clinica_config WHERE clinica_id = ? AND clave IN (
         'perfil_whatsapp','perfil_instagram','perfil_tiktok','perfil_facebook',
         'perfil_google_maps','perfil_color_primario','perfil_agendar_activo','perfil_titulo_doctor'
       )`, [m.clinica_id]);
    const perfil = Object.fromEntries(config.map((r) => [r.clave, r.valor]));

    const [dias] = await pool.query(
      "SELECT DISTINCT dia_semana FROM horarios_medico WHERE medico_id = ? AND activo = 1 ORDER BY dia_semana", [m.id]);

    res.json({
      ok: true,
      data: {
        medico_id: m.id,
        nombres: m.nombres,
        apellidos: m.apellidos,
        foto_url: m.foto_url,
        especialidad: m.especialidad,
        es_psicologo: m.tipo === "PSICOLOGO",
        clinica: { nombre: m.clinica, slug: m.clinica_slug, logo_url: m.logo_url, telefono: m.clinica_telefono, direccion: m.direccion, ciudad: m.ciudad },
        perfil,
        dias_disponibles: dias.map((d) => d.dia_semana),
      },
    });
  } catch (e) {
    console.error("[perfil-publico] medico:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar el perfil" });
  }
});

// ── POST /evento  { clinica_slug | medico_slug, tipo, origen } ───────────────
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp\/|preview|headless|lighthouse|curl|wget|python|axios/i;

router.post("/evento", limiterEventos, require("express").text({ type: "text/plain", limit: "2kb" }), async (req, res) => {
  // Nunca falla hacia el visitante: el conteo no debe afectar la página
  res.status(204).end();
  try {
    // Llega como JSON (fetch) o como text/plain (navigator.sendBeacon)
    if (typeof req.body === "string") {
      try { req.body = JSON.parse(req.body); } catch { return; }
    }
    const ua = String(req.headers["user-agent"] || "");
    if (!ua || BOT_RE.test(ua)) return;
    const { clinica_slug, medico_slug } = req.body || {};
    const tipo = TIPOS.includes(req.body?.tipo) ? req.body.tipo : null;
    const origen = ORIGENES.includes(req.body?.origen) ? req.body.origen : "DIRECTO";
    if (!tipo) return;

    await asegurarTablas();
    let clinicaId, medicoId = 0;
    if (medico_slug) {
      const [[m]] = await pool.query("SELECT usuario_id, clinica_id FROM medico_perfiles WHERE slug=?", [String(medico_slug).slice(0, 120)]);
      if (!m) return;
      clinicaId = m.clinica_id; medicoId = m.usuario_id;
    } else if (clinica_slug) {
      const [[c]] = await pool.query("SELECT id FROM clinicas WHERE slug=? AND activo=1", [String(clinica_slug).slice(0, 120)]);
      if (!c) return;
      clinicaId = c.id;
    } else return;

    // Visitante anónimo: hash de IP + navegador + día. No se puede revertir ni
    // seguir entre días; solo evita contar dos veces a la misma persona el mismo día.
    const fecha = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");
    const ip = String(req.ip || ""); // trust proxy ya da la IP real del cliente
    const visitante = crypto.createHmac("sha256", process.env.JWT_SECRET || "perfil")
      .update(`${ip}|${ua}|${fecha}`).digest("hex").slice(0, 32);

    await pool.query(
      `INSERT IGNORE INTO perfil_eventos (clinica_id, medico_id, tipo, origen, visitante, fecha)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clinicaId, medicoId, tipo, origen, visitante, fecha]);
  } catch (e) {
    console.error("[perfil-publico] evento:", e.message);
  }
});

// ── QR (PNG) ─────────────────────────────────────────────────────────────────
async function enviarQR(res, url, nombreArchivo) {
  const png = await QRCode.toBuffer(url, { type: "png", width: 720, margin: 2, errorCorrectionLevel: "M" });
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=86400");
  if (nombreArchivo) res.set("Content-Disposition", `inline; filename="${nombreArchivo}"`);
  res.send(png);
}

router.get("/qr/medico/:slug.png", limiterPublico, async (req, res) => {
  try {
    await asegurarTablas();
    const [[m]] = await pool.query("SELECT slug FROM medico_perfiles WHERE slug=?", [String(req.params.slug).slice(0, 120)]);
    if (!m) return res.status(404).end();
    await enviarQR(res, `${frontendUrl()}/dr/${m.slug}?ref=qr`, `qr-${m.slug}.png`);
  } catch (e) {
    console.error("[perfil-publico] qr medico:", e.message);
    res.status(500).end();
  }
});

router.get("/qr/clinica/:slug.png", limiterPublico, async (req, res) => {
  try {
    const [[c]] = await pool.query("SELECT slug FROM clinicas WHERE slug=? AND activo=1", [String(req.params.slug).slice(0, 120)]);
    if (!c) return res.status(404).end();
    await enviarQR(res, `${frontendUrl()}/p/${c.slug}?ref=qr`, `qr-${c.slug}.png`);
  } catch (e) {
    console.error("[perfil-publico] qr clinica:", e.message);
    res.status(500).end();
  }
});

// ── Personal: enlaces ────────────────────────────────────────────────────────
router.get("/mis-enlaces", auth("ADMIN", "MEDICO", "PSICOLOGO"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const [[clinica]] = await pool.query("SELECT nombre, slug FROM clinicas WHERE id=?", [clinicaId]);
    const esAdmin = req.user.tipo === "ADMIN";
    const [medicos] = await pool.query(
      `SELECT id, nombres, apellidos, clinica_id, tipo FROM usuarios
       WHERE clinica_id = ? AND activo = 1 AND tipo IN ('MEDICO','PSICOLOGO') ${esAdmin ? "" : "AND id = ?"}
       ORDER BY nombres`,
      esAdmin ? [clinicaId] : [clinicaId, req.user.id]);

    const base = frontendUrl();
    const lista = [];
    for (const m of medicos) {
      const slug = await slugDeMedico(m);
      lista.push({ id: m.id, nombres: m.nombres, apellidos: m.apellidos, slug, url: `${base}/dr/${slug}` });
    }
    res.json({
      ok: true,
      data: {
        clinica: clinica?.slug ? { nombre: clinica.nombre, slug: clinica.slug, url: `${base}/p/${clinica.slug}` } : null,
        medicos: lista,
      },
    });
  } catch (e) {
    console.error("[perfil-publico] mis-enlaces:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar los enlaces" });
  }
});

// ── Personal: estadísticas ───────────────────────────────────────────────────
// El médico ve las visitas a su perfil; el ADMIN ve toda la clínica (página de
// la clínica + perfiles de sus médicos) con el desglose por médico.
router.get("/estadisticas", auth("ADMIN", "MEDICO", "PSICOLOGO"), async (req, res) => {
  try {
    await asegurarTablas();
    const clinicaId = req.user.clinica_id;
    const esAdmin = req.user.tipo === "ADMIN";
    const hoy = dayjs().tz("America/Tegucigalpa");
    const periodo = ["7d", "30d", "90d", "mes"].includes(req.query.periodo) ? req.query.periodo : "30d";
    const desde = periodo === "mes" ? hoy.startOf("month")
      : hoy.subtract({ "7d": 6, "30d": 29, "90d": 89 }[periodo], "day");
    const d = desde.format("YYYY-MM-DD");
    const h = hoy.format("YYYY-MM-DD");

    const filtro = esAdmin ? "" : " AND medico_id = ? ";
    const p = esAdmin ? [clinicaId, d, h] : [clinicaId, d, h, req.user.id];

    const [[totales]] = await pool.query(
      `SELECT SUM(tipo='VISTA') AS vistas,
              SUM(tipo='VISTA' AND origen='QR') AS qr,
              SUM(tipo='WHATSAPP') AS whatsapp,
              SUM(tipo='AGENDAR_CLIC') AS agendar_clic,
              SUM(tipo='CITA') AS citas
       FROM perfil_eventos WHERE clinica_id = ? AND fecha BETWEEN ? AND ? ${filtro}`, p);
    const [serie] = await pool.query(
      `SELECT DATE_FORMAT(fecha,'%Y-%m-%d') AS fecha, SUM(tipo='VISTA') AS vistas,
              SUM(tipo IN ('WHATSAPP','CITA')) AS contactos
       FROM perfil_eventos WHERE clinica_id = ? AND fecha BETWEEN ? AND ? ${filtro}
       GROUP BY fecha ORDER BY fecha`, p);
    const [origenes] = await pool.query(
      `SELECT origen, COUNT(*) AS total FROM perfil_eventos
       WHERE clinica_id = ? AND fecha BETWEEN ? AND ? AND tipo='VISTA' ${filtro}
       GROUP BY origen ORDER BY total DESC`, p);
    let porPagina = [];
    if (esAdmin) {
      [porPagina] = await pool.query(
        `SELECT pe.medico_id, u.nombres, u.apellidos,
                SUM(pe.tipo='VISTA') AS vistas, SUM(pe.tipo='WHATSAPP') AS whatsapp,
                SUM(pe.tipo='CITA') AS citas
         FROM perfil_eventos pe LEFT JOIN usuarios u ON u.id = pe.medico_id
         WHERE pe.clinica_id = ? AND pe.fecha BETWEEN ? AND ?
         GROUP BY pe.medico_id, u.nombres, u.apellidos ORDER BY vistas DESC`, p);
    }

    // Días sin eventos en 0, para que la gráfica no salte días
    const mapa = Object.fromEntries(serie.map((s) => [s.fecha, s]));
    const dias = [];
    for (let x = desde; !x.isAfter(hoy, "day"); x = x.add(1, "day")) {
      const k = x.format("YYYY-MM-DD");
      dias.push({ fecha: k, vistas: Number(mapa[k]?.vistas || 0), contactos: Number(mapa[k]?.contactos || 0) });
    }
    const n = (v) => Number(v || 0);
    res.json({
      ok: true,
      data: {
        periodo, desde: d, hasta: h, es_admin: esAdmin,
        totales: { vistas: n(totales.vistas), qr: n(totales.qr), whatsapp: n(totales.whatsapp), agendar_clic: n(totales.agendar_clic), citas: n(totales.citas) },
        serie: dias,
        origenes: origenes.map((o) => ({ origen: o.origen, total: n(o.total) })),
        por_pagina: porPagina.map((r) => ({
          medico_id: r.medico_id, nombre: r.medico_id ? `${r.nombres || ""} ${r.apellidos || ""}`.trim() : null,
          vistas: n(r.vistas), whatsapp: n(r.whatsapp), citas: n(r.citas),
        })),
      },
    });
  } catch (e) {
    console.error("[perfil-publico] estadisticas:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar las estadísticas" });
  }
});

module.exports = router;
module.exports.asegurarTablas = asegurarTablas;
