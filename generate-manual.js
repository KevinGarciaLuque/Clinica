/**
 * Generador del Manual de Usuario — Sistema Multi-Clínica
 * Ejecutar con: node generate-manual.js
 */

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, PageBreak, NumberFormat,
  LevelFormat, convertInchesToTwip, Header, Footer,
  PageNumber, Tab, Leader, HorizontalPositionRelativeFrom
} = require("docx");
const fs = require("fs");
const path = require("path");

// ─── ESTILOS DE COLOR ────────────────────────────────────────
const COLOR_AZUL   = "1A5F9E";
const COLOR_VERDE  = "2E8B57";
const COLOR_GRIS   = "F2F4F7";
const COLOR_OSCURO = "2C3E50";
const COLOR_BLANCO = "FFFFFF";

// ─── HELPERS ────────────────────────────────────────────────
function titulo(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [
      new TextRun({
        text: texto,
        color: COLOR_BLANCO,
        bold: true,
        size: 36,
      }),
    ],
    shading: { type: ShadingType.SOLID, color: COLOR_AZUL, fill: COLOR_AZUL },
    indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
  });
}

function subtitulo(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_AZUL } },
    children: [
      new TextRun({ text: texto, color: COLOR_AZUL, bold: true, size: 28 }),
    ],
  });
}

function h3(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({ text: texto, color: COLOR_VERDE, bold: true, size: 24 }),
    ],
  });
}

function parrafo(texto, opciones = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    children: [
      new TextRun({ text: texto, size: 22, color: COLOR_OSCURO, ...opciones }),
    ],
  });
}

function bullet(texto, nivel = 0) {
  return new Paragraph({
    bullet: { level: nivel },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text: texto, size: 22, color: COLOR_OSCURO })],
  });
}

function cuadroInfo(titulo_box, contenido) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: "EBF5FB", fill: "EBF5FB" },
            borders: {
              top:    { style: BorderStyle.SINGLE, size: 6, color: COLOR_AZUL },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: "AACBE8" },
              left:   { style: BorderStyle.SINGLE, size: 6, color: COLOR_AZUL },
              right:  { style: BorderStyle.SINGLE, size: 2, color: "AACBE8" },
            },
            children: [
              new Paragraph({
                spacing: { before: 80, after: 40 },
                children: [new TextRun({ text: `ℹ  ${titulo_box}`, bold: true, color: COLOR_AZUL, size: 22 })],
              }),
              ...contenido.map(c => new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: c, size: 21, color: COLOR_OSCURO })],
              })),
            ],
          }),
        ],
      }),
    ],
  });
}

function tablaSimple(encabezados, filas) {
  const headerRow = new TableRow({
    children: encabezados.map(h =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: COLOR_AZUL, fill: COLOR_AZUL },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: h, bold: true, color: COLOR_BLANCO, size: 20 })],
        })],
      })
    ),
  });
  const dataRows = filas.map(fila =>
    new TableRow({
      children: fila.map((celda, i) =>
        new TableCell({
          shading: { type: ShadingType.SOLID, color: i === 0 ? "F0F3F8" : COLOR_BLANCO, fill: i === 0 ? "F0F3F8" : COLOR_BLANCO },
          children: [new Paragraph({
            children: [new TextRun({ text: celda, size: 20, color: COLOR_OSCURO })],
          })],
        })
      ),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function salto() {
  return new Paragraph({ children: [new PageBreak()] });
}

function espaciado() {
  return new Paragraph({ spacing: { before: 160, after: 160 }, children: [new TextRun("")] });
}

// ─── CONSTRUCCIÓN DEL DOCUMENTO ─────────────────────────────
const doc = new Document({
  creator: "Sistema Multi-Clínica",
  title: "Manual de Usuario — Sistema Multi-Clínica",
  description: "Guía completa de uso del sistema de gestión clínica multi-tenant",
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22, color: COLOR_OSCURO },
        paragraph: { spacing: { line: 276 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1.2),
            right:  convertInchesToTwip(1.2),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_AZUL } },
              children: [
                new TextRun({ text: "Sistema Multi-Clínica  —  Manual de Usuario", size: 18, color: "888888" }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_AZUL } },
              children: [
                new TextRun({ text: "Página ", size: 18, color: "888888" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR_AZUL }),
                new TextRun({ text: " de ", size: 18, color: "888888" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLOR_AZUL }),
                new TextRun({ text: "     |     Versión 1.0 — 2026", size: 18, color: "888888" }),
              ],
            }),
          ],
        }),
      },
      children: [

        // ══════════════════════════════════════════════════════
        // PORTADA
        // ══════════════════════════════════════════════════════
        new Paragraph({ spacing: { before: 1440 }, children: [new TextRun("")] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { type: ShadingType.SOLID, color: COLOR_AZUL, fill: COLOR_AZUL },
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({ text: "SISTEMA MULTI-CLÍNICA", color: COLOR_BLANCO, bold: true, size: 60, allCaps: true }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          shading: { type: ShadingType.SOLID, color: COLOR_VERDE, fill: COLOR_VERDE },
          children: [
            new TextRun({ text: "Manual de Usuario Completo", color: COLOR_BLANCO, size: 36, italics: true }),
          ],
        }),
        espaciado(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Plataforma de Gestión Clínica Multi-Tenant", size: 26, color: "555555" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80 },
          children: [new TextRun({ text: "Versión 1.0  ·  Febrero 2026", size: 22, color: "888888" })],
        }),
        espaciado(),
        espaciado(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_AZUL }, bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_AZUL } },
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({ text: "Stack tecnológico: Node.js · React · MySQL · OpenAI GPT-4o · JWT", size: 20, color: "666666" }),
          ],
        }),
        salto(),

        // ══════════════════════════════════════════════════════
        // ÍNDICE
        // ══════════════════════════════════════════════════════
        titulo("Índice de Contenidos"),
        espaciado(),
        ...[
          ["1.",  "Introducción al sistema", "3"],
          ["2.",  "Acceso y autenticación", "4"],
          ["3.",  "Tipos de usuario y permisos", "5"],
          ["4.",  "Panel Super-Administrador", "6"],
          ["5.",  "Panel Administrador de Clínica", "7"],
          ["6.",  "Gestión de Pacientes", "9"],
          ["7.",  "Agendamiento de Citas", "11"],
          ["8.",  "Historia Clínica Electrónica (HCE)", "13"],
          ["9.",  "Prescripción Digital", "15"],
          ["10.", "Facturación", "17"],
          ["11.", "Asistente de Inteligencia Artificial", "18"],
          ["12.", "Recordatorios Automáticos", "20"],
          ["13.", "Estudios e Imágenes", "21"],
          ["14.", "Seguridad y buenas prácticas", "22"],
          ["15.", "Preguntas frecuentes (FAQ)", "23"],
        ].map(([num, cap, pag]) =>
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({ text: `${num}  ${cap}`, size: 22, color: COLOR_OSCURO }),
            ],
          })
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 1. INTRODUCCIÓN
        // ══════════════════════════════════════════════════════
        titulo("1. Introducción al Sistema"),
        espaciado(),
        parrafo(
          "El Sistema Multi-Clínica es una plataforma web de gestión médica multi-tenant diseñada para administrar " +
          "una o varias clínicas desde un único entorno. Permite gestionar pacientes, citas, historias clínicas " +
          "electrónicas, prescripciones digitales, facturación, estudios y contar con un asistente de inteligencia " +
          "artificial integrado."
        ),
        espaciado(),
        subtitulo("1.1 Arquitectura general"),
        tablaSimple(
          ["Capa", "Tecnología", "Función"],
          [
            ["Backend",       "Node.js + Express",    "API REST, lógica de negocio"],
            ["Base de datos", "MySQL 8+",              "Persistencia multi-tenant"],
            ["Autenticación", "JWT + Argon2",          "Sesiones seguras"],
            ["Inteligencia Artificial", "OpenAI GPT-4o", "Asistente conversacional"],
            ["Email",         "Nodemailer + SMTP",     "Recordatorios, verificación"],
            ["Frontend",      "React + Vite + Bootstrap 5", "Interfaz de usuario"],
          ]
        ),
        espaciado(),
        subtitulo("1.2 Concepto Multi-Tenant"),
        parrafo(
          "Cada clínica registrada en la plataforma tiene sus propios datos completamente aislados. " +
          "El campo clinica_id en cada tabla garantiza que ninguna clínica pueda ver los datos de otra. " +
          "El Super-Administrador es el único con acceso global a todas las clínicas."
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 2. ACCESO Y AUTENTICACIÓN
        // ══════════════════════════════════════════════════════
        titulo("2. Acceso y Autenticación"),
        espaciado(),
        subtitulo("2.1 Inicio de sesión"),
        parrafo("Para ingresar al sistema siga los siguientes pasos:"),
        bullet("Abra su navegador y acceda a la URL de la plataforma."),
        bullet("Ingrese su correo electrónico y contraseña en el formulario de login."),
        bullet("Haga clic en el botón «Iniciar sesión»."),
        bullet("El sistema le redirigirá automáticamente al panel correspondiente a su rol."),
        espaciado(),
        cuadroInfo("Nota de seguridad", [
          "Las contraseñas se almacenan con cifrado Argon2id. Nunca se guardan en texto plano.",
          "El token JWT tiene una duración limitada. Si su sesión expira, deberá volver a iniciar sesión.",
          "No comparta sus credenciales con otras personas.",
        ]),
        espaciado(),
        subtitulo("2.2 Recuperación de contraseña"),
        parrafo(
          "Si olvidó su contraseña, contacte al administrador de su clínica para que restablezca sus credenciales " +
          "desde el módulo de gestión de usuarios."
        ),
        subtitulo("2.3 Verificación de email (pacientes portal)"),
        parrafo(
          "Los pacientes que se registran desde el portal público deben verificar su correo electrónico. " +
          "Recibirán un enlace de verificación con vigencia limitada. Sin verificar el email no podrán " +
          "acceder al portal de autoservicio."
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 3. TIPOS DE USUARIO
        // ══════════════════════════════════════════════════════
        titulo("3. Tipos de Usuario y Permisos"),
        espaciado(),
        parrafo("El sistema cuenta con los siguientes roles jerárquicos:"),
        espaciado(),
        tablaSimple(
          ["Rol", "Alcance", "Capacidades principales"],
          [
            ["SUPER_ADMIN",     "Global (todas las clínicas)", "Crear/gestionar clínicas, ver estadísticas globales"],
            ["ADMIN",           "Una clínica",                 "Gestionar usuarios, servicios, horarios, configuración de la clínica"],
            ["MÉDICO",          "Una clínica",                 "Ver agenda, atender consultas, crear HCE, prescribir"],
            ["RECEPCIONISTA",   "Una clínica",                 "Registrar pacientes, agendar citas, sala de espera"],
            ["ENFERMERA",       "Una clínica",                 "Tomar signos vitales, asistir en consultas"],
            ["PACIENTE PORTAL", "Solo sus datos",              "Ver citas, descargar recetas, subir documentos"],
          ]
        ),
        espaciado(),
        cuadroInfo("Importante", [
          "Cada usuario solo puede ver los datos de la clínica a la que pertenece.",
          "El SUPER_ADMIN no tiene clinica_id asignado ya que tiene acceso global.",
          "Los roles se asignan al crear el usuario y solo el ADMIN o SUPER_ADMIN pueden modificarlos.",
        ]),
        salto(),

        // ══════════════════════════════════════════════════════
        // 4. SUPER-ADMINISTRADOR
        // ══════════════════════════════════════════════════════
        titulo("4. Panel Super-Administrador"),
        espaciado(),
        parrafo(
          "El Super-Administrador tiene acceso a la gestión completa de la plataforma. " +
          "Su panel es diferente al de los demás usuarios."
        ),
        subtitulo("4.1 Gestión de clínicas"),
        parrafo("Desde Clínicas puede:"),
        bullet("Crear una nueva clínica ingresando nombre, slug (subdominio), dirección, teléfono, email y RUC/NIT."),
        bullet("Editar los datos de una clínica existente."),
        bullet("Activar o desactivar una clínica (desactivarla impide el acceso de sus usuarios)."),
        bullet("Ver el listado completo de clínicas registradas con su estado."),
        espaciado(),
        h3("Campos del formulario de clínica"),
        tablaSimple(
          ["Campo", "Descripción", "Obligatorio"],
          [
            ["Nombre",       "Nombre comercial de la clínica",            "Sí"],
            ["Slug",         "Identificador único para subdominios",       "Sí"],
            ["Email",        "Correo de contacto principal",              "No"],
            ["Teléfono",     "Número de contacto",                        "No"],
            ["Dirección",    "Dirección física",                          "No"],
            ["RUC / NIT",    "Número fiscal según el país",               "No"],
            ["Logo URL",     "URL de la imagen del logo",                 "No"],
          ]
        ),
        espaciado(),
        subtitulo("4.2 Estadísticas globales"),
        parrafo(
          "El dashboard del Super-Administrador muestra estadísticas agregadas: total de clínicas, " +
          "total de pacientes registrados en la plataforma, citas del día y alertas del sistema."
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 5. ADMINISTRADOR DE CLÍNICA
        // ══════════════════════════════════════════════════════
        titulo("5. Panel Administrador de Clínica"),
        espaciado(),
        subtitulo("5.1 Gestión de usuarios"),
        parrafo("El Administrador puede crear y gestionar todos los usuarios de su clínica:"),
        bullet("Ir a Administración → Usuarios."),
        bullet("Hacer clic en «Nuevo Usuario»."),
        bullet("Completar: nombres, apellidos, email, contraseña inicial, rol, y —si es médico— especialidad y número de colegiatura."),
        bullet("Guardar. El usuario recibirá sus credenciales por email."),
        espaciado(),
        cuadroInfo("Gestión de médicos", [
          "Para los usuarios con rol MÉDICO se habilitarán campos adicionales:",
          "• Especialidad (seleccionar del catálogo)",
          "• Número de colegiatura",
          "• Firma digital (imagen PNG para recetas)",
          "• Horarios de atención (configurados en el módulo Horarios)",
        ]),
        espaciado(),
        subtitulo("5.2 Configuración de horarios"),
        parrafo("Para configurar los horarios de un médico:"),
        bullet("Ir a Administración → Horarios."),
        bullet("Seleccionar el médico de la lista."),
        bullet("Para cada día de la semana defina: hora de inicio, hora de fin y duración del slot en minutos."),
        bullet("Activar o desactivar cada día según corresponda."),
        bullet("Guardar cambios."),
        espaciado(),
        subtitulo("5.3 Catálogo de servicios"),
        parrafo("Los servicios son los tipos de atención que ofrece la clínica con sus precios:"),
        bullet("Ir a Administración → Servicios."),
        bullet("Crear servicio con: nombre, categoría (consulta, procedimiento, examen), precio, moneda y duración estimada."),
        bullet("Los servicios activos estarán disponibles al agendar citas."),
        espaciado(),
        subtitulo("5.4 Configuración de la clínica"),
        parrafo(
          "Desde Configuración Clínica puede personalizar: datos fiscales, configuración SMTP para emails, " +
          "plantillas de documentos (recetas, consentimientos, informes) y otras opciones avanzadas."
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 6. GESTIÓN DE PACIENTES
        // ══════════════════════════════════════════════════════
        titulo("6. Gestión de Pacientes"),
        espaciado(),
        subtitulo("6.1 Registrar un nuevo paciente"),
        parrafo("Ir a Pacientes → Nuevo Paciente y completar el formulario:"),
        espaciado(),
        tablaSimple(
          ["Campo", "Descripción"],
          [
            ["Nombres y apellidos", "Nombre completo del paciente"],
            ["DNI / Documento",    "Número de documento de identidad"],
            ["Fecha de nacimiento","Fecha en formato DD/MM/AAAA"],
            ["Sexo",               "Masculino, Femenino u Otro"],
            ["Teléfono",           "Número de contacto"],
            ["Email",              "Correo electrónico (para recordatorios)"],
            ["Dirección",          "Dirección de residencia"],
            ["Grupo sanguíneo",    "Tipo de sangre"],
            ["Contacto emergencia","Nombre y teléfono de contacto de emergencia"],
            ["Notas",              "Observaciones adicionales"],
          ]
        ),
        espaciado(),
        subtitulo("6.2 Buscar pacientes"),
        parrafo(
          "Use la barra de búsqueda en la parte superior del listado de pacientes. " +
          "Puede buscar por nombre, apellido o número de documento. " +
          "Los resultados se filtran en tiempo real."
        ),
        subtitulo("6.3 Perfil del paciente"),
        parrafo("Al hacer clic en un paciente accede a su perfil completo, que incluye:"),
        bullet("Datos personales y de contacto."),
        bullet("Historial de citas (pasadas y futuras)."),
        bullet("Historia clínica electrónica."),
        bullet("Alergias y antecedentes."),
        bullet("Documentos adjuntos (DNI, seguro médico, etc.)."),
        bullet("Consentimientos firmados."),
        bullet("Prescripciones emitidas."),
        espaciado(),
        subtitulo("6.4 Registro de auto-servicio (portal)"),
        parrafo(
          "Los pacientes pueden registrarse ellos mismos desde el portal público. " +
          "Deben verificar su correo electrónico antes de poder acceder. " +
          "El personal de recepción puede completar los datos médicos posteriormente."
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 7. AGENDAMIENTO DE CITAS
        // ══════════════════════════════════════════════════════
        titulo("7. Agendamiento de Citas"),
        espaciado(),
        subtitulo("7.1 Crear una cita"),
        parrafo("Existen varias formas de crear una cita:"),
        bullet("Desde Citas → Nueva Cita (formulario completo)."),
        bullet("Desde el perfil del paciente, haciendo clic en «Agendar Cita»."),
        bullet("Mediante el Asistente de IA (chat conversacional)."),
        bullet("El paciente mismo desde el portal web."),
        espaciado(),
        h3("Pasos para agendar desde el formulario:"),
        bullet("Seleccionar el médico de la lista."),
        bullet("Elegir el servicio a brindar."),
        bullet("Seleccionar la fecha. El sistema mostrará los horarios disponibles según la agenda del médico."),
        bullet("Elegir el slot horario disponible."),
        bullet("Buscar y seleccionar el paciente (o crear uno nuevo)."),
        bullet("Indicar el tipo de consulta: Primera vez, Control, Emergencia o Teleconsulta."),
        bullet("Ingresar el motivo de la consulta (opcional)."),
        bullet("Confirmar la cita."),
        espaciado(),
        subtitulo("7.2 Estados de una cita"),
        tablaSimple(
          ["Estado", "Descripción"],
          [
            ["PENDIENTE",    "Cita creada, esperando confirmación"],
            ["CONFIRMADA",   "Cita confirmada por el paciente o recepción"],
            ["EN ESPERA",    "Paciente llegó y está en sala de espera"],
            ["EN ATENCIÓN",  "Médico está atendiendo al paciente"],
            ["COMPLETADA",   "Consulta finalizada"],
            ["CANCELADA",    "Cita cancelada antes de realizarse"],
            ["NO ASISTIÓ",   "El paciente no se presentó"],
          ]
        ),
        espaciado(),
        subtitulo("7.3 Canales de origen"),
        parrafo("El sistema registra el canal por el que se creó la cita:"),
        bullet("RECEPCION — Creada por el personal desde el sistema."),
        bullet("PORTAL — Creada por el paciente desde el portal web."),
        bullet("IA — Creada a través del asistente de inteligencia artificial."),
        bullet("TELEFONO — Registrada tras una llamada telefónica."),
        espaciado(),
        subtitulo("7.4 Calendario de citas"),
        parrafo(
          "La vista de calendario permite ver todas las citas en formato semanal o mensual por médico. " +
          "Se pueden aplicar filtros por médico y especialidad. Al hacer clic en una cita se pueden " +
          "ver sus detalles, cambiar su estado o editarla."
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 8. HISTORIA CLÍNICA ELECTRÓNICA
        // ══════════════════════════════════════════════════════
        titulo("8. Historia Clínica Electrónica (HCE)"),
        espaciado(),
        parrafo(
          "La Historia Clínica Electrónica utiliza la metodología SOAP (Subjetivo, Objetivo, " +
          "Análisis/Diagnóstico, Plan) para registrar cada consulta médica de forma estructurada."
        ),
        espaciado(),
        subtitulo("8.1 Estructura SOAP"),
        tablaSimple(
          ["Sección", "Contenido"],
          [
            ["S — Subjetivo",  "Síntomas y motivo de consulta referidos por el paciente"],
            ["O — Objetivo",   "Signos vitales (PA, FC, FR, Temperatura, Peso, Talla, SpO₂) y examen físico"],
            ["A — Análisis",   "Diagnóstico principal CIE-10 y diagnósticos secundarios"],
            ["P — Plan",       "Tratamiento, indicaciones, medicamentos, seguimiento y referencias"],
          ]
        ),
        espaciado(),
        subtitulo("8.2 Crear una entrada en la HCE"),
        bullet("Abrir el perfil del paciente → Historia Clínica."),
        bullet("Hacer clic en «Nueva Consulta» o abrir la cita en curso."),
        bullet("Completar los cuatro bloques SOAP."),
        bullet("Para el diagnóstico, escribir el nombre o código y el sistema buscará en el catálogo CIE-10."),
        bullet("Escoger estado «BORRADOR» para seguir editando o «FIRMADA» para cerrarla definitivamente."),
        bullet("Guardar."),
        espaciado(),
        cuadroInfo("Importante", [
          "Una historia con estado FIRMADA no puede editarse.",
          "Solo el médico que la creó puede firmarla.",
          "El catálogo CIE-10 incluye miles de códigos diagnósticos internacionales.",
        ]),
        espaciado(),
        subtitulo("8.3 Antecedentes y alergias"),
        parrafo("En el perfil del paciente puede registrar:"),
        bullet("Antecedentes patológicos, quirúrgicos, familiares, gineco-obstétricos y de hábitos."),
        bullet("Alergias a medicamentos, alimentos o agentes ambientales con su nivel de severidad."),
        parrafo("Esta información está siempre visible al médico durante la consulta para una atención más segura."),
        salto(),

        // ══════════════════════════════════════════════════════
        // 9. PRESCRIPCIÓN DIGITAL
        // ══════════════════════════════════════════════════════
        titulo("9. Prescripción Digital"),
        espaciado(),
        parrafo(
          "El módulo de prescripción permite al médico emitir recetas digitales que se generan como PDF " +
          "con el logo de la clínica, firma del médico y código QR de verificación."
        ),
        subtitulo("9.1 Crear una prescripción"),
        bullet("Desde la consulta activa o el perfil del paciente → Prescripciones → Nueva."),
        bullet("Buscar el medicamento en el catálogo o ingresar manualmente."),
        bullet("Especificar: dosis, frecuencia, vía de administración, duración del tratamiento e indicaciones."),
        bullet("Agregar tantos medicamentos como sea necesario."),
        bullet("Agregar indicaciones generales (dieta, actividad física, etc.)."),
        bullet("Emitir la receta. Se genera el PDF automáticamente."),
        espaciado(),
        subtitulo("9.2 Información en la receta"),
        tablaSimple(
          ["Elemento", "Descripción"],
          [
            ["Encabezado",       "Logo y datos de la clínica"],
            ["Médico",           "Nombre completo, especialidad y nummer de colegiatura"],
            ["Paciente",         "Nombre, edad, diagnóstico asociado"],
            ["Medicamentos",     "Lista con dosis, frecuencia y duración"],
            ["Indicaciones",     "Notas y recomendaciones generales"],
            ["Firma",            "Firma digital del médico"],
            ["QR",               "Código de verificación de autenticidad de la receta"],
            ["Fecha",            "Fecha y hora de emisión"],
          ]
        ),
        espaciado(),
        subtitulo("9.3 Descarga y verificación"),
        parrafo(
          "El paciente puede descargar su receta en PDF desde el portal de pacientes. " +
          "Farmacias o terceros pueden escanear el código QR para verificar la autenticidad de la receta."
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 10. FACTURACIÓN
        // ══════════════════════════════════════════════════════
        titulo("10. Facturación"),
        espaciado(),
        parrafo(
          "El módulo de facturación genera comprobantes al completar una cita y lleva el registro " +
          "de todos los pagos recibidos."
        ),
        subtitulo("10.1 Generar una factura"),
        bullet("Al marcar una cita como COMPLETADA, el sistema solicita confirmar el pago."),
        bullet("Seleccionar el método de pago: efectivo, tarjeta, transferencia u otro."),
        bullet("El sistema genera la factura automáticamente con los datos fiscales de la clínica."),
        bullet("Se puede descargar el PDF de la factura o enviarla por email al paciente."),
        espaciado(),
        subtitulo("10.2 Reportes de ingresos"),
        parrafo("Desde el dashboard administrativo podrá ver:"),
        bullet("Ingresos del día / semana / mes."),
        bullet("Desglose por servicio o médico."),
        bullet("Facturas pendientes de cobro."),
        salto(),

        // ══════════════════════════════════════════════════════
        // 11. ASISTENTE DE IA
        // ══════════════════════════════════════════════════════
        titulo("11. Asistente de Inteligencia Artificial"),
        espaciado(),
        parrafo(
          "El sistema incluye un asistente conversacional impulsado por OpenAI GPT-4o que puede " +
          "gestionar citas, responder consultas sobre disponibilidad y ayudar al personal con tareas frecuentes."
        ),
        subtitulo("11.1 Cómo usar el asistente"),
        parrafo("El chat de IA está disponible en el menú lateral. Puede escribir en lenguaje natural:"),
        bullet("«¿Qué citas tiene el Dr. García mañana?»"),
        bullet("«Agenda una cita con el Dr. Pérez para Juan López el jueves por la mañana.»"),
        bullet("«¿Hay disponibilidad de cardiología esta semana?»"),
        bullet("«Cancela la cita número 145.»"),
        espaciado(),
        subtitulo("11.2 Flujo interno"),
        h3("¿Cómo funciona por detrás?"),
        parrafo("Cuando escribe un mensaje, el sistema sigue este proceso:"),
        bullet("El mensaje se envía a GPT-4o junto con un contexto del sistema y los datos de la clínica."),
        bullet("El modelo identifica la acción necesaria (buscar médico, verificar disponibilidad, crear cita)."),
        bullet("El backend ejecuta las consultas a la base de datos."),
        bullet("Los resultados se devuelven al modelo para formular una respuesta clara."),
        bullet("Si el usuario confirma, se ejecuta la acción definitiva (ej.: guardar la cita)."),
        espaciado(),
        cuadroInfo("Seguridad del asistente de IA", [
          "El asistente solo puede acceder a datos de la clínica autenticada.",
          "No puede ver datos de otras clínicas.",
          "Todo el historial de conversaciones queda guardado para auditoría.",
          "El asistente no puede eliminar historias clínicas ni facturas.",
        ]),
        salto(),

        // ══════════════════════════════════════════════════════
        // 12. RECORDATORIOS AUTOMÁTICOS
        // ══════════════════════════════════════════════════════
        titulo("12. Recordatorios Automáticos"),
        espaciado(),
        parrafo(
          "El sistema envía recordatorios por email de forma automática a los pacientes " +
          "antes de sus citas programadas."
        ),
        tablaSimple(
          ["Tipo", "Cuándo se envía", "Canal"],
          [
            ["EMAIL_48H", "48 horas antes de la cita", "Email"],
            ["EMAIL_2H",  "2 horas antes de la cita",  "Email"],
            ["SMS_24H",   "24 horas antes (opcional)", "SMS (Twilio)"],
          ]
        ),
        espaciado(),
        parrafo(
          "Los recordatorios se activan mediante una tarea automática que revisa la agenda cada hora. " +
          "Si un envío falla, el error queda registrado para revisión."
        ),
        subtitulo("Configuración SMTP"),
        parrafo(
          "Para que los emails funcionen, el Administrador debe configurar el servidor SMTP de la clínica " +
          "en Configuración Clínica → Ajustes de Email (host, puerto, usuario y contraseña del servidor de correo)."
        ),
        salto(),

        // ══════════════════════════════════════════════════════
        // 13. ESTUDIOS E IMÁGENES
        // ══════════════════════════════════════════════════════
        titulo("13. Estudios e Imágenes"),
        espaciado(),
        parrafo(
          "El módulo de estudios permite solicitar exámenes de laboratorio o imagenología, " +
          "registrar los resultados y vincularlos al historial del paciente."
        ),
        subtitulo("13.1 Solicitar un estudio"),
        bullet("Desde la consulta activa → Solicitar Estudio."),
        bullet("Seleccionar el tipo: laboratorio, radiografía, ecografía, tomografía, etc."),
        bullet("Escribir las indicaciones para el laboratorio o técnico."),
        bullet("Guardar la solicitud (queda en estado PENDIENTE)."),
        espaciado(),
        subtitulo("13.2 Registrar resultados"),
        bullet("Una vez disponibles, el personal técnico sube el archivo PDF o imagen del resultado."),
        bullet("El resultado queda vinculado al paciente y a la consulta."),
        bullet("El médico recibe una notificación para revisar los resultados."),
        bullet("Si hay valores fuera de rango, el sistema genera una alerta."),
        salto(),

        // ══════════════════════════════════════════════════════
        // 14. SEGURIDAD
        // ══════════════════════════════════════════════════════
        titulo("14. Seguridad y Buenas Prácticas"),
        espaciado(),
        subtitulo("14.1 Medidas de seguridad implementadas"),
        tablaSimple(
          ["Medida", "Descripción"],
          [
            ["Contraseñas cifradas",      "Argon2id — el algoritmo más seguro para contraseñas"],
            ["Tokens JWT",                "Sesiones sin estado con expiración automática"],
            ["Aislamiento multi-tenant",  "Cada clínica solo accede a sus propios datos"],
            ["HTTPS",                     "Todas las comunicaciones deben usar SSL/TLS"],
            ["Registro de accesos",       "Log de cada inicio de sesión con IP y timestamp"],
            ["Validación de entradas",    "Todas las entradas del usuario se validan en el backend"],
          ]
        ),
        espaciado(),
        subtitulo("14.2 Recomendaciones para usuarios"),
        bullet("Use contraseñas de al menos 12 caracteres combinando letras, números y símbolos."),
        bullet("No comparta sus credenciales de acceso con otras personas."),
        bullet("Cierre sesión al terminar de usar el sistema, especialmente en equipos compartidos."),
        bullet("No acceda al sistema desde redes WiFi públicas sin VPN."),
        bullet("Reporte inmediatamente cualquier acceso sospechoso al administrador."),
        salto(),

        // ══════════════════════════════════════════════════════
        // 15. FAQ
        // ══════════════════════════════════════════════════════
        titulo("15. Preguntas Frecuentes (FAQ)"),
        espaciado(),
        h3("¿Puedo tener varios médicos en la misma clínica?"),
        parrafo("Sí. Puede crear tantos usuarios con rol MÉDICO como necesite. Cada uno tendrá su propia agenda y especialidad."),
        espaciado(),
        h3("¿Se pueden configurar diferentes duraciones de cita por médico?"),
        parrafo("Sí. En el módulo de Horarios puede definir la duración del slot (15, 20, 30, 45 o 60 minutos) independientemente para cada médico y día."),
        espaciado(),
        h3("¿Qué pasa si dos citas se solapan?"),
        parrafo("El sistema valida la disponibilidad antes de confirmar una cita. Si el horario ya está ocupado, no permitirá el agendamiento y mostrará los horarios disponibles."),
        espaciado(),
        h3("¿Los pacientes pueden ver sus historia clínica?"),
        parrafo("Los pacientes con acceso al portal pueden ver un resumen de sus diagnósticos, recetas y resultados, pero no el texto completo de las notas clínicas del médico."),
        espaciado(),
        h3("¿Cómo se hace backup de los datos?"),
        parrafo("El sistema puede configurarse para hacer copias de seguridad automáticas diarias de la base de datos. Consulte a su administrador técnico para activar esta función."),
        espaciado(),
        h3("¿El sistema funciona en dispositivos móviles?"),
        parrafo("La interfaz está desarrollada con Bootstrap 5 y es completamente responsiva. Funciona en navegadores móviles modernos sin necesidad de instalar ninguna aplicación."),
        espaciado(),
        h3("¿Cómo verifico si un recordatorio fue enviado?"),
        parrafo("En el detalle de cada cita podrá ver el registro de recordatorios: tipo, fecha de envío y si fue exitoso o si hubo algún error."),
        espaciado(),
        espaciado(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          shading: { type: ShadingType.SOLID, color: "EBF5FB", fill: "EBF5FB" },
          border: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: COLOR_AZUL },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_AZUL },
          },
          children: [
            new TextRun({ text: "Sistema Multi-Clínica  —  Manual de Usuario  —  Versión 1.0  —  Febrero 2026", size: 20, color: "888888" }),
          ],
        }),
      ],
    },
  ],
});

// ─── GENERAR EL ARCHIVO ─────────────────────────────────────
Packer.toBuffer(doc).then(buffer => {
  const outputPath = path.join(__dirname, "Manual_Usuario_MultiClinica.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log("✅  Archivo generado: " + outputPath);
}).catch(err => {
  console.error("❌  Error al generar el archivo:", err);
});
