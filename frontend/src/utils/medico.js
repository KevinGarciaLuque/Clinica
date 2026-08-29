/**
 * utils/medico.js
 * Presentación del nombre del médico según la preferencia de la clínica.
 *
 * Refleja la columna `clinicas.titulo_medico` (AuthContext la sincroniza en
 * localStorage tras el login y en cada montaje):
 *   activo (default) → "Dr. Juan Pérez – Cardiología"
 *   inactivo         → "Juan Pérez"  (la especialidad se sigue guardando en BD)
 *
 * Se lee de localStorage para poder usarse tanto en componentes como en
 * funciones sueltas (generadores de PDF, helpers). Se puede forzar el valor
 * pasándolo como argumento (útil en tests o SSR).
 */

/** ¿La clínica actual muestra el título "Dr./Dra." y la especialidad? */
export function tituloMedicoActivo() {
  try {
    const raw = localStorage.getItem("titulo_medico");
    return raw ? JSON.parse(raw) !== false : true;
  } catch {
    return true;
  }
}

/** Prefijo "Dr. " (con espacio) o cadena vacía. */
export function prefijoDr(titulo = tituloMedicoActivo()) {
  return titulo ? "Dr. " : "";
}

/**
 * Sufijo de especialidad, p.ej. " – Cardiología", o cadena vacía.
 * Se oculta tanto si la clínica desactivó el título como si no hay especialidad.
 */
export function sufijoEsp(especialidad = "", sep = "–", titulo = tituloMedicoActivo()) {
  return titulo && especialidad ? ` ${sep} ${especialidad}` : "";
}
