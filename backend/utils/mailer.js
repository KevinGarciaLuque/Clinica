const nodemailer = require("nodemailer");
const pool = require("../db");
const { decrypt } = require("./crypto");

// La config SMTP la puede editar el SUPER_ADMIN desde el panel (tabla config_smtp).
// Si no hay nada guardado ahí, se usa el .env como respaldo (modo clásico).
let cachedSmtp = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

function invalidateSmtpCache() {
  cachedSmtp = null;
  cachedAt = 0;
}

async function getSmtpConfigFromDb() {
  const now = Date.now();
  if ((now - cachedAt) < CACHE_TTL_MS) return cachedSmtp;
  try {
    const [[row]] = await pool.query("SELECT * FROM config_smtp WHERE id=1 LIMIT 1");
    cachedSmtp = (row?.smtp_user && row?.smtp_pass_enc)
      ? {
          host:   row.smtp_host || "smtp.gmail.com",
          port:   Number(row.smtp_port || 587),
          secure: !!row.smtp_secure,
          user:   row.smtp_user,
          pass:   decrypt(row.smtp_pass_enc),
          from:   row.email_from || null,
        }
      : null;
  } catch {
    cachedSmtp = null;
  }
  cachedAt = now;
  return cachedSmtp;
}

// Crea el transporter: primero intenta la config guardada por el SUPER_ADMIN (BD),
// si no existe cae al .env. Si tampoco hay .env, sólo imprime en consola (modo dev).
async function buildTransporter() {
  const db = await getSmtpConfigFromDb();
  const user = db?.user || process.env.SMTP_USER;
  const pass = db?.pass || process.env.SMTP_PASS;
  if (!user || !pass) return null;

  const transporter = nodemailer.createTransport({
    host:   db?.host || process.env.SMTP_HOST || "smtp.gmail.com",
    port:   db?.port || Number(process.env.SMTP_PORT || 587),
    secure: db ? db.secure : process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  const from = db?.from || process.env.EMAIL_FROM || '"Medic-KG" <noreply@medickg.com>';
  return { transporter, from };
}

/**
 * Envía un email.
 * @param {object} opts  { to, subject, html, attachments }
 * @returns Promise<object>  info de nodemailer (o objeto simulado)
 */
async function enviarEmail({ to, subject, html, attachments }) {
  const built = await buildTransporter();

  if (!built) {
    // Modo desarrollo sin SMTP configurado → solo log
    console.log("\n📧 [MAILER simulado]");
    console.log("  Para:    ", to);
    console.log("  Asunto:  ", subject);
    console.log("  HTML (resumen):", html.replace(/<[^>]*>/g, "").slice(0, 200));
    if (attachments?.length) {
      console.log("  Adjuntos:", attachments.map((a) => a.filename).join(", "));
    }
    console.log("─────────────────────────────────\n");
    return { messageId: "simulado", simulated: true };
  }

  const { transporter, from } = built;
  return transporter.sendMail({ from, to, subject, html, attachments });
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
      <div class="footer">© ${new Date().getFullYear()} ${clinicaNombre || "Medic-KG"}</div>
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
      <div class="footer">© ${new Date().getFullYear()} ${clinicaNombre || "Medic-KG"}</div>
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
      <div class="footer">© ${new Date().getFullYear()} ${clinicaNombre || "Medic-KG"}</div>
    </div>
  </body>
  </html>`;
}

const NOMBRE_PLAN = { trial: "Prueba (14 días)", semestral: "Semestral", anual: "Anual" };
const NIVEL_PLAN_LABEL = { basico: "Básico", avanzado: "Avanzado", empresarial: "Empresarial" };

function planCompletoLabel(nivel, duracion) {
  const n = NIVEL_PLAN_LABEL[nivel] || nivel;
  if (duracion === "trial") return `${n} — Prueba gratis`;
  return `${n} — ${NOMBRE_PLAN[duracion] || duracion}`;
}

function templateSolicitudRecibida({ nombres, planNombre }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:12px; max-width:520px; margin:auto; padding:32px; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:24px; }
  </style></head>
  <body>
    <div class="card">
      <h2 style="color:#0d6efd; margin:0 0 8px">¡Recibimos tu comprobante!</h2>
      <p style="color:#475569">Hola <strong>${nombres}</strong>, recibimos tu solicitud del plan
         <strong>${planNombre}</strong> junto con el comprobante de transferencia.</p>
      <p style="color:#475569">Nuestro equipo validará el pago en banca en línea y te avisaremos
         por este mismo correo apenas quede activado.</p>
      <div class="footer">© ${new Date().getFullYear()} Medic-KG</div>
    </div>
  </body>
  </html>`;
}

function templateSolicitudAprobada({ nombres, planNombre }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:16px; max-width:520px; margin:auto; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,.06); }
    .banner { background:linear-gradient(135deg,#10b981,#059669); padding:36px 32px 28px; text-align:center; }
    .banner .emoji { font-size:44px; line-height:1; margin-bottom:8px; }
    .banner h2 { color:#fff; margin:0; font-size:22px; }
    .body { padding:28px 32px 32px; }
    .steps { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 18px; margin:18px 0; }
    .steps p { margin:4px 0; font-size:14px; color:#166534; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:24px; padding-bottom:8px; }
  </style></head>
  <body>
    <div class="card">
      <div class="banner">
        <div class="emoji">🎉</div>
        <h2>¡Felicidades, ${nombres}!</h2>
      </div>
      <div class="body">
        <p style="color:#334155; font-size:15px; line-height:1.6;">
          Confirmamos tu transferencia y con mucho gusto activamos tu plan
          <strong style="color:#059669">${planNombre}</strong>. ¡Bienvenido/a a Medic-KG!
        </p>
        <div class="steps">
          <p>📬 En unos minutos te llegará <strong>otro correo</strong> con tu usuario y contraseña.</p>
          <p>🚀 Con eso ya podrás entrar al sistema y empezar a usarlo.</p>
        </div>
        <p style="color:#64748b; font-size:13px;">
          Gracias por confiar en nosotros. Si tienes cualquier duda, estamos para ayudarte.
        </p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} Medic-KG</div>
    </div>
  </body>
  </html>`;
}

function templateCredenciales({ nombres, email, password, loginUrl, clinicaNombre }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:16px; max-width:520px; margin:auto; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,.06); }
    .banner { background:linear-gradient(135deg,#0d6efd,#2563eb); padding:36px 32px 28px; text-align:center; }
    .banner .emoji { font-size:44px; line-height:1; margin-bottom:8px; }
    .banner h2 { color:#fff; margin:0; font-size:22px; }
    .body { padding:28px 32px 32px; }
    .creds { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px 20px; margin:20px 0; }
    .creds .row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; }
    .creds .row + .row { border-top:1px dashed #e2e8f0; }
    .creds .label { font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:.04em; }
    .creds .value { font-size:15px; font-weight:700; color:#0f172a; font-family:'Courier New',monospace; }
    .btn  { display:block; text-align:center; background:linear-gradient(135deg,#0d6efd,#2563eb); color:#fff !important;
            padding:13px 0; border-radius:10px; text-decoration:none; font-weight:700; margin-top:16px; font-size:15px; }
    .tip  { background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px 16px; margin-top:18px; }
    .tip p { margin:0; font-size:13px; color:#92400e; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:24px; padding-bottom:8px; }
  </style></head>
  <body>
    <div class="card">
      <div class="banner">
        <div class="emoji">🔑</div>
        <h2>¡Tu cuenta ya está lista!</h2>
      </div>
      <div class="body">
        <p style="color:#334155; font-size:15px; line-height:1.6;">
          Hola <strong>${nombres}</strong>, tu clínica <strong>${clinicaNombre}</strong> quedó configurada
          y lista para usarse. Aquí tienes tus datos de acceso:
        </p>
        <div class="creds">
          <div class="row"><span class="label">Usuario</span><span class="value">${email}</span></div>
          <div class="row"><span class="label">Contraseña</span><span class="value">${password}</span></div>
        </div>
        <a class="btn" href="${loginUrl}">Ingresar al sistema →</a>
        <div class="tip">
          <p>🔒 Por tu seguridad, te recomendamos cambiar esta contraseña apenas ingreses por primera vez.</p>
        </div>
        <p style="color:#64748b; font-size:13px; margin-top:18px;">
          ¡Gracias por confiar en nosotros para gestionar tu clínica! Cualquier duda, aquí estamos.
        </p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} ${clinicaNombre}</div>
    </div>
  </body>
  </html>`;
}

function templateSolicitudRechazada({ nombres, motivo }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:12px; max-width:520px; margin:auto; padding:32px; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:24px; }
  </style></head>
  <body>
    <div class="card">
      <h2 style="color:#dc3545; margin:0 0 8px">No pudimos validar tu pago</h2>
      <p style="color:#475569">Hola <strong>${nombres}</strong>, no pudimos confirmar tu transferencia
         con el comprobante enviado.</p>
      ${motivo ? `<p style="color:#475569"><strong>Motivo:</strong> ${motivo}</p>` : ""}
      <p style="color:#475569">Por favor contáctanos o vuelve a enviar tu solicitud con un comprobante válido.</p>
      <div class="footer">© ${new Date().getFullYear()} Medic-KG</div>
    </div>
  </body>
  </html>`;
}

function templateFacturaRecibo({ nombres, clinicaNombre, planNombre, monto, moneda, fecha, numeroRecibo }) {
  const montoLabel = monto != null ? `${moneda || "PEN"} ${Number(monto).toFixed(2)}` : "—";
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; margin:0; padding:32px; color:#1e293b; }
    .card { max-width:560px; margin:auto; border:1px solid #e2e8f0; border-radius:12px; padding:32px; }
    h2 { color:#0d6efd; margin:0 0 4px }
    table { width:100%; border-collapse:collapse; margin-top:20px; }
    td { padding:8px 0; border-bottom:1px solid #e2e8f0; font-size:14px; }
    td.label { color:#64748b; width:40%; }
    .total { font-size:18px; font-weight:700; color:#0d6efd; }
  </style></head>
  <body>
    <div class="card">
      <h2>Recibo de pago</h2>
      <p style="color:#64748b; font-size:13px; margin:0">N° ${numeroRecibo}</p>
      <table>
        <tr><td class="label">Cliente</td><td>${nombres}</td></tr>
        <tr><td class="label">Clínica</td><td>${clinicaNombre}</td></tr>
        <tr><td class="label">Plan</td><td>${planNombre}</td></tr>
        <tr><td class="label">Fecha</td><td>${fecha}</td></tr>
        <tr><td class="label">Total</td><td class="total">${montoLabel}</td></tr>
      </table>
    </div>
  </body>
  </html>`;
}

function templateSolicitudResena({ nombreMedico, link, clinicaNombre }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family: 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:16px; max-width:520px; margin:auto; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,.06); }
    .banner { background:linear-gradient(135deg,#f59e0b,#f97316); padding:36px 32px 28px; text-align:center; }
    .banner .emoji { font-size:44px; line-height:1; margin-bottom:8px; }
    .banner h2 { color:#fff; margin:0; font-size:22px; }
    .body { padding:28px 32px 32px; }
    .stars { text-align:center; font-size:26px; letter-spacing:4px; color:#f59e0b; margin:18px 0; }
    .btn  { display:block; text-align:center; background:linear-gradient(135deg,#f59e0b,#f97316); color:#fff !important;
            padding:13px 0; border-radius:10px; text-decoration:none; font-weight:700; margin-top:8px; font-size:15px; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:24px; padding-bottom:8px; }
  </style></head>
  <body>
    <div class="card">
      <div class="banner">
        <div class="emoji">⭐</div>
        <h2>¡Tu opinión nos importa!</h2>
      </div>
      <div class="body">
        <p style="color:#334155; font-size:15px; line-height:1.6;">
          Hola <strong>${nombreMedico}</strong>, gracias por confiar en nosotros para gestionar
          <strong>${clinicaNombre || "tu clínica"}</strong>. Nos encantaría conocer tu experiencia
          con el sistema — toma menos de un minuto.
        </p>
        <div class="stars">★★★★★</div>
        <a class="btn" href="${link}">Dejar mi reseña →</a>
        <p style="color:#94a3b8; font-size:13px; margin-top:18px; text-align:center;">
          Tu reseña podría aparecer en nuestra página de inicio, ayudando a otros médicos a conocernos.
        </p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} Medic-KG</div>
    </div>
  </body>
  </html>`;
}

module.exports = {
  enviarEmail,
  invalidateSmtpCache,
  templateVerificacion,
  templateBienvenida,
  templateSolicitudResena,
  templateCodigo2FA,
  templateResetPassword,
  templateSolicitudRecibida,
  templateSolicitudAprobada,
  templateCredenciales,
  templateSolicitudRechazada,
  templateFacturaRecibo,
  NOMBRE_PLAN,
  NIVEL_PLAN_LABEL,
  planCompletoLabel,
};
