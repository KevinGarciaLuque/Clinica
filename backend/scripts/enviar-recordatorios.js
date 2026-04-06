/**
 * Script de envío automático de recordatorios
 * 
 * Este script debe ejecutarse periódicamente (ej: cada hora o diariamente)
 * para enviar recordatorios de citas según la configuración de cada clínica.
 * 
 * Uso:
 *   node scripts/enviar-recordatorios.js
 * 
 * Para automatizar con cron (Linux/Mac):
 *   0 8 * * * cd /ruta/backend && node scripts/enviar-recordatorios.js
 * 
 * Para Windows Task Scheduler:
 *   Programa: node.exe
 *   Argumentos: C:\ruta\backend\scripts\enviar-recordatorios.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const db = require("../db");

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-key-32-chars-long-xxxx";

function decrypt(text) {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const parts = text.split(":");
    const iv = Buffer.from(parts.shift(), "hex");
    const encryptedText = parts.join(":");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return text;
  }
}

function reemplazarVariables(texto, variables) {
  let resultado = texto;
  for (const [key, value] of Object.entries(variables)) {
    resultado = resultado.replace(new RegExp(`{${key}}`, "g"), value);
  }
  return resultado;
}

// ═══════════════════════════════════════════════════════════════
// ENVÍO DE RECORDATORIOS
// ═══════════════════════════════════════════════════════════════

async function enviarRecordatoriosAutomaticos() {
  // Usar el pool compartido de db.js para garantizar misma conexión/timezone
  const connection = db;

  try {
    console.log("🚀 Iniciando envío automático de recordatorios...\n");

    // Obtener todas las clínicas con recordatorios activos
    const [clinicas] = await connection.query(`
      SELECT c.id AS clinica_id, c.nombre, crc.*
      FROM clinicas c
      INNER JOIN clinica_recordatorios_config crc ON c.id = crc.clinica_id
      WHERE c.activo = 1
        AND (crc.email_activo = 1 OR crc.sms_activo = 1 OR crc.whatsapp_activo = 1)
    `);

    console.log(`📋 Clínicas activas con recordatorios: ${clinicas.length}\n`);

    for (const clinica of clinicas) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🏥 Procesando: ${clinica.nombre}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      await procesarClinica(connection, clinica);
    }

    console.log("\n✅ Proceso completado exitosamente");
  } catch (error) {
    console.error("❌ Error en proceso de recordatorios:", error);
    throw error;
  }
}

async function procesarClinica(connection, clinica) {
  const ahora = new Date();
  const tiempos = [];

  // Determinar qué ventanas de tiempo verificar
  if (clinica.email_activo || clinica.sms_activo || clinica.whatsapp_activo) {
    if (clinica.email_48h || clinica.sms_48h || clinica.whatsapp_48h) tiempos.push(48);
    if (clinica.email_24h || clinica.sms_24h || clinica.whatsapp_24h) tiempos.push(24);
    if (clinica.email_2h || clinica.sms_2h || clinica.whatsapp_2h) tiempos.push(2);
  }

  console.log(`   Ventanas activas: ${tiempos.join(", ")}h`);

  for (const horas of tiempos) {
    // Ventana de ±1h centrada en la marca objetivo para mayor resiliencia
    const inicio = new Date(ahora.getTime() + (horas - 1) * 60 * 60 * 1000);
    const fin = new Date(ahora.getTime() + (horas + 1) * 60 * 60 * 1000);

    console.log(`   🔍 Verificando ventana ${horas}h (${inicio.toLocaleTimeString()} – ${fin.toLocaleTimeString()})...`);

    // Obtener citas en esta ventana de tiempo
    const [citas] = await connection.query(
      `SELECT c.*, 
              p.nombres as paciente_nombres, p.apellidos as paciente_apellidos,
              p.email as paciente_email, p.telefono as paciente_telefono,
              CONCAT(u.nombres, ' ', u.apellidos) as medico_nombre
       FROM citas c
       INNER JOIN pacientes p ON c.paciente_id = p.id
       INNER JOIN usuarios u ON c.medico_id = u.id
       WHERE c.clinica_id = ?
         AND c.inicio BETWEEN ? AND ?
         AND c.estado IN ('PENDIENTE', 'CONFIRMADA')`,
      [clinica.clinica_id, inicio, fin]
    );

    if (citas.length > 0) {
      console.log(`⏰ ${horas}h antes: ${citas.length} cita(s) encontrada(s)`);
    }

    for (const cita of citas) {
      const variables = {
        paciente: `${cita.paciente_nombres} ${cita.paciente_apellidos}`,
        medico: cita.medico_nombre,
        fecha: new Date(cita.inicio).toLocaleDateString("es-ES", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        hora: new Date(cita.inicio).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        clinica: clinica.nombre,
      };

      // Verificar si ya se envió este recordatorio
      const [existente] = await connection.query(
        `SELECT id FROM cita_recordatorios 
         WHERE cita_id = ? AND tipo LIKE ? AND enviado = 1`,
        [cita.id, `%_${horas}H`]
      );

      if (existente.length > 0) {
        console.log(`   ⏭️  Recordatorio ${horas}h ya enviado para cita #${cita.id}`);
        continue;
      }

      // EMAIL
      if (
        clinica.email_activo &&
        ((horas === 48 && clinica.email_48h) ||
          (horas === 24 && clinica.email_24h) ||
          (horas === 2 && clinica.email_2h))
      ) {
        await enviarEmail(connection, clinica.clinica_id, cita, horas, variables);
      }

      // SMS
      if (
        clinica.sms_activo &&
        ((horas === 48 && clinica.sms_48h) || (horas === 24 && clinica.sms_24h) || (horas === 2 && clinica.sms_2h))
      ) {
        await enviarSMS(connection, clinica.clinica_id, cita, horas, variables);
      }

      // WHATSAPP
      if (
        clinica.whatsapp_activo &&
        ((horas === 48 && clinica.whatsapp_48h) ||
          (horas === 24 && clinica.whatsapp_24h) ||
          (horas === 2 && clinica.whatsapp_2h))
      ) {
        await enviarWhatsApp(connection, clinica.clinica_id, cita, horas, variables);
      }
    }
  }
}

// ─── EMAIL ─────────────────────────────────────────────────────

async function enviarEmail(connection, clinicaId, cita, horas, variables) {
  try {
    // Obtener config SMTP
    const [smtpRows] = await connection.query(
      "SELECT * FROM clinica_smtp_config WHERE clinica_id = ? AND activo = 1",
      [clinicaId]
    );

    if (smtpRows.length === 0) {
      console.log("   ⚠️  Email: No hay configuración SMTP activa");
      return;
    }

    const smtp = smtpRows[0];

    // Obtener plantilla
    const [plantillaRows] = await connection.query(
      `SELECT * FROM plantillas_recordatorio 
       WHERE clinica_id = ? AND tipo = 'EMAIL' AND horas_antes = ? AND activo = 1
       ORDER BY es_predeterminada DESC
       LIMIT 1`,
      [clinicaId, horas]
    );

    if (plantillaRows.length === 0) {
      console.log(`   ⚠️  Email: No hay plantilla para ${horas}h`);
      return;
    }

    const plantilla = plantillaRows[0];
    const asunto = reemplazarVariables(plantilla.asunto, variables);
    const contenido = reemplazarVariables(plantilla.contenido, variables);

    // Enviar email
    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: smtp.smtp_port,
      secure: smtp.smtp_secure === 1,
      auth: {
        user: smtp.smtp_user,
        pass: decrypt(smtp.smtp_pass),
      },
    });

    await transporter.sendMail({
      from: `"${smtp.from_name}" <${smtp.from_email}>`,
      to: cita.paciente_email,
      subject: asunto,
      html: contenido,
    });

    // Registrar envío
    await connection.query(
      `INSERT INTO cita_recordatorios 
       (cita_id, tipo, mensaje, destinatario, proveedor, enviado, enviado_en, programado_para)
       VALUES (?, ?, ?, ?, 'SMTP', 1, NOW(), ?)`,
      [cita.id, `EMAIL_${horas}H`, contenido, cita.paciente_email, cita.inicio]
    );

    await connection.query(
      `INSERT INTO historial_recordatorios
       (clinica_id, cita_id, paciente_id, tipo, destinatario, asunto, mensaje, estado, proveedor, enviado_en)
       VALUES (?, ?, ?, 'EMAIL', ?, ?, ?, 'ENVIADO', 'SMTP', NOW())`,
      [clinicaId, cita.id, cita.paciente_id, cita.paciente_email, asunto, contenido]
    );

    console.log(`   ✅ Email enviado a ${cita.paciente_email}`);
  } catch (error) {
    console.error(`   ❌ Error enviando email:`, error.message);

    await connection.query(
      `INSERT INTO historial_recordatorios
       (clinica_id, cita_id, paciente_id, tipo, destinatario, mensaje, estado, error, creado_en)
       VALUES (?, ?, ?, 'EMAIL', ?, '', 'FALLIDO', ?, NOW())`,
      [clinicaId, cita.id, cita.paciente_id, cita.paciente_email, error.message]
    );
  }
}

// ─── SMS ───────────────────────────────────────────────────────

async function enviarSMS(connection, clinicaId, cita, horas, variables) {
  try {
    // Obtener config Twilio
    const [configRows] = await connection.query(
      "SELECT * FROM clinica_mensajeria_config WHERE clinica_id = ? AND servicio = 'TWILIO_SMS' AND activo = 1",
      [clinicaId]
    );

    if (configRows.length === 0) {
      console.log("   ⚠️  SMS: No hay configuración de Twilio activa");
      return;
    }

    const config = configRows[0];

    // Obtener plantilla
    const [plantillaRows] = await connection.query(
      `SELECT * FROM plantillas_recordatorio 
       WHERE clinica_id = ? AND tipo = 'SMS' AND horas_antes = ? AND activo = 1
       ORDER BY es_predeterminada DESC
       LIMIT 1`,
      [clinicaId, horas]
    );

    if (plantillaRows.length === 0) {
      console.log(`   ⚠️  SMS: No hay plantilla para ${horas}h`);
      return;
    }

    const plantilla = plantillaRows[0];
    const mensaje = reemplazarVariables(plantilla.contenido, variables);

    // Enviar SMS con Twilio
    const twilio = require("twilio");
    const client = twilio(config.account_sid, decrypt(config.auth_token));

    const result = await client.messages.create({
      body: mensaje,
      from: config.from_number,
      to: cita.paciente_telefono,
    });

    // Registrar envío
    await connection.query(
      `INSERT INTO cita_recordatorios 
       (cita_id, tipo, mensaje, destinatario, proveedor, response_id, enviado, enviado_en, programado_para)
       VALUES (?, ?, ?, ?, 'TWILIO_SMS', ?, 1, NOW(), ?)`,
      [cita.id, `SMS_${horas}H`, mensaje, cita.paciente_telefono, result.sid, cita.inicio]
    );

    await connection.query(
      `INSERT INTO historial_recordatorios
       (clinica_id, cita_id, paciente_id, tipo, destinatario, mensaje, estado, proveedor, response_id, enviado_en)
       VALUES (?, ?, ?, 'SMS', ?, ?, 'ENVIADO', 'TWILIO_SMS', ?, NOW())`,
      [clinicaId, cita.id, cita.paciente_id, cita.paciente_telefono, mensaje, result.sid]
    );

    console.log(`   ✅ SMS enviado a ${cita.paciente_telefono}`);
  } catch (error) {
    console.error(`   ❌ Error enviando SMS:`, error.message);

    await connection.query(
      `INSERT INTO historial_recordatorios
       (clinica_id, cita_id, paciente_id, tipo, destinatario, mensaje, estado, error, creado_en)
       VALUES (?, ?, ?, 'SMS', ?, '', 'FALLIDO', ?, NOW())`,
      [clinicaId, cita.id, cita.paciente_id, cita.paciente_telefono, error.message]
    );
  }
}

// ─── WHATSAPP ──────────────────────────────────────────────────

async function enviarWhatsApp(connection, clinicaId, cita, horas, variables) {
  try {
    // Obtener config Twilio WhatsApp
    const [configRows] = await connection.query(
      "SELECT * FROM clinica_mensajeria_config WHERE clinica_id = ? AND servicio = 'TWILIO_WHATSAPP' AND activo = 1",
      [clinicaId]
    );

    if (configRows.length === 0) {
      console.log("   ⚠️  WhatsApp: No hay configuración de Twilio activa");
      return;
    }

    const config = configRows[0];

    // Obtener plantilla
    const [plantillaRows] = await connection.query(
      `SELECT * FROM plantillas_recordatorio 
       WHERE clinica_id = ? AND tipo = 'WHATSAPP' AND horas_antes = ? AND activo = 1
       ORDER BY es_predeterminada DESC
       LIMIT 1`,
      [clinicaId, horas]
    );

    if (plantillaRows.length === 0) {
      console.log(`   ⚠️  WhatsApp: No hay plantilla para ${horas}h`);
      return;
    }

    const plantilla = plantillaRows[0];
    const mensaje = reemplazarVariables(plantilla.contenido, variables);

    // Enviar WhatsApp con Twilio
    const twilio = require("twilio");
    const client = twilio(config.account_sid, decrypt(config.auth_token));

    const result = await client.messages.create({
      body: mensaje,
      from: `whatsapp:${config.from_number}`,
      to: `whatsapp:${cita.paciente_telefono}`,
    });

    // Registrar envío
    await connection.query(
      `INSERT INTO cita_recordatorios 
       (cita_id, tipo, mensaje, destinatario, proveedor, response_id, enviado, enviado_en, programado_para)
       VALUES (?, ?, ?, ?, 'TWILIO_WHATSAPP', ?, 1, NOW(), ?)`,
      [cita.id, `WHATSAPP_${horas}H`, mensaje, cita.paciente_telefono, result.sid, cita.inicio]
    );

    await connection.query(
      `INSERT INTO historial_recordatorios
       (clinica_id, cita_id, paciente_id, tipo, destinatario, mensaje, estado, proveedor, response_id, enviado_en)
       VALUES (?, ?, ?, 'WHATSAPP', ?, ?, 'ENVIADO', 'TWILIO_WHATSAPP', ?, NOW())`,
      [clinicaId, cita.id, cita.paciente_id, cita.paciente_telefono, mensaje, result.sid]
    );

    console.log(`   ✅ WhatsApp enviado a ${cita.paciente_telefono}`);
  } catch (error) {
    console.error(`   ❌ Error enviando WhatsApp:`, error.message);

    await connection.query(
      `INSERT INTO historial_recordatorios
       (clinica_id, cita_id, paciente_id, tipo, destinatario, mensaje, estado, error, creado_en)
       VALUES (?, ?, ?, 'WHATSAPP', ?, '', 'FALLIDO', ?, NOW())`,
      [clinicaId, cita.id, cita.paciente_id, cita.paciente_telefono, error.message]
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// EJECUTAR
// ═══════════════════════════════════════════════════════════════

if (require.main === module) {
  enviarRecordatoriosAutomaticos()
    .then(() => {
      console.log("\n🎉 Script finalizado");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n💥 Error fatal:", err);
      process.exit(1);
    });
}

module.exports = enviarRecordatoriosAutomaticos;
