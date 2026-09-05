const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const crypto = require("crypto");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-key-32-chars-long-xxxx";
function decrypt(text) {
  try {
    const key  = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const parts = text.split(":");
    const iv   = Buffer.from(parts.shift(), "hex");
    const encryptedText = parts.join(":");
    const decipher = require("crypto").createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch { return text; }
}

/**
 * GET /api/cumpleanos
 * Query params:
 *   dias  - cuántos días hacia adelante incluir (default: 0 = solo hoy, max: 30)
 * Devuelve pacientes cuyo cumpleaños (mes+dia) cae hoy o en los próximos `dias` días.
 */
router.get(
  "/",
  auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  async (req, res) => {
    try {
      const clinicaId   = req.tenant?.clinica_id;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";
      if (!isSuperAdmin && !clinicaId)
        return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

      const dias = Math.min(parseInt(req.query.dias ?? 0, 10) || 0, 365);

      // "Hoy" lo decide el navegador del usuario (req.query.fecha), no el servidor:
      // Railway corre en UTC y calcular "hoy" ahí desfasa el día en horarios
      // nocturnos de Centroamérica (mismo bug que /dashboard/sala-espera).
      const hoyStr = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || "")
        ? req.query.fecha
        : new Date().toLocaleDateString('en-CA');
      const hoy = new Date(`${hoyStr}T00:00:00`);

      // Construimos condiciones mes/día para hoy + días siguientes
      const conditions = [];
      for (let d = 0; d <= dias; d++) {
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() + d);
        const mes = fecha.getMonth() + 1;
        const dia = fecha.getDate();
        conditions.push(`(MONTH(fecha_nacimiento)=${mes} AND DAY(fecha_nacimiento)=${dia})`);
      }
      const whereDate = conditions.join(" OR ");

      let sql = `
        SELECT
          id, nombres, apellidos, telefono, email,
          fecha_nacimiento, foto_perfil, sexo,
          TIMESTAMPDIFF(YEAR, fecha_nacimiento, ?) AS edad,
          CASE
            WHEN MONTH(fecha_nacimiento)=MONTH(?) AND DAY(fecha_nacimiento)=DAY(?) THEN 0
            ELSE DATEDIFF(
              DATE_FORMAT(CONCAT(YEAR(?),'-',MONTH(fecha_nacimiento),'-',DAY(fecha_nacimiento)), '%Y-%m-%d'),
              ?
            )
          END AS dias_para_cumplir
        FROM pacientes
        WHERE fecha_nacimiento IS NOT NULL
          AND (${whereDate})
          ${!isSuperAdmin ? "AND clinica_id = ?" : ""}
        ORDER BY dias_para_cumplir ASC, nombres ASC
      `;

      const params = [hoyStr, hoyStr, hoyStr, hoyStr, hoyStr];
      if (!isSuperAdmin) params.push(clinicaId);

      const [rows] = await pool.query(sql, params);

      let whatsappActivo = true;
      if (!isSuperAdmin) {
        const [[cfg]] = await pool.query(
          "SELECT valor FROM clinica_config WHERE clinica_id=? AND clave='whatsapp_cumpleanos_activo'",
          [clinicaId]
        );
        whatsappActivo = !cfg || cfg.valor !== "0";
      }

      res.json({ ok: true, data: rows, whatsapp_activo: whatsappActivo });
    } catch (e) {
      console.error("[GET /cumpleanos]", e.message);
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

/**
 * POST /api/cumpleanos/felicitar
 * Body: { paciente_id, canales: ["email","whatsapp"], mensaje }
 * Envía felicitación por los canales solicitados.
 */
router.post(
  "/felicitar",
  auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  async (req, res) => {
    try {
      const clinicaId    = req.tenant?.clinica_id;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";
      const { paciente_id, canales = [], mensaje } = req.body;

      if (!paciente_id || !canales.length || !mensaje?.trim())
        return res.status(400).json({ ok: false, msg: "Faltan datos: paciente_id, canales y mensaje son requeridos" });

      // Obtener paciente
      let queryP, paramsP;
      if (isSuperAdmin) {
        queryP  = "SELECT * FROM pacientes WHERE id=?";
        paramsP = [paciente_id];
      } else {
        queryP  = "SELECT * FROM pacientes WHERE id=? AND clinica_id=?";
        paramsP = [paciente_id, clinicaId];
      }
      const [[paciente]] = await pool.query(queryP, paramsP);
      if (!paciente) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

      const clinicaIdFinal = isSuperAdmin ? paciente.clinica_id : clinicaId;
      const resultados = {};

      // ── EMAIL ─────────────────────────────────────────────────────
      if (canales.includes("email")) {
        if (!paciente.email) {
          resultados.email = { ok: false, msg: "El paciente no tiene email registrado" };
        } else {
          try {
            const [smtpRows] = await pool.query(
              "SELECT * FROM clinica_smtp_config WHERE clinica_id=?",
              [clinicaIdFinal]
            );
            if (!smtpRows.length) {
              resultados.email = { ok: false, msg: "No hay configuración SMTP en esta clínica" };
            } else {
              const cfg    = smtpRows[0];
              const nodemailer = require("nodemailer");
              const transporter = nodemailer.createTransport({
                host:   cfg.smtp_host,
                port:   cfg.smtp_port,
                secure: cfg.smtp_secure === 1,
                auth:   { user: cfg.smtp_user, pass: decrypt(cfg.smtp_pass) },
              });
              await transporter.sendMail({
                from:    `"${cfg.from_name}" <${cfg.from_email}>`,
                to:      paciente.email,
                subject: `¡Feliz cumpleaños, ${paciente.nombres}!`,
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;
                               background:#fff;border-radius:12px;overflow:hidden;
                               box-shadow:0 4px 20px rgba(0,0,0,.08)">
                    <div style="background:linear-gradient(135deg,#1a2744,#243b72);
                                 padding:30px 24px;text-align:center">
                      <div style="font-size:48px">🎂</div>
                      <h1 style="color:#fff;margin:12px 0 4px;font-size:1.5rem">¡Feliz Cumpleaños!</h1>
                      <p style="color:rgba(255,255,255,.7);margin:0;font-size:.95rem">
                        ${paciente.nombres} ${paciente.apellidos}
                      </p>
                    </div>
                    <div style="padding:28px 24px">
                      <p style="color:#374151;font-size:1rem;line-height:1.7;white-space:pre-line">${mensaje}</p>
                    </div>
                    <div style="background:#f8fafc;padding:14px 24px;text-align:center;
                                 font-size:.78rem;color:#9ca3af">
                      Enviado desde el Sistema de Gestión Clínica
                    </div>
                  </div>`,
              });
              resultados.email = { ok: true, msg: "Email enviado" };
            }
          } catch (err) {
            resultados.email = { ok: false, msg: err.message };
          }
        }
      }

      // ── WHATSAPP (Twilio) ─────────────────────────────────────────
      if (canales.includes("whatsapp")) {
        const [[cfgWa]] = await pool.query(
          "SELECT valor FROM clinica_config WHERE clinica_id=? AND clave='whatsapp_cumpleanos_activo'",
          [clinicaIdFinal]
        );
        const whatsappActivo = !cfgWa || cfgWa.valor !== "0";

        if (!whatsappActivo) {
          resultados.whatsapp = { ok: false, msg: "El envío de felicitaciones por WhatsApp está deshabilitado por el administrador de la clínica" };
        } else if (!paciente.telefono) {
          resultados.whatsapp = { ok: false, msg: "El paciente no tiene teléfono registrado" };
        } else {
          try {
            const [waCfg] = await pool.query(
              "SELECT * FROM clinica_mensajeria_config WHERE clinica_id=? AND servicio='twilio_whatsapp' AND activo=1",
              [clinicaIdFinal]
            );
            if (!waCfg.length) {
              // Si no hay Twilio, generar link de WhatsApp Web como fallback
              const tel   = paciente.telefono.replace(/\D/g, "");
              const texto = encodeURIComponent(mensaje);
              resultados.whatsapp = {
                ok: true,
                fallback: true,
                link: `https://wa.me/${tel}?text=${texto}`,
                msg: "Sin configuración Twilio — usa el link para enviar manualmente",
              };
            } else {
              const cfg    = waCfg[0];
              const twilio = require("twilio")(cfg.account_sid, decrypt(cfg.auth_token));
              await twilio.messages.create({
                from: `whatsapp:${cfg.from_number}`,
                to:   `whatsapp:+${paciente.telefono.replace(/\D/g, "")}`,
                body: mensaje,
              });
              resultados.whatsapp = { ok: true, msg: "WhatsApp enviado" };
            }
          } catch (err) {
            // Si twilio no está instalado, generar link web
            if (err.code === "MODULE_NOT_FOUND") {
              const tel   = paciente.telefono.replace(/\D/g, "");
              const texto = encodeURIComponent(mensaje);
              resultados.whatsapp = {
                ok: true,
                fallback: true,
                link: `https://wa.me/${tel}?text=${texto}`,
                msg: "Módulo Twilio no disponible — usa el link para enviar manualmente",
              };
            } else {
              resultados.whatsapp = { ok: false, msg: err.message };
            }
          }
        }
      }

      res.json({ ok: true, resultados });
    } catch (e) {
      console.error("[POST /cumpleanos/felicitar]", e.message);
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

module.exports = router;
