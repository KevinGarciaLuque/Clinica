// Fecha y hora "de la clínica" en el navegador.
// La zona sale de Configuración de la clínica (GET /clinicas/zona-horaria) y se
// guarda en el navegador. Si el reloj del equipo está adelantado o atrasado, se
// corrige con la hora del servidor, así "hoy" siempre es el día de la clínica.
import api from "../api/api";

const CLAVE = "zona_clinica";
let zona = null;
let desfaseMs = 0; // hora del servidor − hora del equipo
let carga = null;

try { zona = JSON.parse(localStorage.getItem(CLAVE) || "null")?.timezone || null; } catch { /* sin almacenamiento */ }

export const ZONAS_POR_PAIS = {
  HN: "America/Tegucigalpa", GT: "America/Guatemala", SV: "America/El_Salvador", NI: "America/Managua",
  CR: "America/Costa_Rica", PA: "America/Panama", MX: "America/Mexico_City", CO: "America/Bogota",
  PE: "America/Lima", EC: "America/Guayaquil", BO: "America/La_Paz", CL: "America/Santiago",
  AR: "America/Argentina/Buenos_Aires", PY: "America/Asuncion", UY: "America/Montevideo",
  VE: "America/Caracas", DO: "America/Santo_Domingo", BR: "America/Sao_Paulo",
};

/** Descarga la zona de la clínica del usuario (una vez por sesión, o de nuevo con forzar) */
export function cargarZonaClinica(forzar = false) {
  if (carga && !forzar) return carga;
  const antes = Date.now();
  carga = api.get("/clinicas/zona-horaria")
    .then(({ data }) => {
      const despues = Date.now();
      zona = data.timezone || zona;
      // La hora del servidor corresponde a la mitad del viaje de la petición
      desfaseMs = data.ahora_servidor ? data.ahora_servidor - (antes + despues) / 2 : 0;
      try { localStorage.setItem(CLAVE, JSON.stringify({ timezone: zona })); } catch { /* sin almacenamiento */ }
      return { timezone: zona, desfaseMs, offsetMin: data.offset_min };
    })
    .catch(() => { carga = null; return null; });
  return carga;
}

export const zonaActual = () => zona;
export const desfaseReloj = () => desfaseMs;

/** Ahora (corrigiendo el reloj del equipo si está desfasado) */
export const ahoraCorregido = () => new Date(Date.now() + desfaseMs);

/** "YYYY-MM-DD" de hoy en la clínica (si no se conoce la zona, la del equipo) */
export function hoyClinica() {
  const d = ahoraCorregido();
  if (zona) {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
    catch { /* zona no válida */ }
  }
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Hora legible en una zona: "7:45 p. m." */
export function horaEnZona(tz, fecha = ahoraCorregido()) {
  try { return fecha.toLocaleTimeString("es-HN", { timeZone: tz, hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}

/** Fecha larga en una zona: "jueves, 16 de octubre" */
export function fechaEnZona(tz, fecha = ahoraCorregido()) {
  try { return fecha.toLocaleDateString("es-HN", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }); }
  catch { return ""; }
}

/** Minutos de diferencia con UTC de una zona en este momento (Honduras = -360) */
export function offsetZona(tz, fecha = new Date()) {
  try {
    const partes = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
    }).formatToParts(fecha).map((x) => [x.type, x.value]));
    const comoUtc = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute);
    return Math.round((comoUtc - Math.floor(fecha.getTime() / 60000) * 60000) / 60000);
  } catch { return null; }
}
