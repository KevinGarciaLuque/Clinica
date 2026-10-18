/**
 * utils/daily.js — Salas de videollamada con Daily (https://www.daily.co).
 *
 * Se activa poniendo DAILY_API_KEY en las variables del servidor (Railway).
 * Cada cita tiene su sala PRIVADA: solo se entra con un pase (token) que el
 * sistema genera al momento y que vence solo.
 */
const API = () => (process.env.DAILY_API_URL || "https://api.daily.co/v1").replace(/\/$/, "");

const disponible = () => !!process.env.DAILY_API_KEY;

async function llamar(metodo, ruta, cuerpo) {
  const r = await fetch(`${API()}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(datos?.info || datos?.error || `Daily respondió ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return datos;
}

/** Crea (o recupera) una sala privada que se cierra sola en `exp` (segundos Unix) */
async function crearSala(nombre, exp) {
  try {
    return await llamar("POST", "/rooms", {
      name: nombre,
      privacy: "private",
      properties: {
        exp,
        eject_at_room_exp: true,
        max_participants: 4,
        enable_prejoin_ui: true,
        enable_chat: true,
        enable_screenshare: true,
        lang: "es",
      },
    });
  } catch (e) {
    if (e.status === 400 && /already exists/i.test(e.message)) return llamar("GET", `/rooms/${encodeURIComponent(nombre)}`);
    throw e;
  }
}

/** Pase de entrada a la sala (el médico entra como "dueño" de la sala) */
async function crearPase(sala, { nombre, dueno = false, exp }) {
  const r = await llamar("POST", "/meeting-tokens", {
    properties: { room_name: sala, user_name: String(nombre || "").slice(0, 80), is_owner: !!dueno, exp },
  });
  return r.token;
}

async function borrarSala(nombre) {
  try { await llamar("DELETE", `/rooms/${encodeURIComponent(nombre)}`); } catch { /* ya no existe */ }
}

module.exports = { disponible, crearSala, crearPase, borrarSala };
