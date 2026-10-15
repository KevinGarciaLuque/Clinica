// Cliente del portal del paciente. Usa su propia sesión (portal_token),
// separada por completo de la sesión del personal de la clínica.
import axios from "axios";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api/portal";
const CLAVE = "portal_token";

export function leerSesion() {
  try { return localStorage.getItem(CLAVE); } catch { return null; }
}
export function guardarSesion(token) {
  try { localStorage.setItem(CLAVE, token); } catch { /* sin almacenamiento: dura lo que la pestaña */ }
}
export function cerrarSesion() {
  try { localStorage.removeItem(CLAVE); } catch { /* nada que limpiar */ }
}

export const portalApi = {
  pedirAcceso: (email) => axios.post(`${BASE}/acceso`, { email }),
  entrar: (token) => axios.post(`${BASE}/entrar`, { token }),
  get: (ruta) => axios.get(`${BASE}${ruta}`, { headers: { Authorization: `Bearer ${leerSesion()}` } }),
};

// "2026-10-20 15:30:00" es hora local de la clínica: se muestra tal cual
export function fechaHora(txt) {
  if (!txt) return { fecha: "", hora: "" };
  const [f, h = "00:00"] = String(txt).split(" ");
  const [y, m, d] = f.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  const fecha = new Date(y, m - 1, d).toLocaleDateString("es-HN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const hora = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "a. m." : "p. m."}`;
  return { fecha, hora };
}
