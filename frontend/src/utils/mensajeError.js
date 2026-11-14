// Mensaje claro cuando falla una petición al servidor.
// Si el servidor no responde (apagado, sin internet, límite del hosting), el
// navegador no recibe respuesta: antes eso se mostraba como «Credenciales
// incorrectas» y la clínica creía que su contraseña estaba mal.
export const SIN_CONEXION = "No hay conexión con el servidor. Revise su internet o intente de nuevo en unos minutos.";
export const SERVIDOR_CAIDO = "El servidor no está disponible en este momento. Intente de nuevo en unos minutos.";

export function mensajeError(err, porDefecto) {
  const r = err?.response;
  if (!r) return SIN_CONEXION;                       // sin respuesta: servidor apagado o sin internet
  if (r.data?.msg) return r.data.msg;                // mensaje propio del sistema (ej.: contraseña incorrecta)
  if (r.status >= 500 || r.status === 404) return SERVIDOR_CAIDO; // página del hosting, no del sistema
  return porDefecto;
}
