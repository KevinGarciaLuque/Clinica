// La fecha de nacimiento es un día del calendario, no un momento: "1990-02-28".
// El servidor la manda como "1990-02-28T00:00:00.000Z" (medianoche en UTC) y el
// navegador, en Honduras (UTC-6), la convertía en el 27 a las 6 p. m.: por eso
// se veía un día antes. Aquí se deja siempre como "YYYY-MM-DD" sin hora.

const ES_CLAVE = /(^|_)fecha_nacimiento$|fechaNacimiento$/;
const CON_HORA = /^\d{4}-\d{2}-\d{2}T/;

/** Quita la hora a las fechas de nacimiento de una respuesta del servidor (en el mismo objeto) */
export function normalizarFechasNacimiento(dato, nivel = 0) {
  if (!dato || typeof dato !== "object" || nivel > 6) return dato;
  if (Array.isArray(dato)) {
    for (const x of dato) normalizarFechasNacimiento(x, nivel + 1);
    return dato;
  }
  for (const k of Object.keys(dato)) {
    const v = dato[k];
    if (typeof v === "string") {
      if (ES_CLAVE.test(k) && CON_HORA.test(v)) dato[k] = v.slice(0, 10);
    } else if (v && typeof v === "object") normalizarFechasNacimiento(v, nivel + 1);
  }
  return dato;
}

/** Date en la medianoche LOCAL de una fecha "YYYY-MM-DD" (new Date("YYYY-MM-DD") la toma en UTC) */
export function fechaLocal(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(valor);
}
