/**
 * utils/sucursales.js — Sucursales (varios locales de una misma clínica).
 *
 * Reglas para no afectar a las clínicas actuales:
 *  - Mientras la clínica tenga menos de 2 sucursales activas, NADA se filtra ni cambia.
 *  - Los registros viejos (sucursal_id NULL) pertenecen a la sede principal.
 *  - En horarios, sucursal_id NULL significa "atiende en todas las sucursales".
 *  - Los pacientes y su expediente son de la clínica: se comparten entre sucursales.
 *
 * El navegador manda la sucursal elegida en el encabezado "x-sucursal-id"
 * (vacío o "todas" = todas las sucursales).
 */
const pool = require("../db");

const COLUMNAS = ["citas", "caja_turnos", "facturas", "gastos", "horarios_medico"];
const ROLES_LIBRES = ["ADMIN", "SUPER_ADMIN"]; // nunca se restringen a una sucursal

let listo = null;
function asegurarSucursales() {
  if (!listo) {
    listo = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sucursales (
          id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          clinica_id   INT UNSIGNED NOT NULL,
          nombre       VARCHAR(120) NOT NULL,
          direccion    VARCHAR(255) NULL,
          telefono     VARCHAR(40)  NULL,
          es_principal TINYINT(1) NOT NULL DEFAULT 0,
          activo       TINYINT(1) NOT NULL DEFAULT 1,
          orden        INT NOT NULL DEFAULT 0,
          creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_suc_clinica (clinica_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuario_sucursales (
          usuario_id  INT UNSIGNED NOT NULL,
          sucursal_id INT UNSIGNED NOT NULL,
          PRIMARY KEY (usuario_id, sucursal_id),
          INDEX idx_us_sucursal (sucursal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      for (const tabla of COLUMNAS) {
        try {
          const [col] = await pool.query(`SHOW COLUMNS FROM \`${tabla}\` LIKE 'sucursal_id'`);
          if (!col.length) await pool.query(`ALTER TABLE \`${tabla}\` ADD COLUMN sucursal_id INT UNSIGNED NULL`);
        } catch (e) {
          if (e.code !== "ER_NO_SUCH_TABLE") console.warn(`[sucursales] columna en ${tabla}:`, e.message);
        }
      }
    })().catch((e) => { listo = null; throw e; });
  }
  return listo;
}

// Sucursales activas por clínica (en memoria 60 s; se olvida al editarlas)
const cache = new Map();
async function sucursalesDe(clinicaId) {
  if (!clinicaId) return [];
  const c = cache.get(clinicaId);
  if (c && c.hasta > Date.now()) return c.lista;
  await asegurarSucursales();
  const [lista] = await pool.query(
    `SELECT id, nombre, direccion, telefono, es_principal FROM sucursales
     WHERE clinica_id = ? AND activo = 1 ORDER BY es_principal DESC, orden, id`,
    [clinicaId]
  );
  cache.set(clinicaId, { lista, hasta: Date.now() + 60000 });
  return lista;
}
const olvidar = (clinicaId) => cache.delete(Number(clinicaId));

const clinicaDe = (req) => (req.user?.super ? req.tenant?.clinica_id : req.user?.clinica_id) || req.tenant?.clinica_id || null;

/**
 * Contexto de sucursal del request:
 *  { multiple, lista, principalId, ids }  — ids = sucursales a mostrar (null = todas, sin filtro)
 */
async function contextoSucursal(req) {
  if (req._sucursal) return req._sucursal;
  const clinicaId = clinicaDe(req);
  const lista = await sucursalesDe(clinicaId);
  const ctx = { multiple: lista.length >= 2, lista, principalId: lista.find((s) => s.es_principal)?.id || lista[0]?.id || null, ids: null, unica: null };
  if (ctx.multiple) {
    const validas = new Set(lista.map((s) => s.id));
    let permitidas = null;
    if (req.user && !ROLES_LIBRES.includes(req.user.tipo)) {
      const [rows] = await pool.query("SELECT sucursal_id FROM usuario_sucursales WHERE usuario_id = ?", [req.user.id]);
      const asignadas = rows.map((r) => r.sucursal_id).filter((id) => validas.has(id));
      if (asignadas.length) permitidas = asignadas;
    }
    const pedida = Number(req.headers["x-sucursal-id"]) || null;
    if (pedida && validas.has(pedida) && (!permitidas || permitidas.includes(pedida))) ctx.ids = [pedida];
    else ctx.ids = permitidas;
    ctx.unica = ctx.ids?.length === 1 ? ctx.ids[0] : null;
  }
  req._sucursal = ctx;
  return ctx;
}

/** Registros viejos (sin sucursal) muestran el nombre de la sede principal */
async function nombrarPrincipal(req, filas) {
  const ctx = await contextoSucursal(req);
  if (!ctx.multiple) return filas;
  const principal = ctx.lista.find((s) => s.id === ctx.principalId)?.nombre || null;
  for (const f of filas) if (!f.sucursal_nombre) f.sucursal_nombre = principal;
  return filas;
}

/** Condición SQL para filtrar por sucursal: { sql: " AND (...)", params } (vacía si no aplica) */
async function filtroSucursal(req, col) {
  const ctx = await contextoSucursal(req);
  if (!ctx.ids) return { sql: "", params: [] };
  const conPrincipal = ctx.ids.includes(ctx.principalId);
  return {
    sql: conPrincipal ? ` AND (${col} IN (?) OR ${col} IS NULL)` : ` AND ${col} IN (?)`,
    params: [ctx.ids],
  };
}

/**
 * Sucursal con la que se guarda un registro nuevo.
 * Prioridad: la elegida en el formulario → la sucursal activa → null (sede principal).
 */
async function sucursalParaGuardar(req, elegida) {
  const ctx = await contextoSucursal(req);
  if (!ctx.multiple) return null;
  const id = Number(elegida) || null;
  if (id && ctx.lista.some((s) => s.id === id)) return id;
  return ctx.unica;
}

/** Una sola sucursal para lo que no admite "todas" (la caja): la activa o la principal */
async function sucursalUnica(req) {
  const ctx = await contextoSucursal(req);
  if (!ctx.multiple) return null;
  return ctx.unica || ctx.ids?.[0] || ctx.principalId;
}

/** Condición para registros de UNA sucursal (NULL cuenta como la principal) */
function condicionUna(col, sucursalId, principalId) {
  if (!sucursalId) return { sql: "", params: [] };
  if (sucursalId === principalId) return { sql: ` AND (${col} = ? OR ${col} IS NULL)`, params: [sucursalId] };
  return { sql: ` AND ${col} = ?`, params: [sucursalId] };
}

/** Sucursal según el horario del médico para esa hora (citas en línea, portal, etc.) */
async function sucursalPorHorario(clinicaId, medicoId, inicio) {
  try {
    const lista = await sucursalesDe(clinicaId);
    if (lista.length < 2 || !inicio) return null;
    const txt = String(inicio).replace(" ", "T");
    const fecha = new Date(`${txt.slice(0, 10)}T12:00:00Z`);
    const dia = (fecha.getUTCDay() + 6) % 7; // 0 = lunes
    const hora = txt.slice(11, 16);
    const [[h]] = await pool.query(
      `SELECT sucursal_id FROM horarios_medico
       WHERE clinica_id = ? AND medico_id = ? AND dia_semana = ? AND activo = 1
         AND sucursal_id IS NOT NULL AND hora_inicio <= ? AND hora_fin > ? LIMIT 1`,
      [clinicaId, medicoId, dia, hora, hora]
    );
    return h?.sucursal_id && lista.some((s) => s.id === h.sucursal_id) ? h.sucursal_id : null;
  } catch {
    return null;
  }
}

/** Para citas creadas fuera de la agenda (en línea, portal, asistente): sucursal según el horario */
async function asignarSucursalPorHorario(citaId, clinicaId, medicoId, inicio) {
  try {
    const id = await sucursalPorHorario(clinicaId, medicoId, inicio);
    if (id) await pool.query("UPDATE citas SET sucursal_id = ? WHERE id = ?", [id, citaId]);
  } catch (e) {
    console.warn("[sucursales] cita sin sucursal:", e.message);
  }
}

module.exports = {
  asignarSucursalPorHorario, asegurarSucursales, nombrarPrincipal, sucursalesDe, olvidar, contextoSucursal, filtroSucursal,
  sucursalParaGuardar, sucursalUnica, condicionUna, sucursalPorHorario,
};
