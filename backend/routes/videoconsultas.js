/**
 * routes/videoconsultas.js — Videoconsultas (citas por videollamada) con Daily.
 *
 * Personal de la clínica:
 *  GET  /api/videoconsultas/estado              → ¿está activada la videollamada en el servidor?
 *  POST /api/videoconsultas/:citaId             → marca o desmarca la cita como videoconsulta ({ activo })
 *  POST /api/videoconsultas/:citaId/entrar      → el médico entra a la sala (pase de "dueño")
 * Paciente (sin sesión, con el token de su enlace "Mi cita"):
 *  GET  /api/videoconsultas/publico/:token      → datos de la videoconsulta y si la sala ya está abierta
 *  POST /api/videoconsultas/publico/:token/entrar → pase de entrada del paciente
 */
const router = require("express").Router();
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool = require("../db");
const auth = require("../middlewares/auth");
const daily = require("../utils/daily");
const { zonaClinica } = require("../utils/zonaHoraria");
const { tituloMedico } = require("../utils/tituloMedico");
const { asegurarTabla: asegurarEnlaces } = require("../utils/citaEnlace");

const PERSONAL = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];
const MEDICOS = ["ADMIN", "MEDICO", "PSICOLOGO", "SUPER_ADMIN"];
const MIN_ANTES_PACIENTE = 30;   // el paciente puede entrar 30 min antes
const HORAS_DESPUES = 3;         // la sala se cierra 3 h después del fin de la cita

const NO_ACTIVA = "La videoconsulta aún no está activada en Medic-KG. Avise al administrador del sistema.";

let tablaLista = false;
async function asegurarTabla() {
  if (tablaLista) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS videoconsultas (
      cita_id           INT UNSIGNED NOT NULL PRIMARY KEY,
      clinica_id        INT UNSIGNED NOT NULL,
      sala              VARCHAR(80) NULL,
      url               VARCHAR(255) NULL,
      sala_expira       INT UNSIGNED NULL,
      creado_por        INT UNSIGNED NULL,
      creado_en         DATETIME DEFAULT CURRENT_TIMESTAMP,
      medico_entro_en   DATETIME NULL,
      paciente_entro_en DATETIME NULL,
      INDEX idx_vc_clinica (clinica_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablaLista = true;
}

/** Marca una cita como videoconsulta (lo usa también routes/citas.js al crearla) */
async function marcarVideo(citaId, clinicaId, usuarioId) {
  await asegurarTabla();
  await pool.query(
    "INSERT IGNORE INTO videoconsultas (cita_id, clinica_id, creado_por) VALUES (?,?,?)",
    [citaId, clinicaId, usuarioId || null]
  );
}

/** Ids de las citas (de una lista) que son videoconsulta */
async function citasConVideo(ids) {
  if (!ids?.length) return new Set();
  try {
    await asegurarTabla();
    const [rows] = await pool.query("SELECT cita_id FROM videoconsultas WHERE cita_id IN (?)", [ids]);
    return new Set(rows.map((r) => r.cita_id));
  } catch { return new Set(); }
}

/** Momento (Unix, segundos) de una hora local de la clínica "YYYY-MM-DD HH:mm:ss" */
const unix = (local, tz) => dayjs.tz(local, tz).unix();

/** Sala de la cita: la crea si no existe o si venció (p. ej. cita reprogramada) */
async function salaDe(cita, tz) {
  const expira = unix(cita.fin || cita.inicio, tz) + HORAS_DESPUES * 3600;
  const ahora = Math.floor(Date.now() / 1000);
  if (cita.sala && cita.url && cita.sala_expira && cita.sala_expira > ahora + 60 && cita.sala_expira >= expira - 60) {
    return { sala: cita.sala, url: cita.url, expira: cita.sala_expira };
  }
  const nombre = `mkg-${crypto.randomBytes(10).toString("hex")}`;
  const r = await daily.crearSala(nombre, Math.max(expira, ahora + 3600));
  await pool.query("UPDATE videoconsultas SET sala = ?, url = ?, sala_expira = ? WHERE cita_id = ?", [r.name, r.url, r.config?.exp || expira, cita.id]);
  if (cita.sala && cita.sala !== r.name) daily.borrarSala(cita.sala);
  return { sala: r.name, url: r.url, expira: r.config?.exp || expira };
}

const SELECT_CITA = `
  SELECT c.id, c.clinica_id, c.estado, c.medico_id,
         DATE_FORMAT(c.inicio, '%Y-%m-%d %H:%i:%s') AS inicio, DATE_FORMAT(c.fin, '%Y-%m-%d %H:%i:%s') AS fin,
         p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
         u.nombres AS med_nombres, u.apellidos AS med_apellidos, u.sexo AS med_sexo, u.tipo AS med_tipo,
         cl.nombre AS clinica, cl.logo_url,
         v.sala, v.url, v.sala_expira
  FROM citas c
  JOIN videoconsultas v ON v.cita_id = c.id
  JOIN pacientes p ON p.id = c.paciente_id
  JOIN usuarios u ON u.id = c.medico_id
  JOIN clinicas cl ON cl.id = c.clinica_id`;

const nombreMedico = (c) => `${tituloMedico(c.med_sexo, { tipo: c.med_tipo })}${c.med_nombres} ${c.med_apellidos}`.trim();

// ── Personal ─────────────────────────────────────────────────────────────────
router.get("/estado", auth(...PERSONAL), (req, res) => {
  res.json({ ok: true, activo: daily.disponible() });
});

router.get("/:citaId(\\d+)", auth(...PERSONAL), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id || req.user.clinica_id;
    const ids = await citasConVideo([Number(req.params.citaId)]);
    if (!ids.size) return res.json({ ok: true, es_video: false });
    const [[c]] = await pool.query("SELECT id FROM citas WHERE id = ? AND clinica_id = ?", [req.params.citaId, clinicaId]);
    res.json({ ok: true, es_video: !!c, activo: daily.disponible() });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/:citaId(\\d+)", auth(...PERSONAL), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id || req.user.clinica_id;
    const [[c]] = await pool.query("SELECT id FROM citas WHERE id = ? AND clinica_id = ?", [req.params.citaId, clinicaId]);
    if (!c) return res.status(404).json({ ok: false, msg: "Cita no encontrada." });
    await asegurarTabla();
    if (req.body?.activo === false) {
      const [[v]] = await pool.query("SELECT sala FROM videoconsultas WHERE cita_id = ?", [c.id]);
      await pool.query("DELETE FROM videoconsultas WHERE cita_id = ?", [c.id]);
      if (v?.sala) daily.borrarSala(v.sala);
    } else {
      await marcarVideo(c.id, clinicaId, req.user.id);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/:citaId(\\d+)/entrar", auth(...MEDICOS), async (req, res) => {
  try {
    if (!daily.disponible()) return res.status(503).json({ ok: false, msg: NO_ACTIVA, no_activa: true });
    const clinicaId = req.tenant?.clinica_id || req.user.clinica_id;
    await asegurarTabla();
    const [[cita]] = await pool.query(`${SELECT_CITA} WHERE c.id = ? AND c.clinica_id = ?`, [req.params.citaId, clinicaId]);
    if (!cita) return res.status(404).json({ ok: false, msg: "Esta cita no es una videoconsulta." });
    const tz = await zonaClinica(clinicaId);
    const { sala, url, expira } = await salaDe(cita, tz);
    const [[yo]] = await pool.query("SELECT nombres, apellidos, sexo, tipo FROM usuarios WHERE id = ?", [req.user.id]);
    const nombre = yo ? `${tituloMedico(yo.sexo, { tipo: yo.tipo })}${yo.nombres} ${yo.apellidos}` : "Médico";
    const pase = await daily.crearPase(sala, { nombre, dueno: true, exp: expira });
    await pool.query("UPDATE videoconsultas SET medico_entro_en = COALESCE(medico_entro_en, NOW()) WHERE cita_id = ?", [cita.id]);
    res.json({
      ok: true, url, pase,
      paciente: `${cita.pac_nombres} ${cita.pac_apellidos}`.trim(), inicio: cita.inicio, clinica: cita.clinica,
    });
  } catch (e) {
    console.error("[videoconsultas] entrar médico:", e.message);
    res.status(502).json({ ok: false, msg: "No se pudo abrir la sala de videollamada. Intente de nuevo en un momento." });
  }
});

// ── Paciente (público, con el token de su enlace) ────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, msg: "Demasiados intentos. Espere unos minutos." } });
const TOKEN_RE = /^[a-f0-9]{64}$/;

async function citaPorToken(token) {
  if (!TOKEN_RE.test(token)) return null;
  await asegurarTabla();
  await asegurarEnlaces();
  const [[c]] = await pool.query(`${SELECT_CITA} JOIN cita_enlaces e ON e.cita_id = c.id WHERE e.token = ?`, [token]);
  return c || null;
}

function ventana(cita, tz) {
  const ahora = Math.floor(Date.now() / 1000);
  const abre = unix(cita.inicio, tz) - MIN_ANTES_PACIENTE * 60;
  const cierra = unix(cita.fin || cita.inicio, tz) + HORAS_DESPUES * 3600;
  return { ahora, abre, cierra, abierta: ahora >= abre && ahora <= cierra, pasada: ahora > cierra };
}

router.get("/publico/:token", limiter, async (req, res) => {
  try {
    const cita = await citaPorToken(req.params.token);
    if (!cita) return res.json({ ok: true, es_video: false });
    const tz = await zonaClinica(cita.clinica_id);
    const v = ventana(cita, tz);
    res.json({
      ok: true, es_video: true, activa: daily.disponible(),
      estado: cita.estado, abierta: v.abierta, pasada: v.pasada,
      abre_en: new Date(v.abre * 1000).toISOString(),
      paciente: String(cita.pac_nombres || "").split(" ")[0], medico: nombreMedico(cita),
      clinica: cita.clinica, logo_url: cita.logo_url, inicio: cita.inicio,
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/publico/:token/entrar", limiter, async (req, res) => {
  try {
    const cita = await citaPorToken(req.params.token);
    if (!cita) return res.status(404).json({ ok: false, msg: "Enlace no válido." });
    if (!daily.disponible()) return res.status(503).json({ ok: false, msg: "La videoconsulta no está disponible en este momento. Comuníquese con la clínica." });
    if (cita.estado === "CANCELADA") return res.status(400).json({ ok: false, msg: "Esta cita fue cancelada." });
    const tz = await zonaClinica(cita.clinica_id);
    const v = ventana(cita, tz);
    if (v.pasada) return res.status(400).json({ ok: false, msg: "Esta videoconsulta ya terminó." });
    if (!v.abierta) return res.status(400).json({ ok: false, msg: `La sala se abre ${MIN_ANTES_PACIENTE} minutos antes de su cita.` });
    const { sala, url, expira } = await salaDe(cita, tz);
    const pase = await daily.crearPase(sala, { nombre: `${cita.pac_nombres} ${cita.pac_apellidos}`.trim(), exp: expira });
    await pool.query("UPDATE videoconsultas SET paciente_entro_en = COALESCE(paciente_entro_en, NOW()) WHERE cita_id = ?", [cita.id]);
    res.json({ ok: true, url, pase, medico: nombreMedico(cita), clinica: cita.clinica });
  } catch (e) {
    console.error("[videoconsultas] entrar paciente:", e.message);
    res.status(502).json({ ok: false, msg: "No se pudo abrir la videollamada. Intente de nuevo en un momento." });
  }
});

module.exports = router;
module.exports.marcarVideo = marcarVideo;
module.exports.citasConVideo = citasConVideo;
