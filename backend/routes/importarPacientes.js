/**
 * routes/importarPacientes.js
 * Importar pacientes desde Excel (.xlsx) o CSV.
 *
 *  GET  /api/pacientes-importar/plantilla       → plantilla de Excel para llenar
 *  POST /api/pacientes-importar/analizar        → lee el archivo y devuelve una vista previa (no guarda nada)
 *  POST /api/pacientes-importar/confirmar       → guarda los pacientes nuevos elegidos (un "lote")
 *  GET  /api/pacientes-importar/historial       → importaciones anteriores
 *  POST /api/pacientes-importar/:id/deshacer    → borra los pacientes del lote que aún no tienen datos
 *
 * Nunca modifica pacientes existentes: si el DNI ya existe, la fila se salta.
 */
const router = require("express").Router();
const multer = require("multer");
const ExcelJS = require("exceljs");
const pool = require("../db");
const auth = require("../middlewares/auth");
const { titleCaseNombre, normClave } = require("../utils/pacientesDuplicados");

const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO", "RECEPCIONISTA", "SUPER_ADMIN"];
const ROLES_DESHACER = ["ADMIN", "MEDICO", "PSICOLOGO", "SUPER_ADMIN"];
const MAX_FILAS = 5000;

const subir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(xlsx|csv)$/i.test(file.originalname || "")) return cb(null, true);
    if (/\.xls$/i.test(file.originalname || "")) {
      return cb(Object.assign(new Error("El archivo es de un Excel antiguo (.xls). Ábralo en Excel y use «Guardar como» → «Libro de Excel (.xlsx)»."), { code: "TIPO" }));
    }
    cb(Object.assign(new Error("Solo se aceptan archivos de Excel (.xlsx) o CSV."), { code: "TIPO" }));
  },
});

// ── Tablas propias del módulo (aditivas) ─────────────────────────────────────
let tablasListas = false;
async function asegurarTablas() {
  if (tablasListas) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pacientes_importaciones (
      id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id     INT UNSIGNED NOT NULL,
      usuario_id     INT UNSIGNED NULL,
      archivo_nombre VARCHAR(200) NULL,
      total_filas    INT NOT NULL DEFAULT 0,
      importados     INT NOT NULL DEFAULT 0,
      omitidos       INT NOT NULL DEFAULT 0,
      estado         ENUM('ACTIVA','DESHECHA') NOT NULL DEFAULT 'ACTIVA',
      deshechos      INT NULL,
      creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
      deshecho_en    DATETIME NULL,
      INDEX idx_clinica (clinica_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pacientes_importados (
      importacion_id INT UNSIGNED NOT NULL,
      paciente_id    INT UNSIGNED NOT NULL,
      PRIMARY KEY (importacion_id, paciente_id),
      INDEX idx_paciente (paciente_id)
    )`);
  tablasListas = true;
}

// ── Columnas reconocidas (los encabezados se comparan sin acentos, espacios ni signos) ──
const SINONIMOS = {
  completo: ["nombrecompleto", "paciente", "nombredelpaciente", "nombreyapellido", "nombreyapellidos", "nombresyapellidos", "nombreapellido", "nombresapellidos"],
  nombres: ["nombre", "nombres", "primernombre"],
  nombres2: ["segundonombre", "otrosnombres"],
  apellidos: ["apellido", "apellidos", "primerapellido"],
  apellidos2: ["segundoapellido"],
  dni: ["dni", "identidad", "numerodeidentidad", "noidentidad", "nodeidentidad", "numeroidentidad", "tarjetadeidentidad", "cedula", "ceduladeidentidad", "documento", "nodocumento", "numerodedocumento", "numerodocumento", "dniidentidad", "pasaporte"],
  fecha_nacimiento: ["fechadenacimiento", "fechanacimiento", "fnac", "fechanac", "nacimiento", "fdenacimiento", "fechadenac", "fnacimiento", "fecnac", "fechanacim", "cumpleanos"],
  sexo: ["sexo", "genero"],
  telefono: ["telefono", "celular", "tel", "movil", "whatsapp", "telefonocelular", "numerodetelefono", "telefonomovil", "cel", "contacto"],
  email: ["email", "correo", "correoelectronico", "mail", "emailcorreo"],
  direccion: ["direccion", "domicilio", "direcciondomicilio"],
  ciudad: ["ciudad", "municipio", "localidad"],
  departamento: ["departamento", "provincia", "estado"],
  pais: ["pais"],
  grupo_sanguineo: ["gruposanguineo", "tipodesangre", "tiposangre", "sangre", "tiposanguineo"],
  ocupacion: ["ocupacion", "profesion", "trabajo", "oficio"],
  estado_civil: ["estadocivil"],
  contacto_emergencia_nombre: ["contactoemergencia", "contactodeemergencia", "encasodeemergencia", "nombrecontactoemergencia"],
  contacto_emergencia_telefono: ["telemergencia", "telefonoemergencia", "telefonodeemergencia", "teldeemergencia", "telefonocontactoemergencia"],
  notas: ["notas", "nota", "observaciones", "observacion", "comentarios", "comentario"],
};
const CAMPO_POR_ENCABEZADO = {};
for (const [campo, lista] of Object.entries(SINONIMOS)) for (const s of lista) CAMPO_POR_ENCABEZADO[s] = campo;

const NOMBRE_CAMPO = {
  completo: "Nombre completo", nombres: "Nombres", nombres2: "Segundo nombre", apellidos: "Apellidos",
  apellidos2: "Segundo apellido", dni: "DNI", fecha_nacimiento: "Fecha de nacimiento", sexo: "Sexo",
  telefono: "Teléfono", email: "Correo", direccion: "Dirección", ciudad: "Ciudad", departamento: "Departamento",
  pais: "País", grupo_sanguineo: "Grupo sanguíneo", ocupacion: "Ocupación", estado_civil: "Estado civil",
  contacto_emergencia_nombre: "Contacto de emergencia", contacto_emergencia_telefono: "Teléfono de emergencia", notas: "Notas",
};

// Largo máximo de cada dato (igual que las columnas de la tabla pacientes)
const LARGO = {
  nombres: 100, apellidos: 100, dni: 20, telefono: 30, email: 120, direccion: 250, ciudad: 100,
  departamento: 100, pais: 100, grupo_sanguineo: 10, ocupacion: 100, estado_civil: 30,
  contacto_emergencia_nombre: 120, contacto_emergencia_telefono: 30, notas: 5000,
};
const CAMPOS_GUARDABLES = Object.keys(LARGO).concat(["fecha_nacimiento", "sexo"]);

const normEncabezado = (t) => String(t ?? "")
  .replace(/\(.*?\)/g, "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");
const normDni = (d) => String(d ?? "").replace(/[^0-9a-zA-Z]/g, "").toLowerCase();

// ── Lectura del archivo ──────────────────────────────────────────────────────
function valorCelda(v) {
  if (v == null) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (v.text != null) return String(v.text);
    if (v.result != null) return v.result instanceof Date ? v.result : String(v.result);
    if (v.error) return "";
    return "";
  }
  return v;
}

async function leerXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  // La primera hoja que tenga datos
  const hoja = wb.worksheets.find((h) => h.actualRowCount > 0);
  if (!hoja) return [];
  const filas = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    const valores = [];
    for (let c = 1; c <= row.cellCount; c++) valores.push(valorCelda(row.getCell(c).value));
    filas.push(valores);
  });
  return filas;
}

function leerCsv(buffer) {
  let texto = buffer.toString("utf8");
  if (texto.includes("�")) texto = buffer.toString("latin1"); // CSV guardado por Excel en Windows
  texto = texto.replace(/^﻿/, "");
  const primera = texto.split(/\r?\n/)[0] || "";
  const sep = [";", ",", "\t"].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => String(x).trim())) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some((x) => String(x).trim())) filas.push(fila);
  return filas;
}

// ── Limpieza de cada dato ────────────────────────────────────────────────────
const texto = (v) => (v instanceof Date ? "" : String(v ?? "").replace(/\s+/g, " ").trim());

function fechaIso(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** Devuelve { valor: "YYYY-MM-DD" | null, aviso } */
function leerFecha(v) {
  if (v == null || v === "") return { valor: null };
  let d = null, aviso = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "number" || /^\d{4,5}(\.\d+)?$/.test(String(v).trim())) {
    // Número de serie de Excel (días desde 1899-12-30)
    const n = Number(v);
    if (n > 1 && n < 80000) d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  } else {
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
      let [, a, b, y] = m.map(Number);
      if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
      let dia = a, mes = b;
      if (b > 12 && a <= 12) { dia = b; mes = a; aviso = `La fecha venía como mes/día («${s}»); se leyó como ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${y}.`; }
      d = new Date(Date.UTC(y, mes - 1, dia));
      if (d.getUTCMonth() !== mes - 1) d = null; // 31/02 → inválida
    }
  }
  if (!d || isNaN(d.getTime())) return { valor: null, aviso: `Fecha de nacimiento no reconocida («${texto(v) || v}»); se dejó vacía.` };
  const anio = d.getUTCFullYear();
  if (anio < 1900 || d > new Date()) return { valor: null, aviso: `Fecha de nacimiento fuera de rango («${fechaIso(d)}»); se dejó vacía.` };
  return { valor: fechaIso(d), aviso };
}

function leerSexo(v) {
  const s = normEncabezado(v);
  if (!s) return null;
  if (["m", "masculino", "hombre", "h", "varon", "male"].includes(s)) return "M";
  if (["f", "femenino", "mujer", "female"].includes(s)) return "F";
  if (["otro", "o", "x"].includes(s)) return "OTRO";
  return undefined; // no reconocido
}

/** "Juan Carlos Pérez López" → nombres / apellidos */
function separarNombreCompleto(completo) {
  const partes = texto(completo).split(" ").filter(Boolean);
  if (partes.length <= 1) return { nombres: partes[0] || "", apellidos: "" };
  if (partes.length === 2) return { nombres: partes[0], apellidos: partes[1] };
  if (partes.length === 3) return { nombres: partes[0], apellidos: partes.slice(1).join(" ") };
  const mitad = Math.ceil(partes.length / 2);
  return { nombres: partes.slice(0, mitad).join(" "), apellidos: partes.slice(mitad).join(" ") };
}

/**
 * Convierte los valores crudos de una fila (por campo) en los datos a guardar.
 * Devuelve { datos, errores[], avisos[] }
 */
function limpiarFila(crudo, { paisClinica } = {}) {
  const avisos = [], errores = [];
  let nombres = texto(crudo.nombres);
  let apellidos = texto(crudo.apellidos);
  if (texto(crudo.nombres2)) nombres = `${nombres} ${texto(crudo.nombres2)}`.trim();
  if (texto(crudo.apellidos2)) apellidos = `${apellidos} ${texto(crudo.apellidos2)}`.trim();
  if (!nombres && !apellidos && texto(crudo.completo)) ({ nombres, apellidos } = separarNombreCompleto(crudo.completo));
  else if (nombres && !apellidos && nombres.includes(" ") && !crudo.apellidos) ({ nombres, apellidos } = separarNombreCompleto(nombres));
  nombres = titleCaseNombre(nombres);
  apellidos = titleCaseNombre(apellidos);
  if (!nombres) errores.push("Falta el nombre.");
  if (!apellidos) errores.push("Falta el apellido.");

  const datos = { nombres, apellidos };

  // DNI: si Excel lo guardó como número, se pierde el 0 inicial de la identidad hondureña
  let dni = crudo.dni instanceof Date ? "" : String(crudo.dni ?? "").trim();
  if (/^\d+(\.0+)?$/.test(dni)) dni = dni.replace(/\.0+$/, "");
  if (typeof crudo.dni === "number" && /^\d{12}$/.test(dni) && (!paisClinica || /^(hn|honduras)$/i.test(paisClinica))) {
    dni = "0" + dni;
    avisos.push("Se agregó el 0 inicial al DNI (Excel lo había quitado).");
  }
  datos.dni = dni || null;
  if (!datos.dni) avisos.push("Sin DNI.");

  const f = leerFecha(crudo.fecha_nacimiento);
  datos.fecha_nacimiento = f.valor;
  if (f.aviso) avisos.push(f.aviso);

  const sexo = leerSexo(crudo.sexo);
  datos.sexo = sexo || null;
  if (sexo === undefined) avisos.push(`Sexo no reconocido («${texto(crudo.sexo)}»); se dejó vacío.`);

  let tel = crudo.telefono;
  if (typeof tel === "number") tel = String(tel);
  datos.telefono = texto(tel) || null;

  const email = texto(crudo.email).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { avisos.push(`Correo no válido («${email}»); se dejó vacío.`); datos.email = null; }
  else datos.email = email || null;

  for (const c of ["direccion", "ciudad", "departamento", "pais", "grupo_sanguineo", "ocupacion", "estado_civil", "contacto_emergencia_nombre", "notas"]) {
    datos[c] = texto(crudo[c]) || null;
  }
  let telEm = crudo.contacto_emergencia_telefono;
  if (typeof telEm === "number") telEm = String(telEm);
  datos.contacto_emergencia_telefono = texto(telEm) || null;
  if (datos.grupo_sanguineo) datos.grupo_sanguineo = datos.grupo_sanguineo.toUpperCase().replace(/\s/g, "");

  // Recortar al largo permitido
  for (const [c, max] of Object.entries(LARGO)) {
    if (datos[c] && datos[c].length > max) {
      if (c === "nombres" || c === "apellidos" || c === "dni") errores.push(`${NOMBRE_CAMPO[c]} demasiado largo.`);
      else { datos[c] = datos[c].slice(0, max); avisos.push(`${NOMBRE_CAMPO[c]} recortado a ${max} caracteres.`); }
    }
  }
  return { datos, errores, avisos };
}

/** Pacientes actuales de la clínica, indexados por DNI y por nombre */
async function indicesExistentes(clinicaId) {
  const [rows] = await pool.query(
    "SELECT id, nombres, apellidos, dni, DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fnac FROM pacientes WHERE clinica_id = ?",
    [clinicaId]
  );
  const porDni = new Map(), porNombre = new Map();
  for (const p of rows) {
    const d = normDni(p.dni);
    if (d) porDni.set(d, p);
    const k = normClave(`${p.nombres} ${p.apellidos}`);
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push(p);
  }
  return { porDni, porNombre };
}

/**
 * Estado de cada fila:
 *  nuevo    → se importa
 *  existe   → ya está en la clínica (mismo DNI, o mismo nombre y fecha de nacimiento): se salta
 *  posible  → hay un paciente con el mismo nombre (sin DNI para confirmarlo): se salta salvo que se elija
 *  repetido → la misma persona aparece más arriba en el archivo: se salta
 *  error    → faltan datos obligatorios
 */
function clasificar(filas, indices) {
  const vistosDni = new Map(), vistosNombre = new Map();
  for (const f of filas) {
    if (f.errores.length) { f.estado = "error"; continue; }
    const d = normDni(f.datos.dni);
    const k = normClave(`${f.datos.nombres} ${f.datos.apellidos}`);
    const nombreCompleto = (p) => `${p.nombres} ${p.apellidos}`.trim();
    const existente = d ? indices.porDni.get(d) : null;
    if (existente) {
      f.estado = "existe";
      f.coincide = { id: existente.id, nombre: nombreCompleto(existente), motivo: "Mismo DNI" };
      continue;
    }
    const mismos = indices.porNombre.get(k) || [];
    const mismoNac = f.datos.fecha_nacimiento && mismos.find((p) => p.fnac === f.datos.fecha_nacimiento);
    if (mismoNac) {
      f.estado = "existe";
      f.coincide = { id: mismoNac.id, nombre: nombreCompleto(mismoNac), motivo: "Mismo nombre y fecha de nacimiento" };
      continue;
    }
    const filaPrevia = (d && vistosDni.get(d)) || (!d && vistosNombre.get(`${k}|${f.datos.fecha_nacimiento || ""}`));
    if (filaPrevia) { f.estado = "repetido"; f.coincide = { fila: filaPrevia, motivo: "Repetido en el archivo" }; continue; }
    if (d) vistosDni.set(d, f.fila);
    vistosNombre.set(`${k}|${f.datos.fecha_nacimiento || ""}`, f.fila);
    // Mismo nombre con DNI distinto o sin DNI: puede ser otra persona → se deja elegir
    const otro = mismos.find((p) => !d || !normDni(p.dni));
    if (otro) {
      f.estado = "posible";
      f.coincide = { id: otro.id, nombre: nombreCompleto(otro), motivo: "Mismo nombre" };
      continue;
    }
    f.estado = "nuevo";
  }
  return filas;
}

const contar = (filas) => filas.reduce((a, f) => { a[f.estado] = (a[f.estado] || 0) + 1; return a; }, { nuevo: 0, existe: 0, posible: 0, repetido: 0, error: 0 });

const clinicaDe = (req) => req.tenant?.clinica_id || req.user?.clinica_id;

async function paisDeClinica(clinicaId) {
  try { const [[c]] = await pool.query("SELECT pais FROM clinicas WHERE id = ?", [clinicaId]); return c?.pais || null; }
  catch { return null; }
}

// ── GET /plantilla ───────────────────────────────────────────────────────────
router.get("/plantilla", auth(...ROLES), async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Medic-KG";
    const hoja = wb.addWorksheet("Pacientes", { views: [{ state: "frozen", ySplit: 1 }] });
    const columnas = [
      ["Nombres", 22], ["Apellidos", 22], ["DNI", 18], ["Fecha de nacimiento (dd/mm/aaaa)", 22], ["Sexo (M/F)", 11],
      ["Teléfono", 15], ["Correo", 26], ["Dirección", 30], ["Ciudad", 16], ["Departamento", 16],
      ["Grupo sanguíneo", 12], ["Ocupación", 18], ["Estado civil", 14], ["Contacto de emergencia", 24],
      ["Teléfono de emergencia", 18], ["Notas", 40],
    ];
    hoja.columns = columnas.map(([header, width]) => ({ header, width }));
    const cab = hoja.getRow(1);
    cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A6E" } };
    cab.alignment = { vertical: "middle", wrapText: true };
    cab.height = 30;
    // DNI y teléfonos como texto: así Excel no quita los ceros iniciales
    for (const c of [3, 6, 15]) hoja.getColumn(c).numFmt = "@";
    hoja.getColumn(4).numFmt = "dd/mm/yyyy";
    hoja.dataValidations.add("E2:E5001", { type: "list", allowBlank: true, formulae: ['"M,F"'] });

    const inst = wb.addWorksheet("Instrucciones");
    inst.getColumn(1).width = 110;
    [
      ["Cómo llenar la plantilla", true],
      ["1. Escriba un paciente por fila en la hoja «Pacientes», empezando en la fila 2. No cambie los títulos de la fila 1."],
      ["2. Solo «Nombres» y «Apellidos» son obligatorios. Los demás datos puede dejarlos vacíos."],
      ["3. Fecha de nacimiento: día/mes/año, por ejemplo 15/03/1990."],
      ["4. Sexo: M o F."],
      ["5. Si ya tiene su lista en otro Excel, también puede subirla tal cual: el sistema reconoce títulos como «Nombre», «Identidad», «Celular», «Correo», «Fecha de nacimiento», etc."],
      ["6. Antes de guardar verá una vista previa. Los pacientes cuyo DNI ya existe en la clínica se saltan: nunca se modifican."],
      [""],
      ["Ejemplo:", true],
      ["María José | Pérez López | 0801-1990-01234 | 15/03/1990 | F | 9988-7766 | maria@correo.com | Col. Kennedy | Tegucigalpa | Francisco Morazán"],
    ].forEach(([t, negrita]) => { const r = inst.addRow([t]); if (negrita) r.font = { bold: true, size: 12 }; });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="plantilla_pacientes_medickg.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /analizar ───────────────────────────────────────────────────────────
router.post("/analizar", auth(...ROLES), (req, res, next) => {
  subir.single("archivo")(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === "LIMIT_FILE_SIZE" ? "El archivo es muy grande (máximo 10 MB)." : err.message;
    res.status(400).json({ ok: false, msg });
  });
}, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Seleccione una clínica." });
    if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió ningún archivo." });

    let tabla;
    try {
      tabla = /\.csv$/i.test(req.file.originalname) ? leerCsv(req.file.buffer) : await leerXlsx(req.file.buffer);
    } catch {
      return res.status(400).json({ ok: false, msg: "No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) o CSV válido." });
    }
    // La fila de títulos: la primera (de las 10 primeras) donde se reconozcan más columnas
    let idxCab = -1, mejor = 0;
    tabla.slice(0, 10).forEach((fila, i) => {
      const n = fila.filter((v) => CAMPO_POR_ENCABEZADO[normEncabezado(v)]).length;
      if (n > mejor) { mejor = n; idxCab = i; }
    });
    if (idxCab < 0) {
      return res.status(400).json({ ok: false, msg: "No se encontraron los títulos de las columnas (por ejemplo «Nombres», «Apellidos», «DNI»). Use la plantilla o agregue una fila de títulos." });
    }
    const cab = tabla[idxCab];
    const usados = new Set();
    const columnas = cab.map((enc, i) => {
      const campo = CAMPO_POR_ENCABEZADO[normEncabezado(enc)];
      const libre = campo && !usados.has(campo);
      if (libre) usados.add(campo);
      return { indice: i, encabezado: texto(enc instanceof Date ? "" : enc) || `Columna ${i + 1}`, campo: libre ? campo : null, nombre: libre ? NOMBRE_CAMPO[campo] : null };
    });
    if (!usados.has("completo") && !(usados.has("nombres"))) {
      return res.status(400).json({ ok: false, msg: "No se encontró la columna del nombre del paciente (por ejemplo «Nombres» o «Nombre completo»)." });
    }

    const datosFilas = tabla.slice(idxCab + 1);
    if (datosFilas.length > MAX_FILAS) {
      return res.status(400).json({ ok: false, msg: `El archivo tiene ${datosFilas.length} filas. Por ahora se pueden importar hasta ${MAX_FILAS} a la vez: divídalo en varios archivos.` });
    }
    const paisClinica = await paisDeClinica(clinicaId);
    const filas = datosFilas.map((valores, i) => {
      const crudo = {};
      for (const col of columnas) if (col.campo) crudo[col.campo] = valores[col.indice];
      return { fila: idxCab + i + 2, ...limpiarFila(crudo, { paisClinica }) };
    }).filter((f) => Object.values(f.datos).some((v) => v)); // filas vacías fuera

    if (!filas.length) return res.status(400).json({ ok: false, msg: "El archivo no tiene pacientes debajo de los títulos." });
    clasificar(filas, await indicesExistentes(clinicaId));
    res.json({
      ok: true,
      archivo: req.file.originalname,
      columnas: columnas.map(({ encabezado, campo, nombre }) => ({ encabezado, campo, nombre })),
      resumen: { total: filas.length, ...contar(filas) },
      filas,
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /confirmar ──────────────────────────────────────────────────────────
router.post("/confirmar", auth(...ROLES), async (req, res) => {
  const clinicaId = clinicaDe(req);
  if (!clinicaId) return res.status(400).json({ ok: false, msg: "Seleccione una clínica." });
  const { filas, archivo, incluir_posibles, total_archivo } = req.body || {};
  if (!Array.isArray(filas) || !filas.length) return res.status(400).json({ ok: false, msg: "No hay pacientes para importar." });
  if (filas.length > MAX_FILAS) return res.status(400).json({ ok: false, msg: `Máximo ${MAX_FILAS} pacientes por importación.` });

  let conn;
  try {
    await asegurarTablas();
    // Se vuelve a validar todo en el servidor (no se confía en la vista previa)
    const paisClinica = await paisDeClinica(clinicaId);
    const revisadas = filas.map((f, i) => ({ fila: Number(f.fila) || i + 1, ...limpiarFila(f.datos || {}, { paisClinica }) }));
    clasificar(revisadas, await indicesExistentes(clinicaId));
    const aGuardar = revisadas.filter((f) => f.estado === "nuevo" || (incluir_posibles && f.estado === "posible"));
    if (!aGuardar.length) return res.status(400).json({ ok: false, msg: "Ninguno de los pacientes es nuevo: ya están registrados en la clínica." });

    const [colsRows] = await pool.query("SHOW COLUMNS FROM pacientes");
    const existentes = new Set(colsRows.map((c) => c.Field));
    const campos = CAMPOS_GUARDABLES.filter((c) => existentes.has(c));

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [lote] = await conn.query(
      "INSERT INTO pacientes_importaciones (clinica_id, usuario_id, archivo_nombre, total_filas, importados, omitidos) VALUES (?,?,?,?,?,?)",
      [clinicaId, req.user?.id || null, String(archivo || "").slice(0, 200) || null, Number(total_archivo) || revisadas.length, 0, 0]
    );
    // Uno por uno: así cada paciente queda ligado al lote con su id exacto
    // (aunque otra persona esté guardando pacientes al mismo tiempo)
    const sqlPaciente = `INSERT INTO pacientes (clinica_id, ${campos.join(", ")}) VALUES (?${",?".repeat(campos.length)})`;
    const ids = [];
    for (const f of aGuardar) {
      const [r] = await conn.query(sqlPaciente, [clinicaId, ...campos.map((c) => f.datos[c] ?? null)]);
      ids.push(r.insertId);
    }
    for (let i = 0; i < ids.length; i += 500) {
      await conn.query("INSERT INTO pacientes_importados (importacion_id, paciente_id) VALUES ?", [ids.slice(i, i + 500).map((id) => [lote.insertId, id])]);
    }
    const omitidos = (Number(total_archivo) || revisadas.length) - aGuardar.length;
    await conn.query("UPDATE pacientes_importaciones SET importados = ?, omitidos = ? WHERE id = ?", [aGuardar.length, Math.max(omitidos, 0), lote.insertId]);
    await conn.commit();

    res.json({ ok: true, importacion_id: lote.insertId, importados: aGuardar.length, omitidos: Math.max(omitidos, 0) });
  } catch (e) {
    if (conn) await conn.rollback().catch(() => {});
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    if (conn) conn.release();
  }
});

// ── GET /historial ───────────────────────────────────────────────────────────
router.get("/historial", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.json({ ok: true, data: [] });
    await asegurarTablas();
    const [rows] = await pool.query(
      `SELECT i.id, i.archivo_nombre, i.total_filas, i.importados, i.omitidos, i.estado, i.deshechos,
              i.creado_en, i.deshecho_en, TRIM(CONCAT(COALESCE(u.nombres,''),' ',COALESCE(u.apellidos,''))) AS usuario
       FROM pacientes_importaciones i
       LEFT JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.clinica_id = ?
       ORDER BY i.id DESC LIMIT 30`,
      [clinicaId]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /:id/deshacer ───────────────────────────────────────────────────────
// Borra solo los pacientes de este lote que todavía no tienen nada registrado
// (citas, consultas, facturas, archivos…). Los que ya se usaron se conservan.
router.post("/:id/deshacer", auth(...ROLES_DESHACER), async (req, res) => {
  let conn;
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTablas();
    const [[lote]] = await pool.query("SELECT * FROM pacientes_importaciones WHERE id = ? AND clinica_id = ?", [req.params.id, clinicaId]);
    if (!lote) return res.status(404).json({ ok: false, msg: "Importación no encontrada." });
    if (lote.estado === "DESHECHA") return res.status(400).json({ ok: false, msg: "Esta importación ya se deshizo." });

    const [rel] = await pool.query("SELECT paciente_id FROM pacientes_importados WHERE importacion_id = ?", [lote.id]);
    let ids = rel.map((r) => r.paciente_id);
    const conservados = new Set();
    if (ids.length) {
      // Cualquier tabla que tenga paciente_id cuenta como "ya se usó"
      const [tablas] = await pool.query(
        `SELECT DISTINCT TABLE_NAME AS t FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'paciente_id'
           AND TABLE_NAME NOT IN ('pacientes_importados')`
      );
      for (const { t } of tablas) {
        for (let i = 0; i < ids.length; i += 1000) {
          const [usados] = await pool.query(`SELECT DISTINCT paciente_id FROM \`${t}\` WHERE paciente_id IN (?)`, [ids.slice(i, i + 1000)]);
          usados.forEach((u) => conservados.add(u.paciente_id));
        }
      }
    }
    const aBorrar = ids.filter((id) => !conservados.has(id));

    conn = await pool.getConnection();
    await conn.beginTransaction();
    let borrados = 0;
    for (let i = 0; i < aBorrar.length; i += 1000) {
      const [r] = await conn.query("DELETE FROM pacientes WHERE clinica_id = ? AND id IN (?)", [clinicaId, aBorrar.slice(i, i + 1000)]);
      borrados += r.affectedRows;
    }
    await conn.query(
      "UPDATE pacientes_importaciones SET estado = 'DESHECHA', deshechos = ?, deshecho_en = NOW() WHERE id = ?",
      [borrados, lote.id]
    );
    await conn.commit();
    res.json({ ok: true, borrados, conservados: conservados.size });
  } catch (e) {
    if (conn) await conn.rollback().catch(() => {});
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
module.exports._prueba = { limpiarFila, leerFecha, leerCsv, normEncabezado, separarNombreCompleto };
