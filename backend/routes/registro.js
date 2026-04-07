/**
 * /api/registro   — Portal self-service de registro de pacientes
 *
 * POST /api/registro
 *   Body: { nombres, apellidos, dni, fecha_nacimiento, sexo, telefono, email,
 *           direccion, ciudad, pais, grupo_sanguineo, clinica_id }
 *   → Crea el paciente (sin auth) y envía email de verificación
 *
 * GET  /api/registro/verificar/:token
 *   → Activa email_verificado=1 del paciente
 *
 * POST /api/registro/reenviar
 *   Body: { email, clinica_id }
 *   → Reenvía el email de verificación
 */

const router  = require("express").Router();
const pool    = require("../db");
const { v4: uuidv4 } = require("uuid");
const { enviarEmail, templateVerificacion, templateBienvenida } = require("../utils/mailer");
const upload  = require("../middlewares/upload");
const cloudinary  = require("../utils/cloudinary");
const streamifier = require("streamifier");
const fs      = require("fs");
const path    = require("path");

// ── Helper: crea token y envía email ──────────────────────
async function crearYEnviarToken(pacienteId, clinicaId, email, nombres, apellidos, conn) {
  const token    = uuidv4();
  const expires  = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

  // Invalida tokens previos del mismo paciente
  await conn.query(
    "UPDATE verificaciones_email SET usado=1 WHERE paciente_id=? AND usado=0",
    [pacienteId]
  );

  await conn.query(
    `INSERT INTO verificaciones_email (paciente_id, clinica_id, token, expires_at)
     VALUES (?,?,?,?)`,
    [pacienteId, clinicaId, token, expires]
  );

  // Obtiene info de la clínica para el email
  const [[clinica]] = await conn.query(
    "SELECT nombre FROM clinicas WHERE id=? LIMIT 1",
    [clinicaId]
  );

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${frontendUrl}/verificar-email?token=${token}`;

  await enviarEmail({
    to:      email,
    subject: "Confirma tu registro",
    html:    templateVerificacion({
               nombres, apellidos, link,
               clinicaNombre: clinica?.nombre,
             }),
  });

  return token;
}

// ══════════════════════════════════════════════════════════
// POST /api/registro  — Registro público
// ══════════════════════════════════════════════════════════
router.post("/", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      nombres, apellidos, dni, fecha_nacimiento, sexo,
      telefono, email, direccion, ciudad,
      pais = "Perú", grupo_sanguineo, clinica_id,
    } = req.body;

    // ── Validaciones básicas ────────────────────────────
    if (!nombres?.trim() || !apellidos?.trim())
      return res.status(400).json({ ok: false, msg: "Nombres y apellidos son obligatorios" });

    if (!email?.trim())
      return res.status(400).json({ ok: false, msg: "El email es obligatorio" });

    if (!clinica_id)
      return res.status(400).json({ ok: false, msg: "clinica_id es obligatorio" });

    // ── Validar que la clínica exista ───────────────────
    const [[clinica]] = await conn.query(
      "SELECT id FROM clinicas WHERE id=? LIMIT 1",
      [clinica_id]
    );
    if (!clinica)
      return res.status(400).json({ ok: false, msg: "Clínica no encontrada" });

    // ── Email duplicado en esta clínica ─────────────────
    const [[dup]] = await conn.query(
      "SELECT id FROM pacientes WHERE email=? AND clinica_id=? LIMIT 1",
      [email.trim().toLowerCase(), clinica_id]
    );
    if (dup)
      return res.status(409).json({ ok: false, msg: "Ya existe un paciente con ese email en esta clínica" });

    await conn.beginTransaction();

    // ── Insertar paciente ───────────────────────────────
    const [r] = await conn.query(
      `INSERT INTO pacientes
         (clinica_id, nombres, apellidos, dni, fecha_nacimiento, sexo,
          telefono, email, direccion, ciudad, pais, grupo_sanguineo,
          email_verificado, registro_self, activo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,1,1)`,
      [
        clinica_id,
        nombres.trim(),
        apellidos.trim(),
        dni?.trim()   || null,
        fecha_nacimiento || null,
        sexo            || null,
        telefono?.trim() || null,
        email.trim().toLowerCase(),
        direccion?.trim() || null,
        ciudad?.trim()    || null,
        pais,
        grupo_sanguineo   || null,
      ]
    );

    const pacienteId = r.insertId;

    // ── Token + email de verificación ──────────────────
    await crearYEnviarToken(pacienteId, clinica_id, email, nombres, apellidos, conn);

    await conn.commit();

    res.status(201).json({
      ok:  true,
      msg: "Registro exitoso. Revisa tu correo para verificar tu cuenta.",
      id:  pacienteId,
    });
  } catch (e) {
    await conn.rollback();
    console.error("[POST /registro]", e);
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/registro/verificar/:token
// ══════════════════════════════════════════════════════════
router.get("/verificar/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [[rv]] = await pool.query(
      `SELECT rv.*, p.nombres, p.apellidos, p.email, p.clinica_id
       FROM verificaciones_email rv
       JOIN pacientes p ON p.id = rv.paciente_id
       WHERE rv.token = ? LIMIT 1`,
      [token]
    );

    if (!rv)
      return res.status(404).json({ ok: false, msg: "Token inválido o inexistente" });

    if (rv.usado)
      return res.status(400).json({ ok: false, msg: "Este enlace ya fue utilizado", ya_verificado: true });

    if (new Date() > new Date(rv.expires_at))
      return res.status(400).json({ ok: false, msg: "El enlace ha expirado. Solicita uno nuevo.", expirado: true });

    // Marcar verificado
    await pool.query("UPDATE pacientes SET email_verificado=1 WHERE id=?",           [rv.paciente_id]);
    await pool.query("UPDATE verificaciones_email SET usado=1 WHERE id=?",           [rv.id]);

    // Email de bienvenida
    const [[clinica]] = await pool.query("SELECT nombre FROM clinicas WHERE id=?",   [rv.clinica_id]);
    await enviarEmail({
      to:      rv.email,
      subject: "¡Cuenta activada!",
      html:    templateBienvenida({ nombres: rv.nombres, clinicaNombre: clinica?.nombre }),
    });

    res.json({ ok: true, msg: "Email verificado correctamente. ¡Bienvenido/a!", nombres: rv.nombres });
  } catch (e) {
    console.error("[GET /registro/verificar]", e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/registro/reenviar  — Reenvía verificación
// ══════════════════════════════════════════════════════════
router.post("/reenviar", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { email, clinica_id } = req.body;
    if (!email || !clinica_id)
      return res.status(400).json({ ok: false, msg: "email y clinica_id son requeridos" });

    const [[p]] = await conn.query(
      "SELECT * FROM pacientes WHERE email=? AND clinica_id=? LIMIT 1",
      [email.trim().toLowerCase(), clinica_id]
    );
    if (!p)
      return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    if (p.email_verificado)
      return res.status(400).json({ ok: false, msg: "El email ya está verificado" });

    await crearYEnviarToken(p.id, clinica_id, p.email, p.nombres, p.apellidos, conn);

    res.json({ ok: true, msg: "Email de verificación reenviado" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/registro/:id/foto  — Foto de perfil durante registro (sin auth)
// ══════════════════════════════════════════════════════════
router.post("/:id/foto", upload.single("foto"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });

    const { id }         = req.params;
    const { clinica_id } = req.body;
    if (!clinica_id)
      return res.status(400).json({ ok: false, msg: "clinica_id requerido" });

    const [[p]] = await pool.query(
      "SELECT id, foto_cloudinary_id FROM pacientes WHERE id=? AND clinica_id=?",
      [id, clinica_id]
    );
    if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    // Eliminar foto anterior de Cloudinary si existe
    if (p.foto_cloudinary_id) {
      try { await cloudinary.uploader.destroy(p.foto_cloudinary_id); } catch { /* ignorar */ }
    }

    // Subir a Cloudinary desde el buffer en memoria
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `clinica/pacientes/${clinica_id}/perfil`, resource_type: "image" },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    await pool.query(
      "UPDATE pacientes SET foto_perfil=?, foto_cloudinary_id=? WHERE id=?",
      [uploadResult.secure_url, uploadResult.public_id, id]
    );

    res.json({ ok: true, foto_perfil: uploadResult.secure_url });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
