-- MULTI-CLINICA Schema completo v1.0
-- Motor: MySQL 8+
-- Arquitectura: multi-tenant shared-schema (clinica_id en cada tabla)

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- MODULO 1: CLINICAS Y CONFIGURACION

CREATE TABLE IF NOT EXISTS clinicas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  slug          VARCHAR(80)  NOT NULL UNIQUE COMMENT 'Usado en subdominio: clinica1.tudominio.com',
  logo_url      VARCHAR(300),
  email         VARCHAR(120),
  telefono      VARCHAR(30),
  direccion     VARCHAR(250),
  ciudad        VARCHAR(100),
  pais          VARCHAR(60)  DEFAULT 'PE',
  ruc           VARCHAR(20)  COMMENT 'RUC / NIT / RFC según país',
  datos_fiscales JSON        COMMENT 'Nombre fiscal, dirección fiscal, etc.',
  activo        TINYINT(1)   DEFAULT 1,
  creado_en     DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinica_config (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT UNSIGNED NOT NULL,
  clave      VARCHAR(80)  NOT NULL COMMENT 'smtp_host, smtp_port, sms_key, slot_minutos, etc.',
  valor      TEXT,
  UNIQUE KEY uq_config (clinica_id, clave),
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- MODULO 1: USUARIOS (médicos, enfermeras, recepcionistas, admins)

CREATE TABLE IF NOT EXISTS especialidades (
  id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT IGNORE INTO especialidades (nombre) VALUES
  ('Medicina General'),('Pediatría'),('Ginecología'),
  ('Cardiología'),('Dermatología'),('Traumatología'),
  ('Neurología'),('Psiquiatría'),('Oftalmología'),
  ('Otorrinolaringología'),('Urología'),('Endocrinología'),
  ('Reumatología'),('Neumología'),('Radiología');

CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED COMMENT 'NULL = SUPER_ADMIN global',
  nombres       VARCHAR(100) NOT NULL,
  apellidos     VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  tipo          ENUM('SUPER_ADMIN','ADMIN','MEDICO','ENFERMERA','RECEPCIONISTA','PACIENTE_PORTAL')
                NOT NULL DEFAULT 'RECEPCIONISTA',
  especialidad_id INT UNSIGNED COMMENT 'Solo para MEDICO',
  firma_url     VARCHAR(300) COMMENT 'Imagen de firma para recetas',
  numero_colegiatura VARCHAR(50),
  telefono      VARCHAR(30),
  activo        TINYINT(1)   DEFAULT 1,
  ultimo_acceso DATETIME,
  creado_en     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_clinica (clinica_id, email),
  FOREIGN KEY (clinica_id)     REFERENCES clinicas(id)     ON DELETE CASCADE,
  FOREIGN KEY (especialidad_id) REFERENCES especialidades(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS horarios_medico (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medico_id   INT UNSIGNED NOT NULL,
  clinica_id  INT UNSIGNED NOT NULL,
  dia_semana  TINYINT NOT NULL COMMENT '0=Lun, 1=Mar, ..., 6=Dom',
  hora_inicio TIME NOT NULL,
  hora_fin    TIME NOT NULL,
  slot_minutos TINYINT DEFAULT 30 COMMENT 'Duración de cada turno en minutos',
  activo      TINYINT(1) DEFAULT 1,
  FOREIGN KEY (medico_id)  REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS servicios (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  categoria   VARCHAR(80) COMMENT 'consulta, procedimiento, examen, etc.',
  precio      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  moneda      CHAR(3)       DEFAULT 'PEN',
  duracion_min TINYINT      DEFAULT 30,
  activo      TINYINT(1)    DEFAULT 1,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plantillas_documentos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id  INT UNSIGNED NOT NULL,
  tipo        VARCHAR(60) COMMENT 'receta, consentimiento, informe, anamnesis_general, anamnesis_pediatria, etc.',
  nombre      VARCHAR(100) NOT NULL,
  contenido   LONGTEXT     COMMENT 'HTML/Handlebars con variables {{paciente}}, {{medico}}, etc.',
  activo      TINYINT(1)   DEFAULT 1,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- MODULO 2: PACIENTES

CREATE TABLE IF NOT EXISTS pacientes (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id       INT UNSIGNED NOT NULL,
  nombres          VARCHAR(100) NOT NULL,
  apellidos        VARCHAR(100) NOT NULL,
  dni              VARCHAR(20),
  fecha_nacimiento DATE,
  sexo             ENUM('M','F','OTRO'),
  telefono         VARCHAR(30),
  email            VARCHAR(120),
  direccion        VARCHAR(250),
  foto_perfil      VARCHAR(255),
  ciudad           VARCHAR(100),
  pais             VARCHAR(100)  DEFAULT 'Peru',
  portal_password_hash VARCHAR(255) COMMENT 'Si el paciente usa el portal web',
  portal_verificado    TINYINT(1)   DEFAULT 0,
  portal_token         VARCHAR(100) COMMENT 'Token de verificación email',
  portal_token_exp     DATETIME,
  grupo_sanguineo  VARCHAR(5),
  email_verificado TINYINT(1)   DEFAULT 0,
  registro_self    TINYINT(1)   DEFAULT 0,
  notas            TEXT,
  contacto_emergencia_nombre   VARCHAR(120),
  contacto_emergencia_telefono VARCHAR(30),
  activo           TINYINT(1)   DEFAULT 1,
  creado_en        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dni_clinica (clinica_id, dni),
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paciente_documentos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT UNSIGNED NOT NULL,
  clinica_id  INT UNSIGNED NOT NULL,
  tipo        VARCHAR(60) COMMENT 'dni, seguro_medico, otro',
  nombre      VARCHAR(150),
  url         VARCHAR(300) NOT NULL,
  subido_en   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paciente_consentimientos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT UNSIGNED NOT NULL,
  clinica_id  INT UNSIGNED NOT NULL,
  tipo        VARCHAR(80) COMMENT 'terminos_uso, tratamiento_datos, procedimiento_X',
  aceptado    TINYINT(1) DEFAULT 1,
  ip_origen   VARCHAR(45),
  aceptado_en DATETIME   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- MODULO 3: CITAS / AGENDAMIENTO

CREATE TABLE IF NOT EXISTS citas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  medico_id       INT UNSIGNED NOT NULL,
  servicio_id     INT UNSIGNED,
  inicio          DATETIME NOT NULL,
  fin             DATETIME NOT NULL,
  tipo_consulta   ENUM('PRIMERA_VEZ','CONTROL','EMERGENCIA','TELECONSULTA')
                  DEFAULT 'CONTROL',
  motivo          TEXT,
  estado          ENUM('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION','COMPLETADA','CANCELADA','NO_ASISTIO')
                  DEFAULT 'PENDIENTE',
  canal           ENUM('RECEPCION','PORTAL','IA','TELEFONO')
                  DEFAULT 'RECEPCION',
  notas_internas  TEXT,
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_citas_medico_inicio (clinica_id, medico_id, inicio),
  KEY idx_citas_paciente     (clinica_id, paciente_id),
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_id)   REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cita_recordatorios (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cita_id     INT UNSIGNED NOT NULL,
  tipo        ENUM('EMAIL_48H','SMS_24H','EMAIL_2H','PUSH') DEFAULT 'EMAIL_48H',
  enviado     TINYINT(1)   DEFAULT 0,
  enviado_en  DATETIME,
  error       TEXT COMMENT 'Mensaje de error si falló el envío',
  FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- MODULO 4: HISTORIA CLINICA ELECTRONICA (HCE) - SOAP

CREATE TABLE IF NOT EXISTS cie10 (
  codigo      VARCHAR(8) PRIMARY KEY,
  descripcion VARCHAR(250) NOT NULL,
  categoria   VARCHAR(100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historias_clinicas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  medico_id       INT UNSIGNED NOT NULL,
  cita_id         INT UNSIGNED,
  subjetivo       TEXT COMMENT 'Síntomas referidos por el paciente',
  objetivo        JSON COMMENT 'Signos vitales: {pa, fc, fr, temp, peso, talla, spo2}',
  examen_fisico   TEXT,
  diagnostico_cie VARCHAR(8)   COMMENT 'Código CIE-10 principal',
  diagnosticos_secundarios JSON COMMENT '[{cie, descripcion}]',
  plan            TEXT COMMENT 'Tratamiento, indicaciones, seguimiento',
  plantilla_id    INT UNSIGNED,
  estado          ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_hce_paciente (clinica_id, paciente_id),
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_id)   REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (cita_id)     REFERENCES citas(id)     ON DELETE SET NULL,
  FOREIGN KEY (plantilla_id) REFERENCES plantillas_documentos(id) ON DELETE SET NULL,
  FOREIGN KEY (diagnostico_cie) REFERENCES cie10(codigo) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS antecedentes_paciente (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  tipo            VARCHAR(80) COMMENT 'patologico, quirurgico, familiar, ginecobstetrico, habitos',
  descripcion     TEXT,
  activo          TINYINT(1) DEFAULT 1,
  registrado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alergias_paciente (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  agente          VARCHAR(150) NOT NULL COMMENT 'Penicilina, AINES, Mariscos, etc.',
  tipo            ENUM('MEDICAMENTO','ALIMENTO','AMBIENTAL','OTRO') DEFAULT 'MEDICAMENTO',
  severidad       ENUM('LEVE','MODERADA','SEVERA','MORTAL') DEFAULT 'MODERADA',
  reaccion        VARCHAR(250),
  activo          TINYINT(1) DEFAULT 1,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- MODULO 5: PRESCRIPCION DIGITAL

CREATE TABLE IF NOT EXISTS medicamentos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_generico VARCHAR(200) NOT NULL,
  nombre_comercial VARCHAR(200),
  presentacion    VARCHAR(150) COMMENT 'Tableta 500mg, Jarabe 250mg/5ml, etc.',
  via_administracion VARCHAR(60) COMMENT 'Oral, IV, IM, Tópico, etc.',
  contraindicaciones TEXT,
  activo          TINYINT(1) DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescripciones (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  historia_id     INT UNSIGNED,
  cita_id         INT UNSIGNED,
  paciente_id     INT UNSIGNED NOT NULL,
  medico_id       INT UNSIGNED NOT NULL,
  codigo_qr       VARCHAR(100) UNIQUE COMMENT 'Código único para verificación QR',
  pdf_url         VARCHAR(300),
  estado          ENUM('ACTIVA','ENTREGADA','CANCELADA') DEFAULT 'ACTIVA',
  notas           TEXT,
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE SET NULL,
  FOREIGN KEY (cita_id)     REFERENCES citas(id)     ON DELETE SET NULL,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_id)   REFERENCES usuarios(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescripcion_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prescripcion_id INT UNSIGNED NOT NULL,
  medicamento_id  INT UNSIGNED,
  medicamento_texto VARCHAR(200) COMMENT 'Si el médico escribe un nombre libre',
  dosis           VARCHAR(100) COMMENT 'Ej: 500mg c/8h',
  duracion        VARCHAR(80)  COMMENT 'Por 7 días',
  cantidad        VARCHAR(60)  COMMENT 'Qty para farmacia',
  instrucciones   TEXT,
  FOREIGN KEY (prescripcion_id) REFERENCES prescripciones(id) ON DELETE CASCADE,
  FOREIGN KEY (medicamento_id)  REFERENCES medicamentos(id)   ON DELETE SET NULL
) ENGINE=InnoDB;

-- MODULO 6: ESTUDIOS Y EXAMENES

CREATE TABLE IF NOT EXISTS estudios_solicitudes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  medico_id       INT UNSIGNED NOT NULL,
  historia_id     INT UNSIGNED,
  tipo            ENUM('LABORATORIO','IMAGENOLOGIA','OTRO') DEFAULT 'LABORATORIO',
  descripcion     TEXT COMMENT 'Estudios solicitados detallados',
  urgente         TINYINT(1) DEFAULT 0,
  estado          ENUM('SOLICITADO','EN_PROCESO','COMPLETADO','CANCELADO') DEFAULT 'SOLICITADO',
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_id)   REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (historia_id) REFERENCES historias_clinicas(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estudios_resultados (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  solicitud_id    INT UNSIGNED NOT NULL,
  clinica_id      INT UNSIGNED NOT NULL,
  nombre_examen   VARCHAR(150),
  valor_resultado TEXT,
  valor_referencia_min DECIMAL(10,4),
  valor_referencia_max DECIMAL(10,4),
  unidad          VARCHAR(30),
  anormal         TINYINT(1) DEFAULT 0,
  archivo_url     VARCHAR(300) COMMENT 'PDF o imagen del resultado',
  cargado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (solicitud_id) REFERENCES estudios_solicitudes(id) ON DELETE CASCADE,
  FOREIGN KEY (clinica_id)   REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- MODULO 7: VISUALIZADOR DE IMAGENES (metadatos)

CREATE TABLE IF NOT EXISTS imagenes_medicas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  solicitud_id    INT UNSIGNED,
  tipo            ENUM('DICOM','JPEG','PNG','PDF') DEFAULT 'JPEG',
  nombre          VARCHAR(150),
  url             VARCHAR(300) NOT NULL,
  descripcion     TEXT,
  informe         TEXT COMMENT 'Informe radiológico',
  fecha_estudio   DATE,
  subido_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (solicitud_id) REFERENCES estudios_solicitudes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- MODULO 8: FACTURACION

CREATE TABLE IF NOT EXISTS facturas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  cita_id         INT UNSIGNED,
  numero          VARCHAR(30) COMMENT 'F001-00001',
  tipo_comprobante ENUM('FACTURA','BOLETA','RECIBO') DEFAULT 'RECIBO',
  subtotal        DECIMAL(10,2) DEFAULT 0.00,
  impuestos       DECIMAL(10,2) DEFAULT 0.00,
  total           DECIMAL(10,2) DEFAULT 0.00,
  moneda          CHAR(3) DEFAULT 'PEN',
  estado          ENUM('PENDIENTE','PAGADA','ANULADA') DEFAULT 'PENDIENTE',
  pdf_url         VARCHAR(300),
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
  FOREIGN KEY (cita_id)     REFERENCES citas(id)     ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS factura_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  factura_id    INT UNSIGNED NOT NULL,
  descripcion   VARCHAR(200) NOT NULL,
  cantidad      DECIMAL(8,2) DEFAULT 1,
  precio_unit   DECIMAL(10,2) NOT NULL,
  total         DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL,
  factura_id    INT UNSIGNED NOT NULL,
  metodo        ENUM('EFECTIVO','TARJETA','TRANSFERENCIA','SEGURO','OTRO') DEFAULT 'EFECTIVO',
  monto         DECIMAL(10,2) NOT NULL,
  referencia    VARCHAR(100) COMMENT 'Nro. operación, voucher, etc.',
  registrado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- MODULO 9: COMUNICACION / MENSAJERIA INTERNA

CREATE TABLE IF NOT EXISTS mensajes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL,
  remitente_id  INT UNSIGNED NOT NULL,
  destinatario_id INT UNSIGNED NOT NULL,
  paciente_id   INT UNSIGNED COMMENT 'Contexto: relacionado a este paciente',
  asunto        VARCHAR(200),
  cuerpo        TEXT,
  leido         TINYINT(1) DEFAULT 0,
  leido_en      DATETIME,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id)       REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (remitente_id)     REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (destinatario_id)  REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (paciente_id)      REFERENCES pacientes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS encuestas_satisfaccion (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL,
  cita_id       INT UNSIGNED NOT NULL,
  paciente_id   INT UNSIGNED NOT NULL,
  puntuacion    TINYINT COMMENT '1 a 5',
  comentario    TEXT,
  enviada_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (cita_id)     REFERENCES citas(id)     ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- MODULO 11: SEGURIDAD / AUDITORIA

CREATE TABLE IF NOT EXISTS accesos_log (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED,
  usuario_id    INT UNSIGNED,
  accion        VARCHAR(100) COMMENT 'LOGIN, LOGOUT, VER_HISTORIA, EDITAR_RECETA, etc.',
  ip            VARCHAR(45),
  user_agent    VARCHAR(255),
  detalle       JSON,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_log_clinica (clinica_id, creado_en)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS backups_log (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED,
  tipo          ENUM('LOCAL','NUBE') DEFAULT 'LOCAL',
  archivo       VARCHAR(300),
  tamanio_bytes BIGINT,
  estado        ENUM('OK','ERROR') DEFAULT 'OK',
  error_msg     TEXT,
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- MODULO IA: Historial de conversaciones del asistente

CREATE TABLE IF NOT EXISTS ia_conversaciones (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT UNSIGNED NOT NULL,
  sesion_id       VARCHAR(100) NOT NULL COMMENT 'UUID de sesión de chat',
  paciente_id     INT UNSIGNED COMMENT 'Identificado durante la conversación',
  rol             ENUM('user','assistant','tool') NOT NULL,
  contenido       TEXT NOT NULL,
  tool_calls      JSON COMMENT 'Function calls de OpenAI',
  tool_result     JSON COMMENT 'Resultado devuelto a OpenAI',
  tokens_usados   INT DEFAULT 0,
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sesion (clinica_id, sesion_id),
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
