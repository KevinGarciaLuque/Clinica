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
        return res.status(413).json({ ok: false, msg: MSG_LLENO, message: MSG_LLENO, espacio_lleno: true });
      }
      next();
    } catch (e) {
      // Si no se pudo calcular, no se bloquea el trabajo de la clínica
      console.warn("[almacenamiento] verificarEspacio:", e.message);
      next();
    }
  };
}

module.exports = { usoClinica, verificarEspacio, asegurarColumnaGaleria, DEFAULT_STORAGE_QUOTA_GB, DEFAULT_STORAGE_PRICE_PER_GB_LPS };
