/**
 * utils/zonaHoraria.js
 * Fechas y horas "de la clínica" (según clinicas.timezone, por defecto Honduras).
 *
 * El servidor (Railway) y su base de datos trabajan en UTC: los campos como
 * facturas.creado_en o caja.cerrado_en se guardan en esa hora. Si se compara
 * con CURDATE() o se agrupa con DATE(creado_en), todo lo hecho después de las
 * 6 p. m. (Honduras) cae en el día siguiente. Estas ayudas lo evitan.
 *
 *  - zonaClinica(clinicaId)      → "America/Tegucigalpa" (con caché de 5 min)
 *  - hoyClinica(tz)              → "2026-10-16"
 *  - localSql(col, tz)           → expresión SQL: el campo pasado a hora de la clínica
 *  - ahoraLocalSql(tz)           → expresión SQL: "ahora" en hora de la clínica
 *
 * La conversión funciona sea cual sea la zona horaria de la base de datos: se
 * calcula su diferencia con UTC en la misma consulta.
 */
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool = require("../db");

const ZONA_DEFECTO = "America/Tegucigalpa";
const cache = new Map(); // clinicaId → { tz, hasta }

function zonaValida(tz) {
  try { dayjs().tz(tz); return !!tz; } catch { return false; }
}

async function zonaClinica(clinicaId) {
  if (!clinicaId) return ZONA_DEFECTO;
  const c = cache.get(clinicaId);
  if (c && c.hasta > Date.now()) return c.tz;
  let tz = ZONA_DEFECTO;
  try {
    const [[row]] = await pool.query("SELECT timezone FROM clinicas WHERE id = ?", [clinicaId]);
    if (row?.timezone && zonaValida(row.timezone)) tz = row.timezone;
  } catch { /* sin columna timezone: se usa Honduras */ }
  cache.set(clinicaId, { tz, hasta: Date.now() + 5 * 60 * 1000 });
  return tz;
}

/** Olvida la zona guardada en caché (al cambiarla en Configuración) */
function olvidarZona(clinicaId) { cache.delete(Number(clinicaId)); cache.delete(String(clinicaId)); }

const ahoraClinica = (tz = ZONA_DEFECTO) => dayjs().tz(zonaValida(tz) ? tz : ZONA_DEFECTO);
const hoyClinica = (tz) => ahoraClinica(tz).format("YYYY-MM-DD");

/** Minutos de diferencia de la clínica con UTC (ej. Honduras = -360) */
const offsetMin = (tz) => Math.round(ahoraClinica(tz).utcOffset());

/** Diferencia de la base de datos con UTC, calculada en la propia consulta */
const OFFSET_BD = "ROUND(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) / 60)";

/** Expresión SQL que convierte un DATETIME guardado (hora de la BD) a hora de la clínica */
function localSql(col, tz) {
  const off = offsetMin(tz);
  return `DATE_ADD(${col}, INTERVAL (${Number.isFinite(off) ? off : -360} - ${OFFSET_BD}) MINUTE)`;
}

/** "Ahora" en hora de la clínica, como expresión SQL (reemplaza a NOW()/CURDATE()) */
const ahoraLocalSql = (tz) => localSql("NOW()", tz);

module.exports = { ZONA_DEFECTO, zonaClinica, olvidarZona, ahoraClinica, hoyClinica, localSql, ahoraLocalSql, offsetMin };
