/**
 * /api/planes-publicos  — Compra pública de plan (sin cuenta previa)
 *
 * POST /api/planes-publicos/solicitar
 *   Body (multipart): nombres, apellidos, email, telefono, nombre_clinica,
 *                      plan_solicitado (trial|semestral|anual), mensaje,
 *                      archivo `comprobante`
 *   → Sube el comprobante a Cloudinary, crea la solicitud y notifica a SUPER_ADMIN
 *
 * GET  /api/planes-publicos/solicitudes          (SUPER_ADMIN)
 * POST /api/planes-publicos/solicitudes/:id/aprobar  (SUPER_ADMIN) → crea clínica + usuario
 * PUT  /api/planes-publicos/solicitudes/:id/rechazar (SUPER_ADMIN)
 */

const router     = require("express").Router();
const pool       = require("../db");
const auth       = require("../middlewares/auth");
const argon2     = require("argon2");
const crypto     = require("crypto");
const rateLimit  = require("express-rate-limit");
const cloudinary = require("../utils/cloudinary");
const streamifier = require("streamifier");
const { uploadComprobante } = require("../middlewares/upload");
const { aplicarPresetModulosClinica } = require("./clinicas");
const sse     = require("../utils/sseManager");
const webPush = require("../utils/webPush");
const {
  enviarEmail,
  templateSolicitudRecibida,
  templateSolicitudAprobada,
  templateCredenciales,
  templateSolicitudRechazada,
  templateFacturaRecibo,
  planCompletoLabel,
} = require("../utils/mailer");
const { generarPdfDesdeHtml } = require("../utils/pdfFromHtml");

const solicitarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Has enviado demasiadas solicitudes. Intenta más tarde." },
});

const PLANES_VALIDOS = ["trial", "semestral", "anual"];
const NIVELES_VALIDOS = ["basico", "avanzado", "empresarial"];
const ROLES_USUARIO_VALIDOS = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "RECEPCIONISTA"];

function calcularVigencia(planTipo, inicio = new Date()) {
  const fin = new Date(inicio);
  if      (planTipo === "trial")     fin.setDate(fin.getDate() + 14);
  else if (planTipo === "semestral") fin.setMonth(fin.getMonth() + 6);
  else if (planTipo === "anual")     fin.setFullYear(fin.getFullYear() + 1);
  return fin;
}

function generarPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

function slugify(texto) {
  const sinAcentos = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return (
    sinAcentos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `clinica-${Date.now()}`
  );
}

// ══════════════════════════════════════════════════════════
// POST /solicitar  — público, sin auth
// ══════════════════════════════════════════════════════════
router.post("/solicitar", solicitarLimiter, uploadComprobante.single("comprobante"), async (req, res) => {
  try {
    const { nombres, apellidos, email, telefono, nombre_clinica, nivel_plan, plan_solicitado, mensaje } = req.body;

    if (!nombres || !apellidos || !email || !nombre_clinica || !plan_solicitado) {
      return res.status(400).json({ ok: false, msg: "Faltan datos obligatorios" });
    }
    if (!PLANES_VALIDOS.includes(plan_solicitado)) {
      return res.status(400).json({ ok: false, msg: "plan_solicitado inválido" });
    }
    const nivel = NIVELES_VALIDOS.includes(nivel_plan) ? nivel_plan : "basico";
    if (nivel !== "basico" && plan_solicitado === "trial") {
      return res.status(400).json({ ok: false, msg: "Los planes Avanzado y Empresarial no tienen prueba gratis, elige Semestral o Anual" });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, msg: "Debes adjuntar el comprobante de la transferencia" });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "clinica/comprobantes_plan", resource_type: "auto" },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    const [r] = await pool.query(
      `INSERT INTO solicitudes_plan_publico
       (nombres, apellidos, email, telefono, nombre_clinica, nivel_plan, plan_solicitado, mensaje, comprobante_url, comprobante_public_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [nombres, apellidos, email, telefono || null, nombre_clinica, nivel, plan_solicitado,
       mensaje || null, uploadResult.secure_url, uploadResult.public_id]
    );
    const solicitudId = r.insertId;
    const planNombre = planCompletoLabel(nivel, plan_solicitado);

    // Notifica a todos los SUPER_ADMIN activos
    try {
      const [admins] = await pool.query(
        `SELECT id FROM usuarios WHERE tipo='SUPER_ADMIN' AND activo=1`
      );
      const data = {
        solicitud_id: solicitudId,
        nombres, apellidos, nombre_clinica,
        nivel_plan: nivel, plan_solicitado,
      };
      sse.notifySuperAdmins("nueva_solicitud_plan", data);
      await webPush.sendToUsers(
        pool,
        admins.map((a) => a.id),
        {
          title: "Nueva solicitud de plan",
          body: `${nombres} ${apellidos} solicita el plan ${planNombre} para ${nombre_clinica}`,
          tag: "nueva_solicitud_plan",
          data: { url: "/superadmin/solicitudes-plan" },
        }
      );
    } catch (e) {
      console.error("[notificar solicitud plan]", e.message);
    }

    // Acuse de recibo al médico
    try {
      await enviarEmail({
        to: email,
        subject: "Recibimos tu comprobante",
        html: templateSolicitudRecibida({ nombres: `${nombres} ${apellidos}`, planNombre }),
      });
    } catch (e) {
      console.error("[email solicitud recibida]", e.message);
    }

    res.status(201).json({ ok: true, id: solicitudId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// GET /solicitudes  (SUPER_ADMIN)
// ══════════════════════════════════════════════════════════
router.get("/solicitudes", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    if (req.query.estado === "todas") {
      const [rows] = await pool.query(
        `SELECT * FROM solicitudes_plan_publico ORDER BY creado_en DESC`
      );
      return res.json({ ok: true, data: rows });
    }
    const estado = ["pendiente", "aprobada", "rechazada"].includes(req.query.estado)
      ? req.query.estado
      : "pendiente";
    const [rows] = await pool.query(
      `SELECT * FROM solicitudes_plan_publico WHERE estado=? ORDER BY creado_en DESC`,
      [estado]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// POST /solicitudes/:id/aprobar  (SUPER_ADMIN)
// ══════════════════════════════════════════════════════════
router.post("/solicitudes/:id/aprobar", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { slug, tipo_id, es_pediatrica, monto, moneda, tipo_usuario, especialidad_id } = req.body;
    const rolUsuario = ROLES_USUARIO_VALIDOS.includes(tipo_usuario) ? tipo_usuario : "ADMIN";
    const especialidadIdFinal = rolUsuario === "MEDICO" && especialidad_id ? parseInt(especialidad_id, 10) : null;

    const [[solicitud]] = await pool.query(
      `SELECT * FROM solicitudes_plan_publico WHERE id=? LIMIT 1`,
      [id]
    );
    if (!solicitud) return res.status(404).json({ ok: false, msg: "Solicitud no encontrada" });
    if (solicitud.estado !== "pendiente") {
      return res.status(409).json({ ok: false, msg: "Esta solicitud ya fue atendida" });
    }

    const slugFinal = slug ? slugify(slug) : slugify(solicitud.nombre_clinica);
    const [exist] = await pool.query("SELECT id FROM clinicas WHERE slug=?", [slugFinal]);
    if (exist.length) {
      return res.status(409).json({ ok: false, msg: "El slug ya existe, elige otro" });
    }

    const inicio = new Date();
    const fin    = calcularVigencia(solicitud.plan_solicitado, inicio);
    const tipoIdFinal = tipo_id && tipo_id !== "" ? parseInt(tipo_id, 10) : null;

    const [rClinica] = await pool.query(
      `INSERT INTO clinicas (nombre, slug, tipo_id, es_pediatrica, email, telefono, plan_tipo, licencia_inicio, licencia_fin)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [solicitud.nombre_clinica, slugFinal, tipoIdFinal, es_pediatrica ? 1 : 0,
       solicitud.email, solicitud.telefono, solicitud.plan_solicitado, inicio, fin]
    );
    const clinicaId = rClinica.insertId;

    await aplicarPresetModulosClinica(clinicaId, tipoIdFinal, es_pediatrica ? 1 : 0);

    const password = generarPassword();
    const hash = await argon2.hash(password);
    const [rUsuario] = await pool.query(
      `INSERT INTO usuarios (clinica_id, nombres, apellidos, email, password_hash, tipo, especialidad_id)
       VALUES (?,?,?,?,?,?,?)`,
      [clinicaId, solicitud.nombres, solicitud.apellidos, solicitud.email, hash, rolUsuario, especialidadIdFinal]
    );
    const usuarioId = rUsuario.insertId;

    const planNombre = planCompletoLabel(solicitud.nivel_plan, solicitud.plan_solicitado);

    await pool.query(
      `INSERT INTO licencias_historial (clinica_id, plan_tipo, inicio, fin, superadmin_id, notas)
       VALUES (?,?,?,?,?,?)`,
      [clinicaId, solicitud.plan_solicitado, inicio, fin, req.user.id, `Alta desde solicitud pública #${id} — Plan ${planNombre} — Usuario creado como ${rolUsuario}`]
    );

    const montoFinal = monto != null && monto !== "" ? Number(monto) : null;
    await pool.query(
      `UPDATE solicitudes_plan_publico
       SET estado='aprobada', clinica_id=?, usuario_id=?, atendida_por=?, atendida_en=NOW(), monto=?, moneda=?
       WHERE id=?`,
      [clinicaId, usuarioId, req.user.id, montoFinal, moneda || "HNL", id]
    );
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    // 1) Confirmación
    try {
      await enviarEmail({
        to: solicitud.email,
        subject: "🎉 ¡Tu solicitud fue aceptada!",
        html: templateSolicitudAprobada({ nombres: `${solicitud.nombres} ${solicitud.apellidos}`, planNombre }),
      });
    } catch (e) { console.error("[email solicitud aprobada]", e.message); }

    // 2) Credenciales
    try {
      await enviarEmail({
        to: solicitud.email,
        subject: "🔑 Tus credenciales de acceso",
        html: templateCredenciales({
          nombres: `${solicitud.nombres} ${solicitud.apellidos}`,
          email: solicitud.email,
          password,
          loginUrl: `${frontendUrl}/login`,
          clinicaNombre: solicitud.nombre_clinica,
        }),
      });
    } catch (e) { console.error("[email credenciales]", e.message); }

    // 3) Recibo en PDF
    try {
      const html = templateFacturaRecibo({
        nombres: `${solicitud.nombres} ${solicitud.apellidos}`,
        clinicaNombre: solicitud.nombre_clinica,
        planNombre,
        monto: montoFinal,
        moneda: moneda || "HNL",
        fecha: new Date().toLocaleDateString("es-PE"),
        numeroRecibo: `SP-${String(id).padStart(6, "0")}`,
      });
      const pdfBuffer = await generarPdfDesdeHtml(html, { paper_size: "A4", orientacion: "portrait" });
      await enviarEmail({
        to: solicitud.email,
        subject: "Recibo de tu pago",
        html: "<p>Adjuntamos el recibo de tu pago.</p>",
        attachments: [{ filename: `recibo-${id}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
      });
    } catch (e) { console.error("[email recibo]", e.message); }

    res.json({ ok: true, clinica_id: clinicaId, usuario_id: usuarioId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// PUT /solicitudes/:id/rechazar  (SUPER_ADMIN)
// ══════════════════════════════════════════════════════════
router.put("/solicitudes/:id/rechazar", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const [[solicitud]] = await pool.query(
      `SELECT * FROM solicitudes_plan_publico WHERE id=? LIMIT 1`,
      [id]
    );
    if (!solicitud) return res.status(404).json({ ok: false, msg: "Solicitud no encontrada" });
    if (solicitud.estado !== "pendiente") {
      return res.status(409).json({ ok: false, msg: "Esta solicitud ya fue atendida" });
    }

    await pool.query(
      `UPDATE solicitudes_plan_publico
       SET estado='rechazada', motivo_rechazo=?, atendida_por=?, atendida_en=NOW()
       WHERE id=?`,
      [motivo || null, req.user.id, id]
    );

    try {
      await enviarEmail({
        to: solicitud.email,
        subject: "No pudimos validar tu pago",
        html: templateSolicitudRechazada({ nombres: `${solicitud.nombres} ${solicitud.apellidos}`, motivo }),
      });
    } catch (e) { console.error("[email solicitud rechazada]", e.message); }

    res.json({ ok: true, msg: "Solicitud rechazada" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
