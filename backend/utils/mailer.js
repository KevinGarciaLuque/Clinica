const nodemailer = require("nodemailer");

// Crea el transporter según la configuración .env
// Si no hay SMTP_USER configurado, sólo imprime el email en consola (útil en dev sin cuenta email)
function buildTransporter() {
  if (!process.env.SMTP_USER) return null;

  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || "smtp.gmail.com",
    port:   Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.EMAIL_FROM || '"Multi-Clínica" <noreply@multiclinica.app>';

/**
 * Envía un email.
 * @param {object} opts  { to, subject, html }
 * @returns Promise<object>  info de nodemailer (o objeto simulado)
 */
async function enviarEmail({ to, subject, html }) {
  const transporter = buildTransporter();

  if (!transporter) {
    // Modo desarrollo sin SMTP configurado → solo log
    console.log("\n📧 [MAILER simulado]");
    console.log("  Para:    ", to);
    console.log("  Asunto:  ", subject);
    console.log("  HTML (resumen):", html.replace(/<[^>]*>/g, "").slice(0, 200));
    console.log("─────────────────────────────────\n");
    return { messageId: "simulado", simulated: true };
  }

  return transporter.sendMail({ from: FROM, to, subject, html });
}

// ────── Templates ──────────────────────────────────────

function templateVerificacion({ nombres, apellidos, link, clinicaNombre }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:12px; max-width:520px; margin:auto; padding:32px; }
    .btn  { display:inline-block; background:#0d6efd; color:#fff !important; padding:12px 28px;
            border-radius:8px; text-decoration:none; font-weight:600; margin-top:20px; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:24px; }
  </style></head>
  <body>
    <div class="card">
      <h2 style="color:#0d6efd; margin:0 0 8px">¡Bienvenido/a ${nombres} ${apellidos}!</h2>
      <p style="color:#475569">Tu pre-registro en <strong>${clinicaNombre || "la clínica"}</strong>
         fue recibido correctamente.</p>
      <p style="color:#475569">Para activar tu cuenta y tener acceso al portal de pacientes,
         confirma tu correo haciendo clic en el botón:</p>
      <a class="btn" href="${link}">✅ Verificar mi correo</a>
      <p style="color:#94a3b8; font-size:13px; margin-top:20px;">
        Este enlace expira en <strong>24 horas</strong>.
        Si no solicitaste este registro, puedes ignorar este mensaje.
      </p>
      <div class="footer">© ${new Date().getFullYear()} ${clinicaNombre || "Multi-Clínica"}</div>
    </div>
  </body>
  </html>`;
}

function templateBienvenida({ nombres, clinicaNombre }) {
  return `
  <!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:12px; max-width:520px; margin:auto; padding:32px; }
  </style></head>
  <body>
    <div class="card">
      <h2 style="color:#198754">✅ Correo verificado</h2>
      <p>Hola <strong>${nombres}</strong>, tu cuenta en
         <strong>${clinicaNombre || "la clínica"}</strong> está activada.</p>
      <p style="color:#475569">Ya puedes solicitar citas y acceder a tu historial médico.</p>
    </div>
  </body></html>`;
}

function templateCodigo2FA({ nombres, codigo, clinicaNombre }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:12px; max-width:480px; margin:auto; padding:32px; text-align:center; }
    .codigo { font-size:34px; font-weight:800; letter-spacing:8px; color:#0d6efd; margin:20px 0; }
    .footer { color:#94a3b8; font-size:12px; margin-top:24px; }
  </style></head>
  <body>
    <div class="card">
      <h2 style="color:#0d6efd; margin:0 0 8px">Código de verificación</h2>
      <p style="color:#475569">Hola ${nombres || ""}, usa este código para completar tu inicio de sesión en
         <strong>${clinicaNombre || "el sistema"}</strong>:</p>
      <div class="codigo">${codigo}</div>
      <p style="color:#94a3b8; font-size:13px;">
        Expira en <strong>10 minutos</strong>. Si no intentaste iniciar sesión, ignora este correo.
      </p>
      <div class="footer">© ${new Date().getFullYear()} ${clinicaNombre || "Multi-Clínica"}</div>
    </div>
  </body>
  </html>`;
}

function templateResetPassword({ nombres, link, clinicaNombre }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:12px; max-width:520px; margin:auto; padding:32px; }
    .btn  { display:inline-block; background:#0d6efd; color:#fff !important; padding:12px 28px;
            border-radius:8px; text-decoration:none; font-weight:600; margin-top:20px; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:24px; }
  </style></head>
  <body>
    <div class="card">
      <h2 style="color:#0d6efd; margin:0 0 8px">Restablecer contraseña</h2>
      <p style="color:#475569">Hola ${nombres || ""}, recibimos una solicitud para restablecer tu contraseña en
         <strong>${clinicaNombre || "el sistema"}</strong>.</p>
      <a class="btn" href="${link}">🔑 Crear nueva contraseña</a>
      <p style="color:#94a3b8; font-size:13px; margin-top:20px;">
        Este enlace expira en <strong>1 hora</strong>.
        Si no solicitaste este cambio, puedes ignorar este mensaje — tu contraseña actual seguirá funcionando.
      </p>
      <div class="footer">© ${new Date().getFullYear()} ${clinicaNombre || "Multi-Clínica"}</div>
    </div>
  </body>
  </html>`;
}

module.exports = { enviarEmail, templateVerificacion, templateBienvenida, templateCodigo2FA, templateResetPassword };
