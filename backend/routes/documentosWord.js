/**
 * routes/documentosWord.js — Plantillas tipo Word  (/api/documentos-word)
 *
 * Cada clínica guarda sus propios documentos (constancias, consentimientos,
 * informes…): pueden subirse desde un Word (.docx, se convierte en el navegador)
 * o escribirse en el editor. Llevan datos automáticos como {{paciente}} o
 * {{fecha}} que se llenan al elegir un paciente.
 *
 *   GET    /                      lista de plantillas de la clínica
 *   GET    /:id                   una plantilla con su contenido
 *   POST   /                      crear
 *   PUT    /:id                   actualizar
 *   DELETE /:id                   eliminar
 *   GET    /contexto?paciente_id  valores de los datos automáticos
 *   POST   /exportar-docx         { html, nombre } → archivo Word (.docx)
 *
 * Tabla nueva (CREATE TABLE IF NOT EXISTS): no toca datos existentes.
 */
const router = require("express").Router();
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const sanitizeHtml = require("sanitize-html");
const pool = require("../db");
const auth = require("../middlewares/auth");
const { tituloMedico } = require("../utils/tituloMedico");

const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];
const ROLES_EDICION = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "SUPER_ADMIN"];
const CATEGORIAS = ["constancia", "consentimiento", "informe", "referencia", "formato", "otro"];
const PAPELES = ["LETTER", "HALF_LETTER", "LEGAL", "A4"];
const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);

let tablaLista = false;
async function asegurarTabla() {
  if (tablaLista) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documentos_word (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      categoria VARCHAR(40) NOT NULL DEFAULT 'otro',
      contenido MEDIUMTEXT NULL,
      papel VARCHAR(20) NOT NULL DEFAULT 'LETTER',
      creado_por INT UNSIGNED NULL,
      actualizado_por INT UNSIGNED NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_docword_clinica (clinica_id, actualizado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablaLista = true;
}

// Limpia el HTML (de Word o pegado): conserva formato, tablas e imágenes,
// quita scripts, eventos y enlaces peligrosos.
function limpiarHtml(html) {
  return sanitizeHtml(String(html || ""), {
    allowedTags: [
      "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "font",
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr",
      "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "caption",
      "img", "a",
    ],
    allowedAttributes: {
      "*": ["style", "align", "class"],
      a: ["href", "name", "target"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan", "width", "valign"],
      th: ["colspan", "rowspan", "width", "valign"],
      col: ["span", "width"],
      table: ["border", "cellpadding", "cellspacing", "width"],
      font: ["color", "size", "face"],
      ol: ["start", "type"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["data", "http", "https"] },
    allowedStyles: {
      "*": {
        color: [/^[#a-z0-9(),.\s%]+$/i], "background-color": [/^[#a-z0-9(),.\s%]+$/i],
        "text-align": [/^(left|right|center|justify)$/], "font-size": [/^[\d.]+(px|pt|em|rem|%)$/],
        "font-weight": [/^(bold|normal|[1-9]00)$/], "font-style": [/^(italic|normal)$/],
        "text-decoration": [/^[a-z\s-]+$/], "font-family": [/^[\w\s,'"-]+$/],
        width: [/^[\d.]+(px|pt|em|%)$|^auto$/], height: [/^[\d.]+(px|pt|em|%)$|^auto$/],
        border: [/^[\w\s#().,%-]+$/], "border-collapse": [/^(collapse|separate)$/],
        padding: [/^[\d.\s]+(px|pt|em)?[\d.\s(px|pt|em)]*$/], margin: [/^[\d.\s-]+(px|pt|em|auto)?[\d.\s(px|pt|em|auto)-]*$/],
        "vertical-align": [/^(top|middle|bottom|baseline)$/], "line-height": [/^[\d.]+(px|pt|em|%)?$/],
        "list-style-type": [/^[a-z-]+$/],
      },
    },
  });
}

/* ── Lista / CRUD ──────────────────────────────────────────────────────── */
router.get("/", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const [rows] = await pool.query(
      `SELECT d.id, d.nombre, d.categoria, d.papel, d.creado_en, d.actualizado_en,
              CHAR_LENGTH(COALESCE(d.contenido,'')) AS tamano,
              u.nombres AS autor_nombres, u.apellidos AS autor_apellidos
       FROM documentos_word d LEFT JOIN usuarios u ON u.id = COALESCE(d.actualizado_por, d.creado_por)
       WHERE d.clinica_id = ? ORDER BY d.actualizado_en DESC LIMIT 300`, [clinicaDe(req)]);
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("[documentos-word] lista", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar los documentos" });
  }
});

router.get("/contexto", auth(...ROLES), async (req, res) => {
  try {
    const cid = clinicaDe(req);
    const pid = Number(req.query.paciente_id) || null;
    const [[clinica]] = await pool.query("SELECT * FROM clinicas WHERE id = ?", [cid]);
    const tz = clinica?.timezone || "America/Tegucigalpa";
    const ahora = dayjs().tz(tz);
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    let medico = null;
    try {
      const [[m]] = await pool.query(
        `SELECT u.*, e.nombre AS especialidad FROM usuarios u
         LEFT JOIN especialidades e ON e.id = u.especialidad_id WHERE u.id = ?`, [req.user.id]);
      medico = m || null;
    } catch {
      const [[m]] = await pool.query("SELECT * FROM usuarios WHERE id = ?", [req.user.id]);
      medico = m || null;
    }
    const nombreMedico = medico
      ? (String(medico.nombre_display || "").trim() ||
        `${["MEDICO", "PSICOLOGO"].includes(medico.tipo) ? tituloMedico(medico.sexo, { tipo: medico.tipo, desconocido: "Dr(a). " }) : ""}${medico.nombres} ${medico.apellidos}`.replace(/\s+/g, " ").trim())
      : "";

    const v = {
      fecha: `${ahora.date()} de ${MESES[ahora.month()]} de ${ahora.year()}`,
      fecha_corta: ahora.format("DD/MM/YYYY"),
      hora: ahora.format("hh:mm A"),
      medico: nombreMedico,
      medico_especialidad: medico?.especialidad || "",
      medico_colegiatura: medico?.numero_colegiatura || "",
      clinica: clinica?.nombre || "",
      clinica_direccion: [clinica?.direccion, clinica?.ciudad].filter(Boolean).join(", "),
      clinica_telefono: clinica?.telefono || "",
    };

    if (pid) {
      const [[p]] = await pool.query("SELECT * FROM pacientes WHERE id = ? AND clinica_id = ?", [pid, cid]);
      if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
      const nac = p.fecha_nacimiento ? dayjs(p.fecha_nacimiento) : null;
      let edad = "";
      if (nac && nac.isValid()) {
        const anios = ahora.diff(nac, "year");
        edad = anios >= 2 ? `${anios} años` : `${ahora.diff(nac, "month")} meses`;
      }
      const SEXO = { M: "Masculino", F: "Femenino", OTRO: "Otro" };
      Object.assign(v, {
        paciente: `${p.nombres || ""} ${p.apellidos || ""}`.replace(/\s+/g, " ").trim(),
        paciente_nombres: p.nombres || "",
        paciente_apellidos: p.apellidos || "",
        paciente_dni: p.dni || "",
        paciente_edad: edad,
        paciente_fecha_nacimiento: nac && nac.isValid() ? nac.format("DD/MM/YYYY") : "",
        paciente_sexo: SEXO[p.sexo] || p.sexo || "",
        paciente_telefono: p.telefono || "",
        paciente_email: p.email || "",
        paciente_direccion: [p.direccion, p.ciudad, p.departamento].filter(Boolean).join(", "),
        paciente_ocupacion: p.ocupacion || "",
        paciente_estado_civil: p.estado_civil || "",
        paciente_responsable: p.responsable_nombre || "",
      });
    }
    res.json({ ok: true, data: v });
  } catch (e) {
    console.error("[documentos-word] contexto", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar los datos" });
  }
});

router.get("/:id", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const [[d]] = await pool.query("SELECT * FROM documentos_word WHERE id = ? AND clinica_id = ?", [req.params.id, clinicaDe(req)]);
    if (!d) return res.status(404).json({ ok: false, msg: "Documento no encontrado" });
    res.json({ ok: true, data: d });
  } catch (e) {
    console.error("[documentos-word] ver", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo abrir el documento" });
  }
});

function datosValidos(body) {
  const nombre = String(body.nombre || "").trim().slice(0, 200);
  if (!nombre) return { error: "El documento necesita un nombre" };
  const contenido = limpiarHtml(body.contenido);
  if (contenido.length > 8 * 1024 * 1024) return { error: "El documento es demasiado grande (máx. 8 MB, revisa las imágenes)" };
  return {
    nombre,
    contenido,
    categoria: CATEGORIAS.includes(body.categoria) ? body.categoria : "otro",
    papel: PAPELES.includes(body.papel) ? body.papel : "LETTER",
  };
}

router.post("/", auth(...ROLES_EDICION), async (req, res) => {
  try {
    await asegurarTabla();
    const d = datosValidos(req.body);
    if (d.error) return res.status(400).json({ ok: false, msg: d.error });
    const [r] = await pool.query(
      `INSERT INTO documentos_word (clinica_id, nombre, categoria, contenido, papel, creado_por, actualizado_por)
       VALUES (?,?,?,?,?,?,?)`, [clinicaDe(req), d.nombre, d.categoria, d.contenido, d.papel, req.user.id, req.user.id]);
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    console.error("[documentos-word] crear", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo guardar el documento" });
  }
});

router.put("/:id", auth(...ROLES_EDICION), async (req, res) => {
  try {
    await asegurarTabla();
    const d = datosValidos(req.body);
    if (d.error) return res.status(400).json({ ok: false, msg: d.error });
    const [r] = await pool.query(
      `UPDATE documentos_word SET nombre=?, categoria=?, contenido=?, papel=?, actualizado_por=?
       WHERE id=? AND clinica_id=?`, [d.nombre, d.categoria, d.contenido, d.papel, req.user.id, req.params.id, clinicaDe(req)]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "Documento no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[documentos-word] actualizar", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo guardar el documento" });
  }
});

router.delete("/:id", auth(...ROLES_EDICION), async (req, res) => {
  try {
    await asegurarTabla();
    const [r] = await pool.query("DELETE FROM documentos_word WHERE id=? AND clinica_id=?", [req.params.id, clinicaDe(req)]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "Documento no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[documentos-word] eliminar", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo eliminar el documento" });
  }
});

/* ── Exportar a Word (.docx) ───────────────────────────────────────────── */
router.post("/exportar-docx", auth(...ROLES), async (req, res) => {
  try {
    const html = limpiarHtml(req.body?.html);
    if (!html.trim()) return res.status(400).json({ ok: false, msg: "El documento está vacío" });
    const HTMLtoDOCX = require("html-to-docx");
    const tamanos = { LETTER: { width: 12240, height: 15840 }, HALF_LETTER: { width: 12240, height: 7920 }, LEGAL: { width: 12240, height: 20160 }, A4: { width: 11906, height: 16838 } };
    const buf = await HTMLtoDOCX(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, null, {
      orientation: "portrait",
      pageSize: tamanos[req.body?.papel] || tamanos.LETTER,
      margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      font: "Arial", fontSize: 22,
      table: { row: { cantSplit: true } },
      title: String(req.body?.nombre || "Documento").slice(0, 120),
      creator: "Medic-KG",
    });
    const nombre = String(req.body?.nombre || "documento").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "documento";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}.docx"`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error("[documentos-word] exportar", e.message);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: "No se pudo generar el archivo de Word" });
  }
});

module.exports = router;
module.exports.limpiarHtml = limpiarHtml;
