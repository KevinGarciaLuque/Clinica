// Conteo anónimo de visitas y clics en las páginas públicas (clínica y médico).
// No usa cookies ni guarda datos del visitante; si falla, la página sigue igual.
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/** De dónde llegó el visitante: ?ref=qr, ?utm_source=… o el sitio anterior. */
export function detectarOrigen() {
  try {
    const q = new URLSearchParams(window.location.search);
    const ref = (q.get("ref") || q.get("utm_source") || "").toLowerCase();
    if (ref === "qr") return "QR";
    const fuente = ref || (document.referrer ? new URL(document.referrer).hostname : "");
    if (!fuente || fuente === window.location.hostname) return "DIRECTO";
    if (/google/.test(fuente)) return "GOOGLE";
    if (/facebook|fb\.|^fb$|m\.me|messenger/.test(fuente)) return "FACEBOOK";
    if (/instagram|^ig$/.test(fuente)) return "INSTAGRAM";
    if (/whatsapp|wa\.me|^wa$/.test(fuente)) return "WHATSAPP";
    if (/tiktok/.test(fuente)) return "TIKTOK";
    return "OTRO";
  } catch {
    return "DIRECTO";
  }
}

// El origen se calcula una vez al llegar: al tocar WhatsApp o agendar se
// atribuye al mismo canal que trajo la visita.
let origenSesion = null;

/**
 * @param {{clinica_slug?: string, medico_slug?: string}} pagina
 * @param {"VISTA"|"WHATSAPP"|"AGENDAR_CLIC"|"CITA"} tipo
 */
export function registrarEvento(pagina, tipo) {
  try {
    if (!origenSesion) origenSesion = detectarOrigen();
    const body = JSON.stringify({ ...pagina, tipo, origen: origenSesion });
    const url = `${API}/api/perfil-publico/evento`;
    // sendBeacon sobrevive aunque la página se cierre (p. ej. al abrir WhatsApp)
    // text/plain: un beacon con JSON entre dominios lo bloquearía CORS
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* el conteo nunca debe romper la página */ }
}
