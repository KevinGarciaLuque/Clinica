/**
 * /api/resenas — Reseñas de médicos clientes, publicadas en /inicio
 *
 * POST /api/resenas/solicitar          (SUPER_ADMIN) → envía encuesta a un médico (correo, sistema o ambos)
 * GET  /api/resenas                    (SUPER_ADMIN) → lista todas (gestión)
 * PUT  /api/resenas/:id/activo         (SUPER_ADMIN) → aceptar (publicar) / ocultar de la landing
 * DELETE /api/resenas/:id              (SUPER_ADMIN) → rechazar / eliminar
 *
 * GET  /api/resenas/mis-pendientes           (auth) → encuestas pendientes del usuario logueado
 * GET  /api/resenas/token/:token             (público) → datos precargados de la encuesta
 * POST /api/resenas/token/:token/responder   (público o autenticado) → el médico envía su reseña
 * GET  /api/resenas/publicas                 (público) → reseñas ya aprobadas, para la landing page
 */

const router    = require("express").Router();
const pool      = require("../db");
const auth      = require("../middlewares/auth");
const crypto    = require("crypto");
const rateLimit = require("express-rate-limit");
const sse       = require("../utils/sseManager");
const webPush   = require("../utils/webPush");
const { enviarEmail, templateSolicitudResena } = require("../utils/mailer");

const responderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiados intentos. Intenta más tarde." },
});

// ══════════════════════════════════════════════════════════
// POST /solicitar  (SUPER_ADMIN)
// Body: { usuario_id, especialidad?, lugar?, canal: "correo"|"sistema"|"ambos" }
// ══════════════════════════════════════════════════════════
router.post("/solicitar", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { usuario_id, especialidad, lugar } = req.body;
    const canal = ["correo", "sistema", "ambos"].includes(req.body.canal) ? req.body.canal : "correo";
    if (!usuario_id) return res.status(400).json({ ok: false, msg: "usuario_id es requerido" });

    const [[medico]] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos, u.email, u.clinica_id,
              e.nombre AS especialidad, c.nombre AS clinica_nombre, c.ciudad, c.pais
       FROM usuarios u
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       LEFT JOIN clinicas c ON c.id = u.clinica_id
       WHERE u.id=? LIMIT 1`,
      [usuario_id]
    );
    if (!medico) return res.status(404).json({ ok: false, msg: "Médico no encontrado" });
    if (canal !== "sistema" && !medico.email) {
      return res.status(400).json({ ok: false, msg: "Este usuario no tiene correo registrado" });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const nombreMedico = `${medico.nombres} ${medico.apellidos}`.trim();
    const especialidadFinal = especialidad || medico.especialidad || null;
    const lugarFinal = lugar || [medico.ciudad, medico.pais].filter(Boolean).join(", ") || medico.clinica_nombre || null;

    await pool.query(
      `INSERT INTO resenas_medicos (clinica_id, usuario_id, token, nombre_medico, especialidad, lugar)
       VALUES (?,?,?,?,?,?)`,
      [medico.clinica_id || null, medico.id, token, nombreMedico, especialidadFinal, lugarFinal]
    );

    // ── Envío por correo ──
    if (canal === "correo" || canal === "ambos") {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      try {
        await enviarEmail({
          to: medico.email,
          subject: "Nos encantaría conocer tu experiencia",
          html: templateSolicitudResena({
            nombreMedico,
            link: `${frontendUrl}/resena/${token}`,
            clinicaNombre: medico.clinica_nombre,
          }),
        });
      } catch (e) {
        console.error("[email solicitud resena]", e.message);
      }
    }

    // ── Envío por el sistema (notificación en la campanita del médico) ──
    if (canal === "sistema" || canal === "ambos") {
      try {
        sse.notifyUser(medico.id, "nueva_encuesta_resena", {
          token,
          nombre_medico: nombreMedico,
          clinica_nombre: medico.clinica_nombre,
        });
        await webPush.sendToUsers(pool, [medico.id], {
          title: "¡Nos encantaría conocer tu experiencia!",
          body: "Déjanos tu reseña, toma menos de un minuto.",
          tag: "nueva_encuesta_resena",
          data: { url: "/dashboard" },
        });
      } catch (e) {
        console.error("[notificar encuesta resena]", e.message);
      }
    }

    res.status(201).json({ ok: true, msg: "Encuesta enviada" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /mis-pendientes  (autenticado) — encuestas pendientes del usuario logueado
// ══════════════════════════════════════════════════════════
router.get("/mis-pendientes", auth(), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT token, nombre_medico, especialidad, lugar, enviada_en
       FROM resenas_medicos
       WHERE usuario_id=? AND estado='pendiente'
       ORDER BY enviada_en DESC`,
      [req.user.id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /  (SUPER_ADMIN) — gestión
// ══════════════════════════════════════════════════════════
router.get("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, c.nombre AS clinica_nombre
       FROM resenas_medicos r
       LEFT JOIN clinicas c ON c.id = r.clinica_id
       ORDER BY r.enviada_en DESC`
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// PUT /:id/activo  (SUPER_ADMIN) — aceptar (publicar) / ocultar
// ══════════════════════════════════════════════════════════
router.put("/:id/activo", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await pool.query("UPDATE resenas_medicos SET activo=? WHERE id=?", [req.body.activo ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// DELETE /:id  (SUPER_ADMIN) — rechazar / eliminar
// ══════════════════════════════════════════════════════════
router.delete("/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await pool.query("DELETE FROM resenas_medicos WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /publicas  (público) — para la landing page (ya aprobadas por el SUPER_ADMIN)
// ══════════════════════════════════════════════════════════
router.get("/publicas", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.nombre_medico, r.especialidad, r.lugar, r.estrellas, r.opinion, r.respondida_en,
              u.foto_url
       FROM resenas_medicos r
       LEFT JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.estado='respondida' AND r.activo=1
       ORDER BY r.respondida_en DESC
       LIMIT 24`
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /token/:token  (público)
// ══════════════════════════════════════════════════════════
router.get("/token/:token", async (req, res) => {
  try {
    const [[resena]] = await pool.query(
      `SELECT nombre_medico, especialidad, lugar, estado FROM resenas_medicos WHERE token=? LIMIT 1`,
      [req.params.token]
    );
    if (!resena) return res.status(404).json({ ok: false, msg: "Enlace inválido o expirado" });
    res.json({ ok: true, data: resena });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// POST /token/:token/responder  (público)
// Queda pendiente de aprobación del SUPER_ADMIN antes de publicarse en /inicio.
// ══════════════════════════════════════════════════════════
router.post("/token/:token/responder", responderLimiter, async (req, res) => {
  try {
    const { estrellas, opinion, nombre_medico, especialidad, lugar } = req.body;
    const estrellasNum = parseInt(estrellas, 10);
    if (!estrellasNum || estrellasNum < 1 || estrellasNum > 5) {
      return res.status(400).json({ ok: false, msg: "Selecciona una calificación de 1 a 5 estrellas" });
    }
    if (!opinion || !opinion.trim()) {
      return res.status(400).json({ ok: false, msg: "Cuéntanos tu opinión" });
    }

    const [[resena]] = await pool.query(`SELECT id, estado, nombre_medico FROM resenas_medicos WHERE token=? LIMIT 1`, [req.params.token]);
    if (!resena) return res.status(404).json({ ok: false, msg: "Enlace inválido o expirado" });
    if (resena.estado === "respondida") {
      return res.status(409).json({ ok: false, msg: "Ya enviaste tu reseña, ¡gracias!" });
    }

    await pool.query(
      `UPDATE resenas_medicos
       SET estrellas=?, opinion=?, estado='respondida', respondida_en=NOW(), activo=0,
           nombre_medico=COALESCE(NULLIF(?,''), nombre_medico),
           especialidad=COALESCE(NULLIF(?,''), especialidad),
           lugar=COALESCE(NULLIF(?,''), lugar)
       WHERE id=?`,
      [estrellasNum, opinion.trim().slice(0, 600), nombre_medico || "", especialidad || "", lugar || "", resena.id]
    );

    // Notifica a todos los SUPER_ADMIN para que la aprueben o rechacen
    try {
      const [admins] = await pool.query(`SELECT id FROM usuarios WHERE tipo='SUPER_ADMIN' AND activo=1`);
      sse.notifySuperAdmins("nueva_resena_recibida", {
        resena_id: resena.id,
        nombre_medico: nombre_medico || resena.nombre_medico,
        estrellas: estrellasNum,
      });
      await webPush.sendToUsers(pool, admins.map((a) => a.id), {
        title: "Nueva reseña recibida",
        body: `${nombre_medico || resena.nombre_medico} dejó una reseña de ${estrellasNum}★`,
        tag: "nueva_resena_recibida",
        data: { url: "/superadmin/resenas" },
      });
    } catch (e) {
      console.error("[notificar resena recibida]", e.message);
    }

    res.json({ ok: true, msg: "¡Gracias por tu reseña!" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
