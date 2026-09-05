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
  // El From debe estar alineado con la cuenta que autentica (SPF/DKIM), o Gmail
  // lo manda a spam. Si el remitente configurado no trae una dirección <...@...>,
  // lo tratamos como nombre visible y usamos la cuenta autenticada como dirección.
  const fromRaw = db?.from || process.env.EMAIL_FROM || "Medic-KG";
  const from = /<[^>]+@[^>]+>/.test(fromRaw) || /^[^<>\s]+@[^<>\s]+$/.test(fromRaw)
    ? fromRaw
    : `"${fromRaw.replace(/"/g, "")}" <${user}>`;
  return { transporter, from };
}

/**
 * Convierte un HTML de correo en una versión de texto plano legible.
 * Tener parte de texto mejora bastante la entregabilidad (menos spam).
 */
function htmlToText(html = "") {
  return String(html)
    .replace(/<\s*(style|script|head)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|tr|li|table)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Envía un email.
 * @param {object} opts  { to, subject, html, text, attachments }
 * @returns Promise<object>  info de nodemailer (o objeto simulado)
 */
async function enviarEmail({ to, subject, html, text, attachments }) {
  const textFinal = text || (html ? htmlToText(html) : undefined);
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
  return transporter.sendMail({ from, to, subject, html, text: textFinal, attachments });
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
    .creds .item { padding:10px 0; }
    .creds .item + .item { border-top:1px dashed #e2e8f0; margin-top:4px; padding-top:14px; }
    .creds .label { display:block; font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; margin:0 0 6px; }
    .creds .value { display:block; font-size:16px; font-weight:700; color:#0f172a; font-family:'Courier New',monospace; word-break:break-all; }
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
          <div class="item">
            <span class="label">Usuario</span>
            <span class="value">${email}</span>
          </div>
          <div class="item">
            <span class="label">Contraseña</span>
            <span class="value">${password}</span>
          </div>
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

// ────── Contrato de servicio + recibo mensual de licencia ──────

const fmtFecha = (d) => new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "long", year: "numeric" });
const fmtMonto = (m, moneda) => m == null ? "—" : `${moneda || "HNL"} ${Number(m).toFixed(2)}`;

/**
 * Contrato de prestación de servicio (SaaS Medic-KG). Pensado para PDF A4.
 * Se emite el día de la contratación. `clausulasExtra` es texto libre opcional
 * del SUPER_ADMIN (una cláusula por línea).
 */
function templateContratoServicio({
  numero, clinicaNombre, clienteNombre, clienteEmail, planLabel,
  fecha, vigenciaInicio, vigenciaFin, duracionMeses,
  montoTotal, montoMensual, moneda, diaFacturacion, clausulasExtra,
}) {
  const extra = String(clausulasExtra || "")
    .split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => `<li>${l.replace(/</g, "&lt;")}</li>`).join("");

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    * { box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; margin:0; padding:40px 44px; color:#1e293b; font-size:12.5px; line-height:1.55; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0d6efd; padding-bottom:14px; margin-bottom:22px; }
    .brand { font-size:20px; font-weight:800; color:#0d6efd; }
    .brand small { display:block; font-size:10px; font-weight:600; color:#64748b; letter-spacing:.08em; text-transform:uppercase; }
    .doc-no { text-align:right; font-size:11px; color:#475569; }
    .doc-no strong { display:block; font-size:15px; color:#0f172a; }
    h1 { font-size:16px; text-align:center; margin:0 0 20px; letter-spacing:.02em; }
    h2 { font-size:12.5px; color:#0d6efd; margin:20px 0 6px; text-transform:uppercase; letter-spacing:.04em; }
    table.data { width:100%; border-collapse:collapse; margin:6px 0 4px; }
    table.data td { padding:6px 8px; border:1px solid #e2e8f0; font-size:12px; vertical-align:top; }
    table.data td.k { background:#f8fafc; color:#475569; width:32%; font-weight:600; }
    ol { margin:6px 0 6px 18px; padding:0; }
    ol li { margin:4px 0; }
    .total-box { margin-top:10px; background:#f0f7ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; }
    .total-box .row { display:flex; justify-content:space-between; font-size:12.5px; padding:3px 0; }
    .total-box .row.big { font-size:15px; font-weight:800; color:#0d6efd; border-top:1px dashed #bfdbfe; margin-top:6px; padding-top:8px; }
    .fine { margin-top:14px; font-size:10px; color:#64748b; line-height:1.5; }
    .sign { margin-top:46px; display:flex; justify-content:space-between; gap:40px; }
    .sign div { flex:1; text-align:center; border-top:1px solid #94a3b8; padding-top:6px; font-size:11px; color:#475569; }
    .foot { margin-top:34px; text-align:center; font-size:9.5px; color:#94a3b8; }
  </style></head>
  <body>
    <div class="head">
      <div class="brand">Medic-KG<small>Sistema de Gestión Clínica</small></div>
      <div class="doc-no">Contrato N°<strong>${numero}</strong>${fmtFecha(fecha)}</div>
    </div>

    <h1>CONTRATO DE PRESTACIÓN DE SERVICIO DE SOFTWARE</h1>

    <p>Entre <strong>Medic-KG</strong> (en adelante, "el Proveedor") y
       <strong>${clinicaNombre}</strong>, representada por
       <strong>${clienteNombre}</strong> (correo <strong>${clienteEmail || "—"}</strong>)
       (en adelante, "el Cliente"), se acuerda la contratación del servicio bajo los
       términos siguientes.</p>

    <h2>1. Objeto</h2>
    <p>El Proveedor otorga al Cliente una licencia de uso, no exclusiva e intransferible,
       de la plataforma Medic-KG en la modalidad <strong>${planLabel}</strong>, junto con
       el alojamiento, las actualizaciones y el soporte técnico correspondientes durante
       la vigencia del presente contrato.</p>

    <h2>2. Vigencia</h2>
    <table class="data">
      <tr><td class="k">Inicio</td><td>${fmtFecha(vigenciaInicio)}</td></tr>
      <tr><td class="k">Finalización</td><td>${fmtFecha(vigenciaFin)}</td></tr>
      <tr><td class="k">Duración</td><td>${duracionMeses ? `${duracionMeses} ${duracionMeses === 1 ? "mes" : "meses"}` : "—"}</td></tr>
    </table>

    <h2>3. Precio y forma de pago</h2>
    <div class="total-box">
      <div class="row"><span>Cuota mensual acordada</span><span>${fmtMonto(montoMensual, moneda)}</span></div>
      ${montoTotal != null ? `<div class="row"><span>Valor total del período</span><span>${fmtMonto(montoTotal, moneda)}</span></div>` : ""}
      <div class="row"><span>Día de facturación</span><span>${diaFacturacion ? `${diaFacturacion} de cada mes` : "—"}</span></div>
      <div class="row big"><span>Cuota mensual</span><span>${fmtMonto(montoMensual, moneda)}</span></div>
    </div>
    <p style="margin-top:8px">El Proveedor emitirá al Cliente un <strong>recibo mensual</strong> por el
       monto de la cuota, a partir del mes siguiente a la firma de este contrato y en el
       día de facturación indicado. Los valores expresados <strong>no incluyen impuestos</strong>;
       cualquier tributo aplicable se calculará y facturará por separado conforme a la
       legislación vigente.</p>

    <h2>4. Condiciones del plan contratado</h2>
    <ol>
      <li>El plan contratado <strong>no admite cancelación anticipada</strong>; el Cliente se
          obliga a cubrir la totalidad de las cuotas del período acordado
          (${duracionMeses ? `${duracionMeses} ${duracionMeses === 1 ? "mes" : "meses"}` : "el período pactado"}),
          aun cuando deje de utilizar el servicio antes de su vencimiento.</li>
      <li>El precio de la cuota permanece fijo durante todo el período contratado.</li>
      <li>La falta de pago de una cuota por más de <strong>10 días calendario</strong> faculta al
          Proveedor a suspender el acceso al sistema hasta la regularización, sin que ello
          libere al Cliente del pago de las cuotas pendientes.</li>
      <li>Al vencimiento, el contrato podrá renovarse por acuerdo de ambas partes,
          pudiendo actualizarse la cuota para el nuevo período.</li>
      <li>El Cliente es responsable de la veracidad de los datos que registra y del uso que
          hace el personal a su cargo dentro de la plataforma.</li>
      <li>El Proveedor resguarda la información del Cliente con respaldos periódicos y no
          divulga datos de pacientes a terceros, salvo requerimiento de autoridad competente.</li>
      <li>El Cliente podrá exportar su información durante la vigencia y hasta
          <strong>30 días</strong> después de finalizado el contrato; transcurrido ese plazo el
          Proveedor podrá depurar los datos.</li>
      <li>Ninguna de las partes será responsable por incumplimientos derivados de caso
          fortuito o fuerza mayor.</li>
      ${extra}
    </ol>

    <p class="fine">Este documento constituye la constancia de contratación del servicio y
       reemplaza cualquier acuerdo verbal previo. La aceptación del servicio y/o el pago de la
       primera cuota implican la conformidad plena del Cliente con estas condiciones.</p>

    <div class="sign">
      <div>Medic-KG — El Proveedor</div>
      <div>${clienteNombre}<br/>${clinicaNombre} — El Cliente</div>
    </div>

    <div class="foot">Medic-KG · Sistema de Gestión Clínica · Documento generado el ${fmtFecha(new Date())}</div>
  </body>
  </html>`;
}

/** Cuerpo del correo que acompaña al contrato. */
function templateContratoEmail({ clienteNombre, clinicaNombre, planLabel, numero }) {
  return `
  <!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8" /><style>
    body { font-family:'Segoe UI',sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:16px; max-width:520px; margin:auto; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,.06); }
    .banner { background:linear-gradient(135deg,#0d6efd,#2563eb); padding:34px 32px 26px; text-align:center; color:#fff; }
    .banner h2 { margin:0; font-size:21px; }
    .body { padding:26px 32px 30px; color:#334155; font-size:14px; line-height:1.6; }
    .box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px 18px; margin:16px 0; font-size:13px; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:20px; padding-bottom:8px; }
  </style></head>
  <body>
    <div class="card">
      <div class="banner"><h2>Contratación de servicio confirmada</h2></div>
      <div class="body">
        <p>Hola <strong>${clienteNombre}</strong>, confirmamos la contratación del servicio
           <strong>Medic-KG</strong> para <strong>${clinicaNombre}</strong>.</p>
        <div class="box">
          <div><strong>Contrato:</strong> ${numero}</div>
          <div><strong>Plan:</strong> ${planLabel}</div>
        </div>
        <p>Adjunto encontrarás el <strong>contrato de servicio</strong> en PDF con las
           condiciones del plan acordado. Consérvalo para tus registros.</p>
        <p>A partir del próximo mes recibirás cada mes el <strong>recibo</strong> por la cuota
           mensual acordada.</p>
        <div class="footer">© ${new Date().getFullYear()} Medic-KG</div>
      </div>
    </div>
  </body>
  </html>`;
}

/**
 * Recibo mensual de la licencia. Pensado para PDF (media carta).
 * Incluye la nota de que el monto no lleva impuestos según el contrato.
 */
function templateReciboMensual({
  numero, clinicaNombre, clienteNombre, contratoNumero, planLabel,
  periodoLabel, periodoInicio, periodoFin, concepto,
  monto, moneda, fechaEmision,
}) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8" /><style>
    body { font-family:'Segoe UI',Arial,sans-serif; margin:0; padding:34px 36px; color:#1e293b; font-size:13px; }
    .card { max-width:540px; margin:auto; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
    .top { background:linear-gradient(135deg,#0d6efd,#2563eb); color:#fff; padding:22px 26px; }
    .top .brand { font-size:17px; font-weight:800; }
    .top .brand small { display:block; font-size:9px; letter-spacing:.1em; text-transform:uppercase; opacity:.85; }
    .top .no { margin-top:8px; font-size:12px; opacity:.95; }
    .body { padding:22px 26px 24px; }
    h2 { font-size:14px; margin:0 0 12px; letter-spacing:.02em; }
    table { width:100%; border-collapse:collapse; }
    td { padding:7px 0; border-bottom:1px solid #eef2f7; font-size:12.5px; }
    td.k { color:#64748b; width:42%; }
    .total { margin-top:14px; background:#f0f7ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; }
    .total .lbl { font-size:12px; color:#475569; text-transform:uppercase; letter-spacing:.05em; }
    .total .val { font-size:19px; font-weight:800; color:#0d6efd; }
    .fine { margin-top:14px; font-size:9.5px; color:#94a3b8; line-height:1.5; }
    .foot { margin-top:16px; text-align:center; font-size:9px; color:#cbd5e1; }
  </style></head>
  <body>
    <div class="card">
      <div class="top">
        <div class="brand">Medic-KG<small>Sistema de Gestión Clínica</small></div>
        <div class="no">Recibo N° ${numero} · Emitido el ${fmtFecha(fechaEmision)}</div>
      </div>
      <div class="body">
        <h2>Recibo de cuota mensual</h2>
        <table>
          <tr><td class="k">Cliente</td><td>${clienteNombre || "—"}</td></tr>
          <tr><td class="k">Clínica</td><td>${clinicaNombre}</td></tr>
          <tr><td class="k">Plan</td><td>${planLabel || "—"}</td></tr>
          <tr><td class="k">Contrato</td><td>${contratoNumero || "—"}</td></tr>
          <tr><td class="k">Período facturado</td><td>${periodoLabel}${periodoInicio ? ` (${fmtFecha(periodoInicio)} – ${fmtFecha(periodoFin)})` : ""}</td></tr>
          <tr><td class="k">Concepto</td><td>${concepto || "Cuota mensual del servicio"}</td></tr>
        </table>
        <div class="total">
          <span class="lbl">Monto de la cuota</span>
          <span class="val">${fmtMonto(monto, moneda)}</span>
        </div>
        <p class="fine">El monto de este recibo <strong>no incluye impuestos</strong>, conforme a lo
           acordado en el contrato del plan${contratoNumero ? ` N° ${contratoNumero}` : ""}.
           Cualquier tributo aplicable se factura por separado según la legislación vigente.
           Este documento es un comprobante del cobro de la cuota del período indicado.</p>
        <div class="foot">© ${new Date().getFullYear()} Medic-KG · Documento generado automáticamente</div>
      </div>
    </div>
  </body>
  </html>`;
}

/** Cuerpo del correo que acompaña al recibo mensual. */
function templateReciboEmail({ clienteNombre, clinicaNombre, periodoLabel, monto, moneda }) {
  return `
  <!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8" /><style>
    body { font-family:'Segoe UI',sans-serif; background:#f1f5f9; margin:0; padding:24px; }
    .card { background:#fff; border-radius:16px; max-width:520px; margin:auto; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,.06); }
    .banner { background:linear-gradient(135deg,#0d6efd,#2563eb); padding:32px; text-align:center; color:#fff; }
    .banner h2 { margin:0; font-size:20px; }
    .body { padding:24px 32px 28px; color:#334155; font-size:14px; line-height:1.6; }
    .amount { font-size:22px; font-weight:800; color:#0d6efd; margin:6px 0 2px; }
    .footer { color:#94a3b8; font-size:12px; text-align:center; margin-top:20px; padding-bottom:8px; }
  </style></head>
  <body>
    <div class="card">
      <div class="banner"><h2>Recibo del período ${periodoLabel}</h2></div>
      <div class="body">
        <p>Hola <strong>${clienteNombre || clinicaNombre}</strong>, adjuntamos el recibo
           correspondiente a la cuota mensual del servicio Medic-KG para
           <strong>${clinicaNombre}</strong>.</p>
        <div class="amount">${fmtMonto(monto, moneda)}</div>
        <p style="color:#64748b; font-size:12.5px;">El monto no incluye impuestos, según lo
           acordado en el contrato del plan.</p>
        <div class="footer">© ${new Date().getFullYear()} Medic-KG</div>
      </div>
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
  templateContratoServicio,
  templateContratoEmail,
  templateReciboMensual,
  templateReciboEmail,
  NOMBRE_PLAN,
  NIVEL_PLAN_LABEL,
  planCompletoLabel,
};
