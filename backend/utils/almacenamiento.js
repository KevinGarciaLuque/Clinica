/**
 * utils/almacenamiento.js — Espacio usado por cada clínica y bloqueo al llenarse.
 *
 * Cuenta los archivos que suben las clínicas:
 *  - documentos del expediente (documentos_paciente): tamaño REAL (tamano_bytes)
 *  - documentos antiguos (paciente_documentos): estimado
 *  - fotos de la galería: tamaño real si se guardó (tamano_bytes), si no, estimado
 *  - fotos de perfil de pacientes y usuarios: estimado
 *
 * Al llegar al 100% de la cuota se bloquean las subidas NUEVAS; lo ya guardado
 * sigue disponible.
 */
const pool = require("../db");

const DEFAULT_STORAGE_QUOTA_GB = 25;
const DEFAULT_STORAGE_PRICE_PER_GB_LPS = 120;
// Pesos promedio (KB) cuando no se conoce el tamaño real
const KB_GALERIA = 900, KB_PERF_PAC = 350, KB_PERF_USR = 200, KB_DOC = 400;

const existeTabla = {};
async function tablaExiste(nombre) {
  if (existeTabla[nombre] === undefined) {
    const [r] = await pool.query("SHOW TABLES LIKE ?", [nombre]);
    existeTabla[nombre] = r.length > 0;
  }
  return existeTabla[nombre];
}

let galeriaLista = false;
/** Columna opcional con el tamaño real de cada foto de la galería (solo se agrega) */
async function asegurarColumnaGaleria() {
  if (galeriaLista) return;
  try {
    if (await tablaExiste("galeria_fotos")) {
      const [c] = await pool.query("SHOW COLUMNS FROM galeria_fotos LIKE 'tamano_bytes'");
      if (!c.length) await pool.query("ALTER TABLE galeria_fotos ADD COLUMN tamano_bytes INT UNSIGNED NULL");
    }
    galeriaLista = true;
  } catch (e) {
    console.warn("[almacenamiento] galeria_fotos.tamano_bytes:", e.message);
  }
}

function numero(raw, def, min = 0) {
  const n = Number(raw);
  return Number.isFinite(n) && n > min ? Math.round(n * 100) / 100 : def;
}

const legible = (kb) => {
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  if (kb < 1048576) return `${(kb / 1024).toFixed(2)} MB`;
  return `${(kb / 1048576).toFixed(2)} GB`;
};

/** Uso de almacenamiento de una clínica (mismo formato que GET /clinicas/:id/detalles) */
async function usoClinica(clinicaId) {
  await asegurarColumnaGaleria();
  const consulta = async (sql, params, def) => {
    try { const [[r]] = await pool.query(sql, params); return r; } catch { return def; }
  };

  const docs = (await tablaExiste("documentos_paciente"))
    ? await consulta(
      `SELECT COUNT(*) AS n, COALESCE(SUM(COALESCE(tamano_bytes, ${KB_DOC * 1024})), 0) AS bytes
       FROM documentos_paciente WHERE clinica_id = ?`, [clinicaId], { n: 0, bytes: 0 })
    : { n: 0, bytes: 0 };
  const docsAntiguos = (await tablaExiste("paciente_documentos"))
    ? await consulta("SELECT COUNT(*) AS n FROM paciente_documentos WHERE clinica_id = ?", [clinicaId], { n: 0 })
    : { n: 0 };
  const galeria = (await tablaExiste("galeria_fotos"))
    ? await consulta(
      `SELECT COUNT(*) AS n, COALESCE(SUM(COALESCE(gf.tamano_bytes, ${KB_GALERIA * 1024})), 0) AS bytes
       FROM galeria_fotos gf INNER JOIN pacientes p ON p.id = gf.paciente_id WHERE p.clinica_id = ?`,
      [clinicaId], { n: 0, bytes: 0 })
    : { n: 0, bytes: 0 };
  const perfPac = await consulta(
    "SELECT COUNT(*) AS n FROM pacientes WHERE clinica_id = ? AND foto_cloudinary_id IS NOT NULL AND foto_cloudinary_id != ''",
    [clinicaId], { n: 0 });
  const perfUsr = await consulta(
    "SELECT COUNT(*) AS n FROM usuarios WHERE clinica_id = ? AND foto_cloudinary_id IS NOT NULL AND foto_cloudinary_id != ''",
    [clinicaId], { n: 0 });
  const [cfg] = await pool.query(
    "SELECT clave, valor FROM clinica_config WHERE clinica_id = ? AND clave IN ('storage_quota_gb','storage_price_per_gb_lps')",
    [clinicaId]
  ).catch(() => [[]]);

  const kbDocs = Number(docs.bytes) / 1024 + Number(docsAntiguos.n) * KB_DOC;
  const kbGaleria = Number(galeria.bytes) / 1024;
  const kbPerfPac = Number(perfPac.n) * KB_PERF_PAC;
  const kbPerfUsr = Number(perfUsr.n) * KB_PERF_USR;
  const espacio_kb = Math.round(kbDocs + kbGaleria + kbPerfPac + kbPerfUsr);

  const cuota_gb = numero(cfg.find((r) => r.clave === "storage_quota_gb")?.valor, DEFAULT_STORAGE_QUOTA_GB);
  const precio = cfg.find((r) => r.clave === "storage_price_per_gb_lps")?.valor;
  const precio_por_gb_lps = Number.isFinite(Number(precio)) && Number(precio) >= 0 && precio !== undefined
    ? Math.round(Number(precio) * 100) / 100 : DEFAULT_STORAGE_PRICE_PER_GB_LPS;
  const cuota_kb = cuota_gb * 1024 * 1024;
  const uso_pct = cuota_kb > 0 ? Math.min((espacio_kb / cuota_kb) * 100, 999.99) : 0;

  return {
    conteos: {
      fotos_galeria: Number(galeria.n),
      fotos_perfil_pacientes: Number(perfPac.n),
      fotos_perfil_usuarios: Number(perfUsr.n),
      total_documentos: Number(docs.n) + Number(docsAntiguos.n),
    },
    almacenamiento: {
      espacio_kb,
      espacio_legible: legible(espacio_kb),
      cuota_gb,
      cuota_kb,
      cuota_legible: legible(cuota_kb),
      uso_pct: Number(uso_pct.toFixed(2)),
      lleno: espacio_kb >= cuota_kb,
      precio_por_gb_lps,
      desglose: {
        galeria_fotos:    { cantidad: Number(galeria.n), kb: Math.round(kbGaleria) },
        perfil_pacientes: { cantidad: Number(perfPac.n), kb: kbPerfPac },
        perfil_usuarios:  { cantidad: Number(perfUsr.n), kb: kbPerfUsr },
        documentos:       { cantidad: Number(docs.n) + Number(docsAntiguos.n), kb: Math.round(kbDocs) },
      },
    },
  };
}

const MSG_LLENO =
  "La clínica llegó al límite de su espacio de almacenamiento, por eso no se pueden subir archivos nuevos. " +
  "Lo ya guardado sigue disponible. El administrador puede solicitar más espacio en Configuración → Almacenamiento.";

/**
 * Middleware para rutas de subida (va DESPUÉS de multer): si la clínica ya llenó
 * su cuota, o este archivo la haría pasar, responde 413 y no se guarda nada.
 */
function verificarEspacio() {
  return async (req, res, next) => {
    try {
      if (!req.file || req.user?.tipo === "SUPER_ADMIN") return next();
      const clinicaId = req.tenant?.clinica_id || req.user?.clinica_id;
      if (!clinicaId) return next();
      const { almacenamiento: a } = await usoClinica(clinicaId);
      const kbNuevo = (req.file.size || 0) / 1024;
      if (a.espacio_kb + kbNuevo > a.cuota_kb) {
        revisarAviso(clinicaId);
        return res.status(413).json({ ok: false, msg: MSG_LLENO, message: MSG_LLENO, espacio_lleno: true });
      }
      // Después de guardar el archivo se revisa si cruzó el 80% / 100% para avisar
      res.on("finish", () => { if (res.statusCode < 300) revisarAviso(clinicaId); });
      next();
    } catch (e) {
      // Si no se pudo calcular, no se bloquea el trabajo de la clínica
      console.warn("[almacenamiento] verificarEspacio:", e.message);
      next();
    }
  };
}

// ── Avisos al 80% y 100% ─────────────────────────────────────────────────────
// Se avisa una sola vez por nivel (se guarda en clinica_config 'storage_aviso_nivel').
// Si el uso baja (p. ej. se amplió la cuota), el nivel se reinicia para avisar de nuevo.
const enCurso = new Set();

async function revisarAviso(clinicaId) {
  if (!clinicaId || enCurso.has(clinicaId)) return;
  enCurso.add(clinicaId);
  try {
    const { almacenamiento: a } = await usoClinica(clinicaId);
    const nivel = a.uso_pct >= 100 ? 100 : a.uso_pct >= 80 ? 80 : 0;
    const [[cfg]] = await pool.query(
      "SELECT valor FROM clinica_config WHERE clinica_id = ? AND clave = 'storage_aviso_nivel'", [clinicaId]);
    const anterior = Number(cfg?.valor || 0);
    if (nivel === anterior) return;
    await pool.query(
      `INSERT INTO clinica_config (clinica_id, clave, valor) VALUES (?, 'storage_aviso_nivel', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [clinicaId, String(nivel)]
    );
    if (nivel > anterior) await enviarAviso(clinicaId, nivel, a);
  } catch (e) {
    console.warn("[almacenamiento] aviso:", e.message);
  } finally {
    enCurso.delete(clinicaId);
  }
}

async function enviarAviso(clinicaId, nivel, a) {
  const sse = require("./sseManager");
  const webPush = require("./webPush");
  const { enviarEmail } = require("./mailer");
  const { urlPublica } = require("./urlPublica");

  const [[clinica]] = await pool.query("SELECT nombre FROM clinicas WHERE id = ?", [clinicaId]);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nombre = clinica?.nombre || `Clínica #${clinicaId}`;
  const pct = Math.min(Math.round(a.uso_pct), 999);
  const lleno = nivel >= 100;

  // Clínica: administradores; si no tiene, el médico/psicólogo dueño
  let [destino] = await pool.query(
    "SELECT id, email, nombres FROM usuarios WHERE clinica_id = ? AND activo = 1 AND tipo = 'ADMIN'", [clinicaId]);
  if (!destino.length) {
    [destino] = await pool.query(
      "SELECT id, email, nombres FROM usuarios WHERE clinica_id = ? AND activo = 1 AND tipo IN ('MEDICO','PSICOLOGO')", [clinicaId]);
  }
  const mensaje = lleno
    ? `Su clínica llegó al límite de su espacio (${a.espacio_legible} de ${a.cuota_legible}). Ya no se pueden subir archivos nuevos: solicite más espacio en Configuración → Almacenamiento.`
    : `Su clínica ya usa el ${pct}% de su espacio de almacenamiento (${a.espacio_legible} de ${a.cuota_legible}). Solicite más espacio antes de que se llene.`;
  const tipo = "ESPACIO_ALMACENAMIENTO";
  const enlace = `${urlPublica()}/admin/config?tab=almacenamiento`;

  if (destino.length) {
    await pool.query(
      "INSERT INTO notificaciones_usuario (usuario_id, clinica_id, tipo, mensaje) VALUES ?",
      [destino.map((u) => [u.id, clinicaId, tipo, mensaje.slice(0, 300)])]
    ).catch((e) => console.warn("[almacenamiento] notificación:", e.message));
    for (const u of destino) sse.notifyUser(u.id, "notificacion_portal", { tipo, mensaje });
    await webPush.sendToUsers(pool, destino.map((u) => u.id), {
      title: lleno ? "Espacio de almacenamiento lleno" : `Espacio de almacenamiento al ${pct}%`,
      body: mensaje, tag: `${tipo}_${nivel}`, data: { tipo, url: "/admin/config?tab=almacenamiento" },
    }).catch(() => {});
    for (const u of destino.filter((x) => x.email)) {
      await enviarEmail({
        to: u.email,
        subject: lleno ? `Su espacio de almacenamiento se llenó — ${nombre}` : `Su clínica usa el ${pct}% de su espacio — ${nombre}`,
        html: `<p>Hola ${esc(u.nombres)},</p><p>${esc(mensaje)}</p>
               <p><a href="${enlace}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Solicitar más espacio</a></p>
               <p style="color:#64748b;font-size:13px">Todos los archivos ya guardados siguen disponibles.</p>`,
      }).catch((e) => console.warn("[almacenamiento] email clínica:", e.message));
    }
  }

  // Super administradores de Medic-KG
  const [supers] = await pool.query("SELECT id, email FROM usuarios WHERE tipo = 'SUPER_ADMIN' AND activo = 1");
  const msgSuper = lleno
    ? `${nombre} llegó al límite de su almacenamiento (${a.espacio_legible} de ${a.cuota_legible}); ya no puede subir archivos.`
    : `${nombre} usa el ${pct}% de su almacenamiento (${a.espacio_legible} de ${a.cuota_legible}).`;
  if (supers.length) {
    sse.notifySuperAdmins("aviso_almacenamiento", { clinica_id: clinicaId, mensaje: msgSuper });
    await webPush.sendToUsers(pool, supers.map((u) => u.id), {
      title: lleno ? "Clínica sin espacio" : "Clínica al 80% de su espacio",
      body: msgSuper, tag: `${tipo}_${clinicaId}_${nivel}`, data: { tipo, url: "/superadmin/clinicas" },
    }).catch(() => {});
    for (const u of supers.filter((x) => x.email)) {
      await enviarEmail({
        to: u.email,
        subject: lleno ? `Sin espacio: ${nombre}` : `${nombre} al ${pct}% de su almacenamiento`,
        html: `<p>${esc(msgSuper)}</p><p>Puede ampliar su cuota desde el panel de Clínicas.</p>
               <p><a href="${urlPublica()}/superadmin/clinicas">Abrir panel de Clínicas</a></p>`,
      }).catch((e) => console.warn("[almacenamiento] email super admin:", e.message));
    }
  }
  console.log(`📦 [almacenamiento] aviso ${nivel}% enviado — ${nombre}`);
}

/** Revisión diaria de todas las clínicas activas (cron) */
async function revisarTodas() {
  const [clinicas] = await pool.query("SELECT id FROM clinicas WHERE activo = 1");
  for (const c of clinicas) await revisarAviso(c.id);
}

module.exports = { usoClinica, verificarEspacio, revisarAviso, revisarTodas, asegurarColumnaGaleria, DEFAULT_STORAGE_QUOTA_GB, DEFAULT_STORAGE_PRICE_PER_GB_LPS };
