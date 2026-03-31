const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middlewares/auth");
const crypto = require("crypto");

// ═══════════════════════════════════════════════════════════════
// UTILIDADES DE ENCRIPTACIÓN
// ═══════════════════════════════════════════════════════════════

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-key-32-chars-long-xxxx";
const IV_LENGTH = 16;

function encrypt(text) {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

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
    return text; // Si falla, devuelve el texto original
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. CONFIGURACIÓN SMTP
// ═══════════════════════════════════════════════════════════════

// GET: Obtener config SMTP de la clínica
router.get("/config/smtp", auth(), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, clinica_id, smtp_host, smtp_port, smtp_user, smtp_secure,
              from_email, from_name, activo, test_enviado_en, actualizado_en
       FROM clinica_smtp_config
       WHERE clinica_id = ?`,
      [req.user.clinica_id]
    );

    if (rows.length === 0) {
      return res.json({ config: null });
    }

    res.json({ config: rows[0] });
  } catch (error) {
    console.error("Error al obtener config SMTP:", error);
    res.status(500).json({ error: "Error al obtener configuración SMTP" });
  }
});

// POST: Guardar/actualizar config SMTP
router.post("/config/smtp", auth(), async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_email, from_name, activo } = req.body;

    // Encriptar contraseña
    const encryptedPass = encrypt(smtp_pass);

    const [existing] = await db.query(
      "SELECT id FROM clinica_smtp_config WHERE clinica_id = ?",
      [req.user.clinica_id]
    );

    if (existing.length > 0) {
      // Update
      await db.query(
        `UPDATE clinica_smtp_config
         SET smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?,
             smtp_secure = ?, from_email = ?, from_name = ?, activo = ?
         WHERE clinica_id = ?`,
        [smtp_host, smtp_port, smtp_user, encryptedPass, smtp_secure, from_email, from_name, activo, req.user.clinica_id]
      );
    } else {
      // Insert
      await db.query(
        `INSERT INTO clinica_smtp_config
         (clinica_id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_email, from_name, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.clinica_id, smtp_host, smtp_port, smtp_user, encryptedPass, smtp_secure, from_email, from_name, activo]
      );
    }

    res.json({ success: true, message: "Configuración SMTP guardada" });
  } catch (error) {
    console.error("Error al guardar config SMTP:", error);
    res.status(500).json({ error: "Error al guardar configuración SMTP" });
  }
});

// POST: Enviar email de prueba
router.post("/config/smtp/test", auth(), async (req, res) => {
  try {
    const { email_destino } = req.body;

    // Obtener config SMTP
    const [smtpRows] = await db.query(
      "SELECT * FROM clinica_smtp_config WHERE clinica_id = ?",
      [req.user.clinica_id]
    );

    if (smtpRows.length === 0) {
      return res.status(400).json({ error: "No hay configuración SMTP guardada" });
    }

    const config = smtpRows[0];
    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure === 1,
      auth: {
        user: config.smtp_user,
        pass: decrypt(config.smtp_pass),
      },
    });

    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: email_destino,
      subject: "✅ Prueba de configuración SMTP",
      html: `
        <h2>¡Configuración exitosa!</h2>
        <p>Este es un correo de prueba desde tu sistema de clínica.</p>
        <p>El SMTP está configurado correctamente y listo para enviar recordatorios.</p>
        <hr>
        <small>Enviado desde: ${config.from_email}</small>
      `,
    });

    // Actualizar fecha de última prueba
    await db.query(
      "UPDATE clinica_smtp_config SET test_enviado_en = NOW() WHERE clinica_id = ?",
      [req.user.clinica_id]
    );

    res.json({ success: true, message: "Email de prueba enviado correctamente" });
  } catch (error) {
    console.error("Error al enviar email de prueba:", error);
    res.status(500).json({ error: "Error al enviar email: " + error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. CONFIGURACIÓN MENSAJERÍA (Twilio SMS/WhatsApp)
// ═══════════════════════════════════════════════════════════════

// GET: Obtener configs de mensajería
router.get("/config/mensajeria", auth(), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, servicio, account_sid, from_number, activo, test_enviado_en
       FROM clinica_mensajeria_config
       WHERE clinica_id = ?`,
      [req.user.clinica_id]
    );

    res.json({ configs: rows });
  } catch (error) {
    console.error("Error al obtener config mensajería:", error);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

// POST: Guardar config de mensajería
router.post("/config/mensajeria", auth(), async (req, res) => {
  try {
    const { servicio, account_sid, auth_token, from_number, activo } = req.body;

    const encryptedToken = encrypt(auth_token);

    const [existing] = await db.query(
      "SELECT id FROM clinica_mensajeria_config WHERE clinica_id = ? AND servicio = ?",
      [req.user.clinica_id, servicio]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE clinica_mensajeria_config
         SET account_sid = ?, auth_token = ?, from_number = ?, activo = ?
         WHERE clinica_id = ? AND servicio = ?`,
        [account_sid, encryptedToken, from_number, activo, req.user.clinica_id, servicio]
      );
    } else {
      await db.query(
        `INSERT INTO clinica_mensajeria_config
         (clinica_id, servicio, account_sid, auth_token, from_number, activo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.clinica_id, servicio, account_sid, encryptedToken, from_number, activo]
      );
    }

    res.json({ success: true, message: "Configuración guardada" });
  } catch (error) {
    console.error("Error al guardar config mensajería:", error);
    res.status(500).json({ error: "Error al guardar configuración" });
  }
});

// POST: Enviar mensaje de prueba (SMS o WhatsApp)
router.post("/config/mensajeria/test", auth(), async (req, res) => {
  try {
    const { servicio, telefono_destino } = req.body;

    const [configRows] = await db.query(
      "SELECT * FROM clinica_mensajeria_config WHERE clinica_id = ? AND servicio = ?",
      [req.user.clinica_id, servicio]
    );

    if (configRows.length === 0) {
      return res.status(400).json({ error: "No hay configuración guardada para este servicio" });
    }

    const config = configRows[0];
    const twilio = require("twilio");
    const client = twilio(config.account_sid, decrypt(config.auth_token));

    let messageTo = telefono_destino;
    let messageFrom = config.from_number;

    // Para WhatsApp, agregar prefijo 'whatsapp:'
    if (servicio === "TWILIO_WHATSAPP") {
      messageTo = `whatsapp:${telefono_destino}`;
      messageFrom = `whatsapp:${config.from_number}`;
    }

    const message = await client.messages.create({
      body: "✅ Prueba exitosa desde tu sistema de clínica. Configuración correcta.",
      from: messageFrom,
      to: messageTo,
    });

    await db.query(
      "UPDATE clinica_mensajeria_config SET test_enviado_en = NOW() WHERE clinica_id = ? AND servicio = ?",
      [req.user.clinica_id, servicio]
    );

    res.json({ success: true, message: "Mensaje de prueba enviado", sid: message.sid });
  } catch (error) {
    console.error("Error al enviar mensaje de prueba:", error);
    res.status(500).json({ error: "Error: " + error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. PLANTILLAS DE RECORDATORIOS
// ═══════════════════════════════════════════════════════════════

// GET: Listar plantillas
router.get("/plantillas", auth(), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM plantillas_recordatorio
       WHERE clinica_id = ?
       ORDER BY tipo, horas_antes`,
      [req.user.clinica_id]
    );

    res.json({ plantillas: rows });
  } catch (error) {
    console.error("Error al obtener plantillas:", error);
    res.status(500).json({ error: "Error al obtener plantillas" });
  }
});

// POST: Crear plantilla
router.post("/plantillas", auth(), async (req, res) => {
  try {
    const { tipo, nombre, horas_antes, asunto, contenido, activo, es_predeterminada } = req.body;

    const [result] = await db.query(
      `INSERT INTO plantillas_recordatorio
       (clinica_id, tipo, nombre, horas_antes, asunto, contenido, activo, es_predeterminada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.clinica_id, tipo, nombre, horas_antes, asunto, contenido, activo, es_predeterminada]
    );

    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error("Error al crear plantilla:", error);
    res.status(500).json({ error: "Error al crear plantilla" });
  }
});

// PUT: Actualizar plantilla
router.put("/plantillas/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, horas_antes, asunto, contenido, activo, es_predeterminada } = req.body;

    await db.query(
      `UPDATE plantillas_recordatorio
       SET nombre = ?, horas_antes = ?, asunto = ?, contenido = ?, activo = ?, es_predeterminada = ?
       WHERE id = ? AND clinica_id = ?`,
      [nombre, horas_antes, asunto, contenido, activo, es_predeterminada, id, req.user.clinica_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error al actualizar plantilla:", error);
    res.status(500).json({ error: "Error al actualizar plantilla" });
  }
});

// DELETE: Eliminar plantilla
router.delete("/plantillas/:id", auth(), async (req, res) => {
  try {
    await db.query(
      "DELETE FROM plantillas_recordatorio WHERE id = ? AND clinica_id = ?",
      [req.params.id, req.user.clinica_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar plantilla:", error);
    res.status(500).json({ error: "Error al eliminar plantilla" });
  }
});

// POST: Crear plantillas predeterminadas
router.post("/plantillas/crear-predeterminadas", auth(), async (req, res) => {
  try {
    const plantillas = [
      // EMAIL
      {
        tipo: "EMAIL",
        nombre: "Recordatorio 48h",
        horas_antes: 48,
        asunto: "Recordatorio: Cita en 2 días - {clinica}",
        contenido: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2196f3;">Recordatorio de Cita Médica</h2>
          <p>Estimado/a <strong>{paciente}</strong>,</p>
          <p>Le recordamos que tiene una cita médica programada en 2 días:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📅 Fecha:</strong> {fecha}</p>
            <p><strong>🕐 Hora:</strong> {hora}</p>
            <p><strong>👨‍⚕️ Doctor/a:</strong> {medico}</p>
            <p><strong>🏥 Clínica:</strong> {clinica}</p>
          </div>
          <p>Si necesita cancelar o reprogramar, por favor contáctenos lo antes posible.</p>
          <p>¡Le esperamos!</p>
        </div>`,
        es_predeterminada: 1,
      },
      {
        tipo: "EMAIL",
        nombre: "Recordatorio 24h",
        horas_antes: 24,
        asunto: "Recordatorio: Cita mañana - {clinica}",
        contenido: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2196f3;">Su cita es mañana</h2>
          <p>Estimado/a <strong>{paciente}</strong>,</p>
          <p>Le recordamos que tiene una cita médica mañana:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📅 Fecha:</strong> {fecha}</p>
            <p><strong>🕐 Hora:</strong> {hora}</p>
            <p><strong>👨‍⚕️ Doctor/a:</strong> {medico}</p>
          </div>
          <p>Por favor llegue 10 minutos antes.</p>
        </div>`,
        es_predeterminada: 1,
      },
      // WHATSAPP
      {
        tipo: "WHATSAPP",
        nombre: "WhatsApp 24h",
        horas_antes: 24,
        asunto: null,
        contenido: `🏥 *Recordatorio de Cita - {clinica}*

Hola {paciente} 👋

📅 Mañana tienes cita médica:
🕐 Hora: {hora}
👨‍⚕️ Doctor/a: {medico}

Por favor llega 10 minutos antes.

Si necesitas cancelar, contáctanos lo antes posible.

¡Te esperamos! 😊`,
        es_predeterminada: 1,
      },
      // SMS
      {
        tipo: "SMS",
        nombre: "SMS 24h",
        horas_antes: 24,
        asunto: null,
        contenido: "{clinica}: Recordatorio - Cita mañana {fecha} a las {hora} con Dr/a {medico}. Llegar 10 min antes.",
        es_predeterminada: 1,
      },
    ];

    for (const p of plantillas) {
      await db.query(
        `INSERT IGNORE INTO plantillas_recordatorio
         (clinica_id, tipo, nombre, horas_antes, asunto, contenido, activo, es_predeterminada)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [req.user.clinica_id, p.tipo, p.nombre, p.horas_antes, p.asunto, p.contenido, p.es_predeterminada]
      );
    }

    res.json({ success: true, message: "Plantillas predeterminadas creadas" });
  } catch (error) {
    console.error("Error al crear plantillas:", error);
    res.status(500).json({ error: "Error al crear plantillas" });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. CONFIGURACIÓN DE RECORDATORIOS AUTOMÁTICOS
// ═══════════════════════════════════════════════════════════════

// GET: Obtener config de recordatorios automáticos
router.get("/config/automatico", auth(), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM clinica_recordatorios_config WHERE clinica_id = ?",
      [req.user.clinica_id]
    );

    if (rows.length === 0) {
      // Crear config por defecto
      await db.query(
        `INSERT INTO clinica_recordatorios_config (clinica_id) VALUES (?)`,
        [req.user.clinica_id]
      );

      const [newRows] = await db.query(
        "SELECT * FROM clinica_recordatorios_config WHERE clinica_id = ?",
        [req.user.clinica_id]
      );
      return res.json({ config: newRows[0] });
    }

    res.json({ config: rows[0] });
  } catch (error) {
    console.error("Error al obtener config automático:", error);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

// PUT: Actualizar config de recordatorios automáticos
router.put("/config/automatico", auth(), async (req, res) => {
  try {
    const config = req.body;

    await db.query(
      `UPDATE clinica_recordatorios_config
       SET email_activo = ?, email_48h = ?, email_24h = ?, email_2h = ?,
           sms_activo = ?, sms_48h = ?, sms_24h = ?, sms_2h = ?,
           whatsapp_activo = ?, whatsapp_48h = ?, whatsapp_24h = ?, whatsapp_2h = ?,
           hora_ejecucion_diaria = ?
       WHERE clinica_id = ?`,
      [
        config.email_activo, config.email_48h, config.email_24h, config.email_2h,
        config.sms_activo, config.sms_48h, config.sms_24h, config.sms_2h,
        config.whatsapp_activo, config.whatsapp_48h, config.whatsapp_24h, config.whatsapp_2h,
        config.hora_ejecucion_diaria,
        req.user.clinica_id,
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error al actualizar config automático:", error);
    res.status(500).json({ error: "Error al actualizar configuración" });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. HISTORIAL DE RECORDATORIOS
// ═══════════════════════════════════════════════════════════════

// GET: Historial de recordatorios
router.get("/historial", auth(), async (req, res) => {
  try {
    const { limit = 100, tipo, estado } = req.query;

    let query = `
      SELECT hr.*, p.nombres as paciente_nombres, p.apellidos as paciente_apellidos,
             c.inicio as cita_fecha
      FROM historial_recordatorios hr
      LEFT JOIN pacientes p ON hr.paciente_id = p.id
      LEFT JOIN citas c ON hr.cita_id = c.id
      WHERE hr.clinica_id = ?
    `;

    const params = [req.user.clinica_id];

    if (tipo) {
      query += " AND hr.tipo = ?";
      params.push(tipo);
    }

    if (estado) {
      query += " AND hr.estado = ?";
      params.push(estado);
    }

    query += " ORDER BY hr.creado_en DESC LIMIT ?";
    params.push(parseInt(limit));

    const [rows] = await db.query(query, params);

    res.json({ historial: rows });
  } catch (error) {
    console.error("Error al obtener historial:", error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// GET: Estadísticas de recordatorios
router.get("/estadisticas", auth(), async (req, res) => {
  try {
    const [stats] = await db.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN estado = 'ENVIADO' THEN 1 ELSE 0 END) as enviados,
         SUM(CASE WHEN estado = 'FALLIDO' THEN 1 ELSE 0 END) as fallidos,
         SUM(CASE WHEN tipo = 'EMAIL' THEN 1 ELSE 0 END) as emails,
         SUM(CASE WHEN tipo = 'SMS' THEN 1 ELSE 0 END) as sms,
         SUM(CASE WHEN tipo = 'WHATSAPP' THEN 1 ELSE 0 END) as whatsapp
       FROM historial_recordatorios
       WHERE clinica_id = ?
         AND creado_en >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [req.user.clinica_id]
    );

    res.json({ estadisticas: stats[0] });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

module.exports = router;
