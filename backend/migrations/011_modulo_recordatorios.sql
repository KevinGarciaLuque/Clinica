-- ============================================================
--  Migración 011 — Módulo de Recordatorios (Email, WhatsApp, SMS)
--  Fecha: 2026-03-21
-- ============================================================

-- ── 1. Agregar módulo de recordatorios al sistema ────────────
INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, descripcion) VALUES
  ('recordatorios', 'Recordatorios', 'bi-bell-fill', '/recordatorios', 'Gestión de recordatorios automáticos por Email, WhatsApp y SMS');

-- Asignar a todos los tipos de clínica
INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
SELECT t.id, m.id
FROM tipos_clinica t
CROSS JOIN modulos_sistema m
WHERE m.clave = 'recordatorios';


-- ── 2. Ampliar tipos de recordatorio en cita_recordatorios ───
ALTER TABLE cita_recordatorios
  MODIFY COLUMN tipo ENUM(
    'EMAIL_48H', 'EMAIL_24H', 'EMAIL_2H',
    'SMS_48H', 'SMS_24H', 'SMS_2H',
    'WHATSAPP_48H', 'WHATSAPP_24H', 'WHATSAPP_2H',
    'PUSH'
  ) DEFAULT 'EMAIL_24H';

-- Agregar columnas adicionales
ALTER TABLE cita_recordatorios
  ADD COLUMN mensaje TEXT COMMENT 'Contenido del mensaje enviado' AFTER tipo,
  ADD COLUMN destinatario VARCHAR(150) COMMENT 'Email, teléfono o identificador del destinatario' AFTER mensaje,
  ADD COLUMN proveedor ENUM('SMTP', 'TWILIO_SMS', 'TWILIO_WHATSAPP', 'PUSH_NOTIFICATION') AFTER destinatario,
  ADD COLUMN response_id VARCHAR(150) COMMENT 'ID de respuesta del proveedor' AFTER proveedor,
  ADD COLUMN intentos TINYINT DEFAULT 0 AFTER error,
  ADD COLUMN programado_para DATETIME COMMENT 'Hora programada de envío' AFTER intentos;


-- ── 3. Configuración de SMTP por clínica ─────────────────────
CREATE TABLE IF NOT EXISTS clinica_smtp_config (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT UNSIGNED NOT NULL UNIQUE,
  smtp_host  VARCHAR(120) NOT NULL,
  smtp_port  INT NOT NULL DEFAULT 587,
  smtp_user  VARCHAR(150) NOT NULL,
  smtp_pass  VARCHAR(255) NOT NULL COMMENT 'Encriptado en la app',
  smtp_secure TINYINT(1) DEFAULT 0 COMMENT '1 para SSL (465), 0 para TLS (587)',
  from_email VARCHAR(150) NOT NULL,
  from_name  VARCHAR(100) DEFAULT 'Clínica',
  activo     TINYINT(1) DEFAULT 1,
  test_enviado_en DATETIME COMMENT 'Última prueba exitosa',
  creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ── 4. Configuración de servicios de mensajería (Twilio, etc) ─
CREATE TABLE IF NOT EXISTS clinica_mensajeria_config (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  servicio    ENUM('TWILIO_SMS', 'TWILIO_WHATSAPP', 'OTRO') NOT NULL,
  account_sid VARCHAR(100),
  auth_token  VARCHAR(255) COMMENT 'Encriptado',
  from_number VARCHAR(30) COMMENT 'Número de teléfono o WhatsApp del remitente',
  activo      TINYINT(1) DEFAULT 1,
  test_enviado_en DATETIME,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clinica_servicio (clinica_id, servicio),
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ── 5. Plantillas de recordatorios personalizables ───────────
CREATE TABLE IF NOT EXISTS plantillas_recordatorio (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  tipo        ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  horas_antes INT NOT NULL COMMENT 'Horas antes de la cita: 2, 24, 48',
  asunto      VARCHAR(200) COMMENT 'Solo para EMAIL',
  contenido   TEXT NOT NULL COMMENT 'Variables disponibles: {paciente}, {medico}, {fecha}, {hora}, {clinica}',
  activo      TINYINT(1) DEFAULT 1,
  es_predeterminada TINYINT(1) DEFAULT 0,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  KEY idx_tipo_activa (clinica_id, tipo, activo)
) ENGINE=InnoDB;


-- ── 6. Configuración de recordatorios automáticos por clínica ─
CREATE TABLE IF NOT EXISTS clinica_recordatorios_config (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL UNIQUE,
  
  -- Email
  email_activo  TINYINT(1) DEFAULT 0,
  email_48h     TINYINT(1) DEFAULT 0,
  email_24h     TINYINT(1) DEFAULT 1,
  email_2h      TINYINT(1) DEFAULT 0,
  
  -- SMS
  sms_activo    TINYINT(1) DEFAULT 0,
  sms_48h       TINYINT(1) DEFAULT 0,
  sms_24h       TINYINT(1) DEFAULT 1,
  sms_2h        TINYINT(1) DEFAULT 0,
  
  -- WhatsApp
  whatsapp_activo TINYINT(1) DEFAULT 0,
  whatsapp_48h    TINYINT(1) DEFAULT 0,
  whatsapp_24h    TINYINT(1) DEFAULT 1,
  whatsapp_2h     TINYINT(1) DEFAULT 0,
  
  -- Configuración del cron/scheduler
  hora_ejecucion_diaria TIME DEFAULT '08:00:00' COMMENT 'Hora de ejecución del proceso automático',
  
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ── 7. Historial de todos los recordatorios enviados ─────────
CREATE TABLE IF NOT EXISTS historial_recordatorios (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  cita_id     INT UNSIGNED,
  paciente_id INT UNSIGNED,
  tipo        ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL,
  destinatario VARCHAR(150) NOT NULL,
  asunto      VARCHAR(200),
  mensaje     TEXT NOT NULL,
  estado      ENUM('ENVIADO', 'FALLIDO', 'PENDIENTE') DEFAULT 'PENDIENTE',
  proveedor   VARCHAR(60),
  response_id VARCHAR(150),
  error       TEXT,
  enviado_en  DATETIME,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_historial_clinica (clinica_id, creado_en),
  KEY idx_historial_paciente (paciente_id),
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- ================================================================
--  SEEDS — Plantillas predeterminadas
-- ================================================================

-- Se insertarán dinámicamente cuando una clínica active el módulo,
-- pero aquí están los ejemplos:

/*
-- Email 24 horas antes
INSERT INTO plantillas_recordatorio (clinica_id, tipo, nombre, horas_antes, asunto, contenido, es_predeterminada) VALUES
(1, 'EMAIL', 'Recordatorio 24h', 24, 
 'Recordatorio: Cita médica mañana - {clinica}',
 '<p>Estimado/a {paciente},</p>
  <p>Le recordamos que tiene una cita médica programada para mañana:</p>
  <ul>
    <li><strong>Fecha:</strong> {fecha}</li>
    <li><strong>Hora:</strong> {hora}</li>
    <li><strong>Doctor/a:</strong> {medico}</li>
    <li><strong>Clínica:</strong> {clinica}</li>
  </ul>
  <p>Si necesita cancelar o reprogramar, por favor contáctenos lo antes posible.</p>
  <p>¡Le esperamos!</p>', 1);

-- WhatsApp 24 horas antes
INSERT INTO plantillas_recordatorio (clinica_id, tipo, nombre, horas_antes, contenido, es_predeterminada) VALUES
(1, 'WHATSAPP', 'Recordatorio WhatsApp 24h', 24,
 '🏥 *Recordatorio de Cita - {clinica}*

Hola {paciente},

📅 Mañana tienes cita médica:
🕐 Hora: {hora}
👨‍⚕️ Doctor/a: {medico}

Si necesitas cancelar, contáctanos.

¡Te esperamos! 😊', 1);

-- SMS 24 horas antes
INSERT INTO plantillas_recordatorio (clinica_id, tipo, nombre, horas_antes, contenido, es_predeterminada) VALUES
(1, 'SMS', 'Recordatorio SMS 24h', 24,
 '{clinica}: Recordatorio - Cita mañana {fecha} a las {hora} con Dr/a {medico}. Para cancelar, llamar al teléfono de la clínica.', 1);
*/
