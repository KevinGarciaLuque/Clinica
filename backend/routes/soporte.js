const router        = require("express").Router();
const pool          = require("../db");
const auth          = require("../middlewares/auth");
const sse           = require("../utils/sseManager");
const webPush       = require("../utils/webPush");
const { randomUUID } = require("crypto");

// Tokens de corta duración para el canal SSE
// Clave: uuid  →  Valor: { userId, tipo, expires }
const sseTokens = new Map();

// Limpieza periódica de tokens expirados (cada minuto)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sseTokens) {
    if (v.expires < now) sseTokens.delete(k);
  }
}, 60_000);

// ──────────────────────────────────────────────
//  POST /api/soporte/stream-token
//  Emite un UUID de un solo uso (2 min) para abrir el canal SSE.
//  El frontend lo obtiene con su JWT normal y lo pasa en la URL del EventSource,
//  evitando que el JWT completo aparezca en logs y en el historial del navegador.
//  El rate limit de este endpoint se aplica en server.js.
// ──────────────────────────────────────────────
router.post("/stream-token", auth(), (req, res) => {
  const token = randomUUID();
  sseTokens.set(token, {
    userId:  req.user.id,
    tipo:    req.user.tipo,
    expires: Date.now() + 2 * 60 * 1000, // 2 minutos para abrir el canal
  });
  res.json({ ok: true, token });
});

// ──────────────────────────────────────────────
//  GET /api/soporte/stream?sse_token=<uuid>
//  SSE — canal de notificaciones en tiempo real
// ──────────────────────────────────────────────
router.get("/stream", (req, res) => {
  const sseToken = req.query.sse_token;
  if (!sseToken) {
    return res.status(401).json({ ok: false, msg: "sse_token requerido" });
  }

  const session = sseTokens.get(sseToken);

  // Eliminar siempre (válido o no) para garantizar uso único
  sseTokens.delete(sseToken);

  if (!session || session.expires < Date.now()) {
    return res.status(401).json({ ok: false, msg: "Token de stream inválido o expirado" });
  }

  const userId       = session.userId;
  const isSuperAdmin = session.tipo === "SUPER_ADMIN";

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Nginx: deshabilitar buffer
  res.flushHeaders();

  // Heartbeat cada 25s para mantener la conexión viva
  const hb = setInterval(() => {
    try { res.write(":heartbeat\n\n"); } catch { clearInterval(hb); }
  }, 25000);

  sse.addClient(userId, isSuperAdmin, res);

  req.on("close", () => {
    clearInterval(hb);
    sse.removeClient(userId, res);
  });
});

// ──────────────────────────────────────────────
//  POST /api/soporte/reportar
//  Cualquier usuario autenticado puede reportar un problema
// ──────────────────────────────────────────────
router.post("/reportar", auth(), async (req, res) => {
  try {
    const { asunto, descripcion } = req.body;

    if (!asunto || !descripcion) {
      return res.status(400).json({ ok: false, msg: "Asunto y descripción son requeridos" });
    }
    if (descripcion.length > 2000) {
      return res.status(400).json({ ok: false, msg: "La descripción no puede superar 2000 caracteres" });
    }

    // Obtener datos completos del usuario (auth solo expone id/tipo/clinica_id)
    const [uRows] = await pool.query(
      "SELECT nombres, apellidos, email FROM usuarios WHERE id=? LIMIT 1",
      [req.user.id]
    );
    if (!uRows.length) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    }
    const { nombres, apellidos, email } = uRows[0];
    const nombre     = `${nombres || ""} ${apellidos || ""}`.trim();
    const clinica_id = req.tenant?.clinica_id || req.user.clinica_id || null;

    await pool.query(
      `INSERT INTO reportes_soporte (clinica_id, usuario_id, usuario_nombre, usuario_email, asunto, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clinica_id, req.user.id, nombre, email, asunto.trim(), descripcion.trim()]
    );

    // Notificar en tiempo real a todos los SUPER_ADMIN conectados
    sse.notifySuperAdmins("nuevo_reporte", {
      usuario_nombre: nombre,
      asunto: asunto.trim(),
    });

    res.json({ ok: true, msg: "Reporte enviado correctamente" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  GET /api/soporte/reportes
//  Solo SUPER_ADMIN — reportes pendientes (para navbar badge)
// ──────────────────────────────────────────────
router.get("/reportes", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.clinica_id, c.nombre AS clinica_nombre,
              r.usuario_id, r.usuario_nombre, r.usuario_email,
              r.asunto, r.descripcion, r.estado, r.creado_en
       FROM reportes_soporte r
       LEFT JOIN clinicas c ON c.id = r.clinica_id
       WHERE r.estado = 'pendiente'
       ORDER BY r.creado_en DESC
       LIMIT 50`
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  GET /api/soporte/reportes/historial
//  Solo SUPER_ADMIN — historial completo con filtro opcional
// ──────────────────────────────────────────────
router.get("/reportes/historial", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { estado } = req.query;
    const validEstados = ["pendiente", "en_proceso", "atendido"];
    const params = [];
    let where = "";
    if (estado && validEstados.includes(estado)) {
      where = "WHERE r.estado = ?";
      params.push(estado);
    }

    let rows;
    try {
      // Query completo (requiere migración 029)
      [rows] = await pool.query(
        `SELECT r.id, r.clinica_id, c.nombre AS clinica_nombre,
                r.usuario_id, r.usuario_nombre, r.usuario_email,
                r.asunto, r.descripcion, r.respuesta, r.estado,
                r.creado_en, r.atendido_en
         FROM reportes_soporte r
         LEFT JOIN clinicas c ON c.id = r.clinica_id
         ${where}
         ORDER BY r.creado_en DESC
         LIMIT 200`,
        params
      );
    } catch (colErr) {
      // Fallback: sin columnas de migración 029 (respuesta/leido_usuario aún no existen)
      [rows] = await pool.query(
        `SELECT r.id, r.clinica_id, c.nombre AS clinica_nombre,
                r.usuario_id, r.usuario_nombre, r.usuario_email,
                r.asunto, r.descripcion, NULL AS respuesta, r.estado,
                r.creado_en, r.atendido_en
         FROM reportes_soporte r
         LEFT JOIN clinicas c ON c.id = r.clinica_id
         ${where}
         ORDER BY r.creado_en DESC
         LIMIT 200`,
        params
      );
    }

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  PUT /api/soporte/reportes/:id/estado
//  Solo SUPER_ADMIN — actualiza estado y respuesta
// ──────────────────────────────────────────────
router.put("/reportes/:id/estado", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, respuesta } = req.body;
    const validEstados = ["pendiente", "en_proceso", "atendido"];
    if (!validEstados.includes(estado)) {
      return res.status(400).json({ ok: false, msg: "Estado inválido" });
    }
    if (estado === "atendido") {
      await pool.query(
        "UPDATE reportes_soporte SET estado=?, respuesta=?, atendido_en=NOW(), leido_usuario=0 WHERE id=?",
        [estado, respuesta || null, id]
      );
    } else {
      await pool.query(
        "UPDATE reportes_soporte SET estado=?, respuesta=?, leido_usuario=0 WHERE id=?",
        [estado, respuesta || null, id]
      );
    }

    // Si hay respuesta, notificar en tiempo real al usuario del reporte
    if (respuesta) {
      const [rRows] = await pool.query(
        "SELECT usuario_id, asunto FROM reportes_soporte WHERE id=? LIMIT 1", [id]
      );
      if (rRows.length) {
        sse.notifyUser(rRows[0].usuario_id, "respuesta_reporte", {
          id: Number(id),
          asunto: rRows[0].asunto,
          respuesta,
          estado,
        });
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  PUT /api/soporte/reportes/:id/atender
//  Marcar un reporte como atendido (legacy)
// ──────────────────────────────────────────────
router.put("/reportes/:id/atender", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE reportes_soporte SET estado='atendido', atendido_en=NOW() WHERE id=?",
      [id]
    );
    res.json({ ok: true, msg: "Reporte marcado como atendido" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  GET /api/soporte/mis-respuestas
//  Cualquier usuario — respuestas no leídas a sus reportes
// ──────────────────────────────────────────────
router.get("/mis-respuestas", auth(), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, asunto, descripcion, respuesta, estado, creado_en, atendido_en
       FROM reportes_soporte
       WHERE usuario_id=? AND respuesta IS NOT NULL AND leido_usuario=0
       ORDER BY atendido_en DESC`,
      [req.user.id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
//  PUT /api/soporte/mis-respuestas/:id/leer
//  Marcar respuesta como leída
// ──────────────────────────────────────────────
router.put("/mis-respuestas/:id/leer", auth(), async (req, res) => {
  try {
    await pool.query(
      "UPDATE reportes_soporte SET leido_usuario=1 WHERE id=? AND usuario_id=?",
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// --------------------------------------------------------------
// Notificaciones internas de portal (registro/agendamiento)
// --------------------------------------------------------------
router.get("/notificaciones-portal", auth(), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, tipo, mensaje, paciente_id, cita_id, creado_en
       FROM notificaciones_usuario
       WHERE usuario_id = ? AND leida = 0
       ORDER BY creado_en DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.put("/notificaciones-portal/:id/leer", auth(), async (req, res) => {
  try {
    await pool.query(
      `UPDATE notificaciones_usuario
       SET leida = 1, leido_en = NOW()
       WHERE id = ? AND usuario_id = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.get("/push/public-key", auth(), async (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || "";
  if (!key || !webPush.isConfigured()) {
    return res.json({ ok: true, configured: false, publicKey: null });
  }
  res.json({ ok: true, configured: true, publicKey: key });
});

router.post("/push/subscribe", auth(), async (req, res) => {
  try {
    const { subscription } = req.body || {};
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const authKey = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !authKey) {
      return res.status(400).json({ ok: false, msg: "Suscripción inválida" });
    }

    await pool.query(
      `INSERT INTO push_subscriptions (user_id, clinica_id, endpoint, p256dh, auth, user_agent, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         user_id=VALUES(user_id),
         clinica_id=VALUES(clinica_id),
         p256dh=VALUES(p256dh),
         auth=VALUES(auth),
         user_agent=VALUES(user_agent),
         activo=1`,
      [
        req.user.id,
        req.user.clinica_id || req.tenant?.clinica_id || null,
        endpoint,
        p256dh,
        authKey,
        req.headers["user-agent"] || null,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/push/unsubscribe", auth(), async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ ok: false, msg: "endpoint requerido" });
    await pool.query(
      "UPDATE push_subscriptions SET activo=0 WHERE user_id=? AND endpoint=?",
      [req.user.id, endpoint]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
