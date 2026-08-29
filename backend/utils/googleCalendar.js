/**
 * utils/googleCalendar.js
 * Integración con Google Calendar API para sincronizar citas y
 * consultar disponibilidad (free/busy) de cada médico.
 * Todas las funciones son "best effort": si el médico no ha
 * conectado su cuenta de Google, se comportan como no-op.
 */

const { google } = require("googleapis");
const pool = require("../db");
const { encrypt, decrypt } = require("./crypto");

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/** Guarda o actualiza los tokens de un médico (cifrados) */
async function guardarTokens(medicoId, clinicaId, tokens, googleEmail) {
  const accessEnc = encrypt(tokens.access_token);
  const refreshEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

  if (refreshEnc) {
    await pool.query(
      `INSERT INTO medico_google_tokens (medico_id, clinica_id, google_email, access_token, refresh_token, expiry_date)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         google_email=VALUES(google_email), access_token=VALUES(access_token),
         refresh_token=VALUES(refresh_token), expiry_date=VALUES(expiry_date)`,
      [medicoId, clinicaId, googleEmail || null, accessEnc, refreshEnc, tokens.expiry_date || null]
    );
  } else {
    // Google no mandó refresh_token (suele pasar si la cuenta ya autorizó la app
    // hace poco). Solo podemos actualizar el access_token si ya existe una fila.
    const [r] = await pool.query(
      `UPDATE medico_google_tokens SET access_token=?, expiry_date=? WHERE medico_id=?`,
      [accessEnc, tokens.expiry_date || null, medicoId]
    );
    if (!r.affectedRows) {
      // No hay refresh_token y no había conexión previa → no se puede guardar algo
      // útil. Avisar para que el usuario revoque el acceso y reconecte.
      throw new Error(
        "Google no devolvió un token de actualización. Quitá el acceso de Medic-KG en " +
        "myaccount.google.com/permissions y volvé a conectar."
      );
    }
  }
}

/** Devuelve un cliente OAuth2 autenticado para el médico, o null si no está conectado */
async function getClientForMedico(medicoId) {
  const [[row]] = await pool.query(
    "SELECT * FROM medico_google_tokens WHERE medico_id=? LIMIT 1",
    [medicoId]
  );
  if (!row) return null;

  const client = getOAuthClient();
  client.setCredentials({
    access_token: decrypt(row.access_token),
    refresh_token: decrypt(row.refresh_token),
    expiry_date: row.expiry_date,
  });

  client.on("tokens", (tokens) => {
    guardarTokens(medicoId, row.clinica_id, tokens).catch((e) =>
      console.error("[googleCalendar] error guardando refresh de token:", e.message)
    );
  });

  return { client, calendarId: row.calendar_id || "primary" };
}

function eventoDesdeCita(cita, tz) {
  return {
    summary: `Cita: ${cita.paciente_nombre}`,
    description: cita.motivo || undefined,
    start: { dateTime: cita.inicio, timeZone: tz },
    end: { dateTime: cita.fin, timeZone: tz },
  };
}

async function crearEvento(medicoId, cita, tz) {
  const conn = await getClientForMedico(medicoId);
  if (!conn) return null;
  const calendar = google.calendar({ version: "v3", auth: conn.client });
  const { data } = await calendar.events.insert({
    calendarId: conn.calendarId,
    requestBody: eventoDesdeCita(cita, tz),
  });
  return data.id;
}

async function actualizarEvento(medicoId, googleEventId, cita, tz) {
  const conn = await getClientForMedico(medicoId);
  if (!conn || !googleEventId) return;
  const calendar = google.calendar({ version: "v3", auth: conn.client });
  await calendar.events.patch({
    calendarId: conn.calendarId,
    eventId: googleEventId,
    requestBody: eventoDesdeCita(cita, tz),
  });
}

async function borrarEvento(medicoId, googleEventId) {
  const conn = await getClientForMedico(medicoId);
  if (!conn || !googleEventId) return;
  const calendar = google.calendar({ version: "v3", auth: conn.client });
  try {
    await calendar.events.delete({ calendarId: conn.calendarId, eventId: googleEventId });
  } catch (e) {
    // El evento ya pudo haber sido borrado manualmente en Google Calendar
    if (e.code !== 404 && e.code !== 410) throw e;
  }
}

/** Devuelve bloques ocupados [{inicio, fin}] según el Google Calendar del médico */
async function consultarFreeBusy(medicoId, timeMin, timeMax, tz) {
  const conn = await getClientForMedico(medicoId);
  if (!conn) return [];
  const calendar = google.calendar({ version: "v3", auth: conn.client });
  const { data } = await calendar.freebusy.query({
    requestBody: { timeMin, timeMax, timeZone: tz, items: [{ id: conn.calendarId }] },
  });
  const busy = data.calendars?.[conn.calendarId]?.busy || [];
  return busy.map((b) => ({ inicio: b.start, fin: b.end }));
}

module.exports = {
  getOAuthClient,
  getAuthUrl,
  guardarTokens,
  getClientForMedico,
  crearEvento,
  actualizarEvento,
  borrarEvento,
  consultarFreeBusy,
};
