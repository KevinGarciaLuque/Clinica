/**
 * "Clínica activa" del SUPER_ADMIN: contexto temporal para ver una clínica
 * puntual (ej. su listado de pacientes) sin tener una clínica propia.
 *
 * Se guarda en sessionStorage (no localStorage): se pierde al cerrar la
 * pestaña o iniciar sesión de nuevo — nunca queda "pegado" entre sesiones.
 * api.js la usa para mandar x-clinica-id; el resto de la app se entera de
 * los cambios suscribiéndose con onClinicaActivaChange / useClinicaActiva.
 */

const KEY = "clinica_activa_superadmin";
const listeners = new Set();

export function getClinicaActiva() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

/** @param {{id:number, nombre:string}} clinica */
export function setClinicaActiva(clinica) {
  sessionStorage.setItem(KEY, JSON.stringify(clinica));
  listeners.forEach((fn) => fn(clinica));
}

export function limpiarClinicaActiva() {
  sessionStorage.removeItem(KEY);
  listeners.forEach((fn) => fn(null));
}

export function onClinicaActivaChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
