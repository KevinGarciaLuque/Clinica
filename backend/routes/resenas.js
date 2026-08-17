/**
 * /api/resenas — Reseñas de médicos clientes, publicadas en /inicio
 *
 * POST /api/resenas/solicitar          (SUPER_ADMIN) → envía encuesta a un médico
 * GET  /api/resenas                    (SUPER_ADMIN) → lista todas (gestión)
 * PUT  /api/resenas/:id/activo         (SUPER_ADMIN) → mostrar/ocultar de la landing
 * DELETE /api/resenas/:id              (SUPER_ADMIN)
 *
 * GET  /api/resenas/token/:token             (público) → datos precargados de la encuesta
 * POST /api/resenas/token/:token/responder   (público) → el médico envía su reseña
 * GET  /api/resenas/publicas                 (público) → reseñas para la landing page
 */

const router    = require("express").Router();
const pool      = require("../db");
const auth      = require("../middlewares/auth");
const crypto    = require("crypto");
const rateLimit = require("express-rate-limit");
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
// ══════════════════════════════════════════════════════════
router.post("/solicitar", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { usuario_id, especialidad, lugar } = req.body;
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
    if (!medico.email) return res.status(400).json({ ok: false, msg: "Este usuario no tiene correo registrado" });

    const token = crypto.randomBytes(24).toString("hex");
    const nombreMedico = `${medico.nombres} ${medico.apellidos}`.trim();
    const especialidadFinal = especialidad || medico.especialidad || null;
    const lugarFinal = lugar || [medico.ciudad, medico.pais].filter(Boolean).join(", ") || medico.clinica_nombre || null;

    await pool.query(
      `INSERT INTO resenas_medicos (clinica_id, usuario_id, token, nombre_medico, especialidad, lugar)
       VALUES (?,?,?,?,?,?)`,
      [medico.clinica_id || null, medico.id, token, nombreMedico, especialidadFinal, lugarFinal]
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    try {
      await enviarEmail({
        to: medico.email,
        subject: "⭐ Nos encantaría conocer tu experiencia",
        html: templateSolicitudResena({
          nombreMedico,
          link: `${frontendUrl}/resena/${token}`,
          clinicaNombre: medico.clinica_nombre,
        }),
      });
    } catch (e) {
      console.error("[email solicitud resena]", e.message);
    }

    res.status(201).json({ ok: true, msg: "Encuesta enviada" });
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
// PUT /:id/activo  (SUPER_ADMIN)
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
// DELETE /:id  (SUPER_ADMIN)
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
// GET /publicas  (público) — para la landing page
// ══════════════════════════════════════════════════════════
router.get("/publicas", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT nombre_medico, especialidad, lugar, estrellas, opinion, respondida_en
       FROM resenas_medicos
       WHERE estado='respondida' AND activo=1
       ORDER BY respondida_en DESC
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

    const [[resena]] = await pool.query(`SELECT id, estado FROM resenas_medicos WHERE token=? LIMIT 1`, [req.params.token]);
    if (!resena) return res.status(404).json({ ok: false, msg: "Enlace inválido o expirado" });
    if (resena.estado === "respondida") {
      return res.status(409).json({ ok: false, msg: "Ya enviaste tu reseña, ¡gracias!" });
    }

    await pool.query(
      `UPDATE resenas_medicos
       SET estrellas=?, opinion=?, estado='respondida', respondida_en=NOW(),
           nombre_medico=COALESCE(NULLIF(?,''), nombre_medico),
           especialidad=COALESCE(NULLIF(?,''), especialidad),
           lugar=COALESCE(NULLIF(?,''), lugar)
       WHERE id=?`,
      [estrellasNum, opinion.trim().slice(0, 600), nombre_medico || "", especialidad || "", lugar || "", resena.id]
    );

    res.json({ ok: true, msg: "¡Gracias por tu reseña!" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
