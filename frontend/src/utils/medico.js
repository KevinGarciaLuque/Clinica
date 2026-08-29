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

/**
 * Nombre del médico para mostrar en la interfaz.
 *
 * Prioridad:
 *   1. `nombre_display` que el médico/admin configuró → se usa TAL CUAL (ignora
 *      el prefijo "Dr." y la especialidad; es la elección explícita del médico).
 *   2. Fallback: `${prefijoDr()}Nombre Apellido` (+ especialidad si se pide),
 *      gobernado por el flag `titulo_medico` de la clínica.
 *
 * Acepta objetos de médico (`{nombres, apellidos, nombre_display, especialidad}`)
 * o de cita (`{medico_nombres, medico_apellidos, medico_nombre_display, especialidad}`).
 *
 * @param {object} m
 * @param {object} [opts]
 * @param {boolean} [opts.conEspecialidad=false]  añade " – Especialidad" al fallback
 * @param {string}  [opts.sep="–"]               separador de la especialidad
 * @param {boolean} [opts.titulo]                 fuerza mostrar/ocultar "Dr." (default: flag de la clínica)
 */
export function nombreMedico(m, { conEspecialidad = false, sep = "–", titulo } = {}) {
  if (!m) return "";
  const t = titulo === undefined ? tituloMedicoActivo() : titulo;
  const display = String(m.nombre_display ?? m.medico_nombre_display ?? m.med_nombre_display ?? "").trim();
  if (display) return display;
  const nom = (m.nombres ?? m.medico_nombres ?? m.med_nombres ?? "").trim();
  const ape = (m.apellidos ?? m.medico_apellidos ?? m.med_apellidos ?? "").trim();
  const base = `${t ? "Dr. " : ""}${nom} ${ape}`.replace(/\s+/g, " ").trim();
  const esp = m.especialidad ?? "";
  return conEspecialidad ? base + sufijoEsp(esp, sep, t) : base;
}
