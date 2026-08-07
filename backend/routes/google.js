/**
 * routes/google.js
 * Conexión OAuth2 de cada médico con su cuenta de Google Calendar.
 */

const router = require("express").Router();
const jwt = require("jsonwebtoken");
const pool = require("../db");
const auth = require("../middlewares/auth");
const gcal = require("../utils/googleCalendar");

const ROLES_CONECTABLES = ["MEDICO", "PSICOLOGO", "ADMIN", "SUPER_ADMIN"];

// GET /api/google/connect → redirige a la pantalla de consentimiento de Google
router.get("/connect", auth(...ROLES_CONECTABLES), (req, res) => {
  const state = jwt.sign(
    { medico_id: req.user.uid, clinica_id: req.user.clinica_id },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  res.redirect(gcal.getAuthUrl(state));
});

// GET /api/google/callback → intercambia el code por tokens y los guarda
router.get("/callback", async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  try {
    const { code, state } = req.query;
    if (!code || !state) throw new Error("Faltan parámetros de OAuth");

    const payload = jwt.verify(state, process.env.JWT_SECRET);
    const client = gcal.getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const { google } = require("googleapis");
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: perfil } = await oauth2.userinfo.get();

    await gcal.guardarTokens(payload.medico_id, payload.clinica_id, tokens, perfil.email);

    res.redirect(`${frontendUrl}/perfil?google=ok`);
  } catch (e) {
    console.error("[google/callback]", e.message);
    res.redirect(`${frontendUrl}/perfil?google=error`);
  }
});

// GET /api/google/status
router.get("/status", auth(), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT google_email FROM medico_google_tokens WHERE medico_id=? LIMIT 1",
      [req.user.uid]
    );
    res.json({ ok: true, conectado: !!row, google_email: row?.google_email || null });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// DELETE /api/google/disconnect
router.delete("/disconnect", auth(), async (req, res) => {
  try {
    await pool.query("DELETE FROM medico_google_tokens WHERE medico_id=?", [req.user.uid]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
