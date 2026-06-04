/**
 * MÓDULO 5 — Prescripción Digital
 */
const router  = require("express").Router();
const pool    = require("../db");
const auth    = require("../middlewares/auth");
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const https   = require("https");
const http    = require("http");
const PDFDoc  = require("pdfkit");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

let prescripcionesHasFirmaCol;
const hasPrescripcionesFirmaCol = async () => {
  if (prescripcionesHasFirmaCol !== undefined) return prescripcionesHasFirmaCol;
  const [rows] = await pool.query("SHOW COLUMNS FROM prescripciones LIKE 'firma_digital_url'");
  prescripcionesHasFirmaCol = rows.length > 0;
  return prescripcionesHasFirmaCol;
};

/**
 * GET /api/prescripciones?paciente_id=&historia_id=
 */
router.get("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { paciente_id, historia_id, page = 1 } = req.query;
    const limit  = 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT pr.id, pr.estado, pr.notas, pr.creado_en, pr.codigo_qr,
             p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
             u.nombres AS med_nombres, u.apellidos AS med_apellidos,
             (SELECT COUNT(*) FROM prescripcion_items pi WHERE pi.prescripcion_id = pr.id) AS total_items
      FROM prescripciones pr
      JOIN pacientes p ON p.id = pr.paciente_id
      JOIN usuarios  u ON u.id = pr.medico_id
      WHERE 1=1`;
    const params = [];

    if (cid)         { sql += " AND pr.clinica_id = ?";  params.push(cid); }
    if (paciente_id) { sql += " AND pr.paciente_id = ?"; params.push(paciente_id); }
    if (historia_id) { sql += " AND pr.historia_id = ?"; params.push(historia_id); }

    sql += " ORDER BY pr.creado_en DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prescripciones/sugerencias-cie10?codigo=J06.9
// ─────────────────────────────────────────────────────────────────────────────
router.get("/sugerencias-cie10", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const { codigo } = req.query;
    if (!codigo) return res.json({ ok: true, data: [] });

    const [exactos] = await pool.query(
      `SELECT id, nombre_generico, nombre_comercial, presentacion, via_administracion,
              dosis_default, duracion_default, cantidad_default, instrucciones_default
       FROM medicamentos
       WHERE codigo_cie_sugerido = ? AND activo = 1
       LIMIT 10`,
      [codigo]
    );

    let resultado = exactos;
    if (exactos.length === 0 && codigo.length >= 3) {
      const [parciales] = await pool.query(
        `SELECT id, nombre_generico, nombre_comercial, presentacion, via_administracion,
                dosis_default, duracion_default, cantidad_default, instrucciones_default
         FROM medicamentos
         WHERE codigo_cie_sugerido LIKE ? AND activo = 1
         LIMIT 8`,
        [codigo.substring(0, 3) + "%"]
      );
      resultado = parciales;
    }

    res.json({ ok: true, data: resultado });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prescripciones/historial-paciente/:pacienteId
// ─────────────────────────────────────────────────────────────────────────────
router.get("/historial-paciente/:pacienteId", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { pacienteId } = req.params;
    const { page = 1 } = req.query;
    const limit = 15, offset = (page - 1) * limit;

    const condCid = cid ? " AND pr.clinica_id = ?" : "";
    const paramsCid = cid ? [cid] : [];

    const [recetas] = await pool.query(
      `SELECT pr.id, pr.estado, pr.notas, pr.creado_en,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos,
              hc.diagnostico_cie, hc.subjetivo,
              (SELECT COUNT(*) FROM prescripcion_items pi WHERE pi.prescripcion_id = pr.id) AS total_items
       FROM prescripciones pr
       JOIN usuarios u ON u.id = pr.medico_id
       LEFT JOIN historias_clinicas hc ON hc.id = pr.historia_id
       WHERE pr.paciente_id = ?${condCid}
       ORDER BY pr.creado_en DESC
       LIMIT ? OFFSET ?`,
      [pacienteId, ...paramsCid, limit, offset]
    );

    for (const r of recetas) {
      const [items] = await pool.query(
        `SELECT pi.medicamento_texto, pi.dosis, pi.duracion, pi.cantidad, pi.instrucciones,
                COALESCE(m.nombre_generico, pi.medicamento_texto) AS nombre,
                m.presentacion
         FROM prescripcion_items pi
         LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
         WHERE pi.prescripcion_id = ?`,
        [r.id]
      );
      r.items = items;
    }

    res.json({ ok: true, data: recetas });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST/DELETE /api/prescripciones/favoritas
// ─────────────────────────────────────────────────────────────────────────────
router.get("/favoritas", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const medicoId = req.user.id;
    const cid = clinicaOf(req);
    const [rows] = await pool.query(
      `SELECT id, nombre, notas, items_json, creado_en
       FROM recetas_favoritas
       WHERE medico_id = ? AND clinica_id = ?
       ORDER BY nombre`,
      [medicoId, cid]
    );
    const data = rows.map(r => ({
      ...r,
      items: typeof r.items_json === "string" ? JSON.parse(r.items_json || "[]") : (r.items_json || []),
    }));
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/favoritas", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const medicoId = req.user.id;
    const cid = clinicaOf(req);
    const { nombre, notas, items } = req.body;
    if (!nombre || !items?.length) return res.status(400).json({ ok: false, msg: "nombre e items requeridos" });

    await pool.query(
      `INSERT INTO recetas_favoritas (clinica_id, medico_id, nombre, notas, items_json)
       VALUES (?, ?, ?, ?, ?)`,
      [cid, medicoId, nombre.trim(), notas || "", JSON.stringify(items)]
    );
    res.json({ ok: true, msg: "Receta favorita guardada" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.delete("/favoritas/:id", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const medicoId = req.user.id;
    await pool.query(
      `DELETE FROM recetas_favoritas WHERE id = ? AND medico_id = ?`,
      [req.params.id, medicoId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/prescripciones/:id  — con items
 */
router.get("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);

    const condicion = cid ? "pr.id = ? AND pr.clinica_id = ?" : "pr.id = ?";
    const paramsPr  = cid ? [req.params.id, cid] : [req.params.id];

    const [[pr]] = await pool.query(
      `SELECT pr.*,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              p.fecha_nacimiento, p.dni,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos, e.nombre AS especialidad
       FROM prescripciones pr
       JOIN pacientes p ON p.id = pr.paciente_id
       JOIN usuarios  u ON u.id = pr.medico_id
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE ${condicion}`,
      paramsPr
    );
    if (!pr) return res.status(404).json({ ok: false, msg: "No encontrado" });

    const [items] = await pool.query(
      `SELECT pi.*, COALESCE(m.nombre_generico, pi.medicamento_texto) AS medicamento_nombre,
              m.presentacion, m.via_administracion
       FROM prescripcion_items pi
       LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
       WHERE pi.prescripcion_id = ?`,
      [pr.id]
    );

    res.json({ ok: true, data: { ...pr, items } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/prescripciones
 * Body: { historia_id?, cita_id?, paciente_id, notas?, firma_digital_url?, items: [{medicamento_id?, medicamento_texto?, dosis, duracion, cantidad, instrucciones}] }
 */
router.post("/", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let cid = clinicaOf(req);

    const { historia_id, cita_id, paciente_id, notas, firma_digital_url, items = [] } = req.body;
    if (!paciente_id) throw new Error("paciente_id requerido");
    if (!items.length)  throw new Error("Debe incluir al menos un medicamento");

    // Si es SUPER_ADMIN sin clinica_id, derivarlo del paciente
    if (!cid) {
      const [[pac]] = await conn.query("SELECT clinica_id FROM pacientes WHERE id = ? LIMIT 1", [paciente_id]);
      if (!pac) throw new Error("Paciente no encontrado");
      cid = pac.clinica_id;
    }

    const codigo_qr = crypto.randomBytes(8).toString("hex").toUpperCase();

    const hasFirmaCol = await hasPrescripcionesFirmaCol();
    const insertSql = hasFirmaCol
      ? `INSERT INTO prescripciones (clinica_id, historia_id, cita_id, paciente_id, medico_id, codigo_qr, notas, firma_digital_url)
         VALUES (?,?,?,?,?,?,?,?)`
      : `INSERT INTO prescripciones (clinica_id, historia_id, cita_id, paciente_id, medico_id, codigo_qr, notas)
         VALUES (?,?,?,?,?,?,?)`;
    const insertParams = hasFirmaCol
      ? [cid, historia_id || null, cita_id || null, paciente_id, req.user.id, codigo_qr, notas || null, firma_digital_url || null]
      : [cid, historia_id || null, cita_id || null, paciente_id, req.user.id, codigo_qr, notas || null];

    const [r] = await conn.query(insertSql, insertParams);
    const prescId = r.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO prescripcion_items
           (prescripcion_id, medicamento_id, medicamento_texto, dosis, duracion, cantidad, instrucciones)
         VALUES (?,?,?,?,?,?,?)`,
        [
          prescId,
          item.medicamento_id || null,
          item.medicamento_texto || null,
          item.dosis || null,
          item.duracion || null,
          item.cantidad || null,
          item.instrucciones || null,
        ]
      );
    }

    await conn.commit();
    res.json({ ok: true, id: prescId, codigo_qr });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

/**
 * PATCH /api/prescripciones/:id/estado
 */
router.patch("/:id/estado", auth("MEDICO","RECEPCIONISTA","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { estado } = req.body;
    const validos = ["ACTIVA","ENTREGADA","CANCELADA"];
    if (!validos.includes(estado)) return res.status(400).json({ ok: false, msg: "Estado inválido" });

    const sql = cid
      ? "UPDATE prescripciones SET estado=? WHERE id=? AND clinica_id=?"
      : "UPDATE prescripciones SET estado=? WHERE id=?";
    const params = cid ? [estado, req.params.id, cid] : [estado, req.params.id];

    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * DELETE /api/prescripciones/:id  — cancelar
 */
router.delete("/:id", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const sql = cid
      ? "UPDATE prescripciones SET estado='CANCELADA' WHERE id=? AND clinica_id=?"
      : "UPDATE prescripciones SET estado='CANCELADA' WHERE id=?";
    const params = cid ? [req.params.id, cid] : [req.params.id];
    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/prescripciones/:id/pdf
 * Genera y devuelve la receta en PDF con código QR usando la plantilla predeterminada.
 * No requiere rol especial, pero sí autenticación.
 */
router.get("/:id/pdf", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);

    // 1. Datos de la prescripción, paciente y médico
    const condPdf  = cid ? "pr.id = ? AND pr.clinica_id = ?" : "pr.id = ?";
    const paramsPdf = cid ? [req.params.id, cid] : [req.params.id];
    const hasFirmaCol = await hasPrescripcionesFirmaCol();
    const firmaSelect = hasFirmaCol ? "pr.firma_digital_url AS med_firma_url," : "u.firma_url AS med_firma_url,";
    const [[pr]] = await pool.query(
      `SELECT pr.*,
              p.nombres   AS pac_nombres,   p.apellidos   AS pac_apellidos,
              p.fecha_nacimiento,           p.dni,
              u.nombres   AS med_nombres,   u.apellidos   AS med_apellidos,
              u.numero_colegiatura, ${firmaSelect}
              e.nombre    AS especialidad,
              c.nombre    AS clinica_nombre, c.direccion   AS clinica_direccion,
              c.telefono  AS clinica_telefono
       FROM prescripciones pr
       JOIN pacientes  p ON p.id = pr.paciente_id
       JOIN usuarios   u ON u.id = pr.medico_id
       JOIN clinicas   c ON c.id = pr.clinica_id
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE ${condPdf}`,
      paramsPdf
    );
    if (!pr) return res.status(404).json({ ok: false, msg: "No encontrado" });

    const [items] = await pool.query(
      `SELECT pi.*,
              COALESCE(m.nombre_generico, pi.medicamento_texto) AS medicamento_nombre,
              m.presentacion, m.via_administracion
       FROM prescripcion_items pi
       LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
       WHERE pi.prescripcion_id = ?`,
      [pr.id]
    );

    // 2. Buscar plantilla predeterminada (fallback si la columna es_predeterminada no existe)
    let tpl = null;
    const [predCol] = await pool.query(
      "SHOW COLUMNS FROM plantillas_documentos LIKE 'es_predeterminada'"
    );
    const orderTpl = predCol.length ? "es_predeterminada DESC, id DESC" : "id DESC";
    const [tplRows] = await pool.query(
      `SELECT contenido
       FROM plantillas_documentos
       WHERE clinica_id=? AND tipo='receta' AND activo=1
       ORDER BY ${orderTpl}
       LIMIT 1`,
      [pr.clinica_id]
    );
    if (tplRows.length) {
      try { tpl = JSON.parse(tplRows[0].contenido); } catch { tpl = null; }
    }

    // 3. Configurar valores del template o defaults
    const tColor      = tpl?.color || "#1a2744";
    const tTextColor  = tpl?.header_text_color || "#ffffff";
    const tClinica    = tpl?.clinica || pr.clinica_nombre;
    const tMedico     = tpl ? (tpl.medico || "") : `${pr.med_nombres} ${pr.med_apellidos}`;
    const tCred       = tpl ? (tpl.credenciales || "") : ((pr.numero_colegiatura ? `Col. ${pr.numero_colegiatura}` : "") || pr.especialidad || "");
    const tFooter     = tpl?.footer || "";
    const tLogoUrl    = tpl?.logo_url || "";
    const tFirma      = tpl?.mostrar_firma !== false;
    const tFirmaLabel = tpl?.etiqueta_firma || "FIRMA";

    // Horarios
    let tHorarios = [];
    try { tHorarios = JSON.parse(tpl?.horarios || "[]"); } catch { tHorarios = []; }
    const tMostrarHorarios = tpl?.mostrar_horarios && tHorarios.length > 0;

    // Fuentes (mapear nombres CSS a fuentes PDFKit)
    const fontMap = {
      "Arial": "Helvetica",
      "Helvetica": "Helvetica",
      "Times": "Times-Roman",
      "Times New Roman": "Times-Roman",
      "Courier": "Courier",
      "Courier New": "Courier",
      "Georgia": "Times-Roman",
      "Verdana": "Helvetica",
      "Tahoma": "Helvetica",
      "Trebuchet MS": "Helvetica",
      "Palatino": "Times-Roman",
      "Lucida Console": "Courier",
      "Comic Sans MS": "Helvetica",
    };

    const fontFileMap = {
      "Brush Script MT": "BRUSHSCI.TTF",
      "Gabriola": "Gabriola.ttf",
      "Kristen ITC": "ITCKRIST.TTF",
      "Lucida Handwriting": "LHANDW.TTF",
      "Vladimir Script": "VLADIMIR.TTF",
      "Edwardian Script ITC": "ITCEDSCR.TTF",
    };

    const resolveFont = (cssFont) => {
      const f = cssFont || "Arial, Helvetica, sans-serif";
      const base = f.split(",")[0].replace(/['"]/g, "").trim();
      const baseNorm = base.toLowerCase();
      const fontFile = fontFileMap[base] ? path.join("C:\\Windows\\Fonts", fontFileMap[base]) : "";
      if (fontFile && fs.existsSync(fontFile)) {
        return { normal: fontFile, bold: fontFile, italic: fontFile };
      }
      const pdfFont =
        fontMap[base] ||
        (baseNorm.includes("times") || baseNorm.includes("georgia") || baseNorm.includes("palatino") ? "Times-Roman" :
         baseNorm.includes("courier") || baseNorm.includes("lucida console") || baseNorm.includes("monospace") ? "Courier" :
         "Helvetica");
      return {
        normal: pdfFont,
        bold: pdfFont === "Courier" ? "Courier-Bold" : pdfFont === "Times-Roman" ? "Times-Bold" : "Helvetica-Bold",
        italic: pdfFont === "Courier" ? "Courier-Oblique" : pdfFont === "Times-Roman" ? "Times-Italic" : "Helvetica-Oblique",
      };
    };

    const getClinicaFont = () => resolveFont(tpl?.clinica_font);
    const getMedicoFont = () => resolveFont(tpl?.medico_font);

    // Descargar logo si existe
    let logoBuffer = null;
    if (tLogoUrl) {
      try {
        if (tLogoUrl.startsWith("data:")) {
          // Base64
          const base64Data = tLogoUrl.split(",")[1];
          logoBuffer = Buffer.from(base64Data, "base64");
        } else if (tLogoUrl.startsWith("http")) {
          // URL remota
          const https = require("https");
          const http = require("http");
          const client = tLogoUrl.startsWith("https") ? https : http;
          logoBuffer = await new Promise((resolve) => {
            client.get(tLogoUrl, (r) => {
              const chunks = [];
              r.on("data", (c) => chunks.push(c));
              r.on("end", () => resolve(Buffer.concat(chunks)));
            }).on("error", () => resolve(null));
          });
        } else {
          const localPath = path.isAbsolute(tLogoUrl)
            ? tLogoUrl
            : path.join(process.cwd(), tLogoUrl);
          if (fs.existsSync(localPath)) {
            logoBuffer = await fs.promises.readFile(localPath);
          }
        }
      } catch {
        logoBuffer = null;
      }
    }

    // Imagen de firma digital del médico
    let firmaBuffer = null;
    const firmaUrl = pr.med_firma_url || null;
    if (firmaUrl) {
      try {
        if (firmaUrl.startsWith("data:")) {
          firmaBuffer = Buffer.from(firmaUrl.split(",")[1], "base64");
        } else if (firmaUrl.startsWith("http")) {
          const client = firmaUrl.startsWith("https") ? https : http;
          firmaBuffer = await new Promise(resolve => {
            client.get(firmaUrl, r => {
              const chunks = [];
              r.on("data", c => chunks.push(c));
              r.on("end", () => resolve(Buffer.concat(chunks)));
            }).on("error", () => resolve(null));
          });
        } else {
          const localPath = require("path").join(__dirname, "..", firmaUrl.replace(/^\//, ""));
          firmaBuffer = await require("fs").promises.readFile(localPath).catch(() => null);
        }
      } catch { firmaBuffer = null; }
    }

    const withDoctorPrefix = (name) => {
      const raw = String(name || "").replace(/\s+/g, " ").trim();
      if (!raw) return "";
      const hasPrefix = /^(dr|dra|doctor|doctora)\.?/i.test(raw);
      return hasPrefix ? raw : `Dr(a). ${raw}`;
    };
    const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dedupeMedicoName = (rawName, fallbackBase) => {
      let clean = String(rawName || "").replace(/\s+/g, " ").trim();
      const base = String(fallbackBase || "").replace(/\s+/g, " ").trim();
      if (!clean || !base) return clean;

      const dupTail = new RegExp(
        `(\\s|\\||-|,|;)*((dr\\(a\\)|dr|dra|doctor|doctora)\\.?\\s*)?${escapeRegExp(base)}$`,
        "i"
      );

      const once = withDoctorPrefix(base).toLowerCase();
      if (withDoctorPrefix(clean).toLowerCase() === once) return clean;

      const trimmedTail = clean.replace(dupTail, "").trim();
      if (trimmedTail && withDoctorPrefix(trimmedTail).toLowerCase() !== once) {
        clean = trimmedTail;
      }

      return clean || base;
    };

    const medicoBase = `${pr.med_nombres} ${pr.med_apellidos}`.trim();
    const medicoDisplay = tMedico ? withDoctorPrefix(dedupeMedicoName(tMedico, medicoBase)) : "";

    // 5. Construir PDF
    const doc = new PDFDoc({ size: "LETTER", margin: 0 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="receta-${pr.id}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width - 100;
    const marginL = 50;
    const GRAY = "#555555";

    // ── Encabezado con color del template ──────────────────────────
    const clinicaFonts = getClinicaFont();
    const clinicaFontSize = parseFloat(tpl?.clinica_font_size) || 1.25;
    const medicoFonts = getMedicoFont();
    const medicoFontSize = parseFloat(tpl?.medico_font_size) || 0.85;

    const clinicFontPt = Math.max(16, Math.min(clinicaFontSize * 10, 36));
    const doctorFontPt = Math.max(11, Math.min(medicoFontSize * 9, 24));

    // Calcular alturas de encabezado
    doc.fillColor(tTextColor).fontSize(clinicFontPt).font(clinicaFonts.bold);
    const clinicHeight = doc.heightOfString(tClinica || "", { width: pageW - 100 });

    doc.fontSize(doctorFontPt).font(medicoFonts.normal);
    const doctorHeight = medicoDisplay ? doc.heightOfString(medicoDisplay, { width: pageW - 100 }) : 0;

    let credHeight = 0;
    if (tCred) {
      doc.fontSize(8).font(medicoFonts.normal);
      credHeight = doc.heightOfString(tCred, { width: pageW - 100 });
    }

    const logoSize = logoBuffer ? 70 : 0;
    const headerGaps = (medicoDisplay ? 6 : 0) + (tCred ? 4 : 0);
    const headerH = Math.max(logoSize + 20, clinicHeight + doctorHeight + credHeight + headerGaps + 20);

    // Dibuja fondo del encabezado
    const topY = 14;

    doc.rect(marginL, topY, pageW, headerH).fill(tColor);

    // Logo a la izquierda (si existe)
    let textX = marginL + 15;
    if (logoBuffer) {
      doc.save();
      doc.fillOpacity(0.15).fillColor("#ffffff");
      doc.roundedRect(marginL + 10, topY + 10, logoSize, logoSize, 6).fill();
      doc.restore();
      doc.image(logoBuffer, marginL + 10, topY + 10, { fit: [logoSize, logoSize] });
      textX = marginL + logoSize + 20;
    }

    // Texto del encabezado a la derecha (clínica, médico, credenciales)
    const textW = marginL + pageW - textX - 10;
    const headerTextY = topY + 8;

    doc.fillColor(tTextColor)
       .fontSize(clinicFontPt).font(clinicaFonts.bold)
       .text(tClinica || "", textX, headerTextY, { width: textW });

    let nextHeaderY = headerTextY + clinicHeight;
    if (medicoDisplay) {
      nextHeaderY += 6;
      doc.fillColor(tTextColor)
         .fontSize(doctorFontPt).font(medicoFonts.normal)
         .text(medicoDisplay, textX, nextHeaderY, { width: textW });
      nextHeaderY += doctorHeight;
    }

    if (tCred) {
      const credY = nextHeaderY + 4;
      doc.fillColor(tTextColor + "bf").fontSize(8).font(medicoFonts.normal)
         .text(tCred, textX, credY, { width: textW });
    }

    // En plantilla de receta, el bloque superior no muestra QR.
    // Se mantiene la generación del código para validaciones públicas.
    const recetaInfoY = topY + headerH + 14;
    const pacienteTexto = `${pr.pac_nombres} ${pr.pac_apellidos}`;
    const recetaFecha = new Date(pr.creado_en).toLocaleDateString("es-HN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    doc.fillColor("#333").fontSize(11).font("Helvetica")
       .text("Paciente:", marginL + 10, recetaInfoY);
    doc.fillColor("#333").fontSize(11).font("Helvetica")
       .text(pacienteTexto, marginL + 70, recetaInfoY, { width: pageW - 80, underline: true });

    const fechaY = recetaInfoY;
    doc.fillColor("#333").fontSize(11).font("Helvetica")
       .text("Fecha:", marginL + pageW - 220, fechaY);
    doc.fillColor("#333").fontSize(11).font("Helvetica")
       .text(recetaFecha, marginL + pageW - 170, fechaY, { width: 150, underline: true });

    const separatorY = fechaY + 24;
    doc.strokeColor("#eeeeee").lineWidth(0.8)
       .moveTo(marginL + 10, separatorY).lineTo(marginL + pageW - 10, separatorY).stroke();

    const rxY = separatorY + 18;
    doc.fillColor("#333").fontSize(30).font("Times-Bold")
       .text("Rx", marginL + 10, rxY);

    const recetaBodyY = rxY + 36;

    /*
    // Contenido/instrucciones de la plantilla de receta
    if (tpl?.contenido) {
      const plantillaTexto = String(tpl.contenido)
        .replaceAll("{{paciente}}", `${pr.pac_nombres} ${pr.pac_apellidos}`)
        .replaceAll("{{fecha}}", new Date(pr.creado_en).toLocaleDateString("es-PE"))
        .replaceAll("{{diagnostico}}", "");
      if (plantillaTexto.trim()) {
        const blockY = tableTop;
        const blockH = doc.heightOfString(plantillaTexto, { width: pageW - 20, lineGap: 1.5 }) + 14;
        doc.rect(marginL, blockY, pageW, blockH).fill("#f9f9f9");
        doc.fillColor(tColor).fontSize(7).font(medicoFonts.bold)
           .text("Instrucciones", marginL + 10, blockY + 5);
        doc.fillColor("#111").fontSize(7.5).font(medicoFonts.normal)
           .text(plantillaTexto, marginL + 10, blockY + 16, { width: pageW - 20, lineGap: 1.5 });
        tableTop = blockY + blockH + 8;
      }
    }

    // ── Tabla de medicamentos ───────────────────────────────────────
    */
    const plantillaTexto = String(tpl?.contenido || "")
      .replaceAll("{{paciente}}", `${pr.pac_nombres} ${pr.pac_apellidos}`)
      .replaceAll("{{fecha}}", new Date(pr.creado_en).toLocaleDateString("es-HN"))
      .replaceAll("{{diagnostico}}", "")
      .trim();

    const medsTexto = items.map((item, i) => {
      const med = `${item.medicamento_nombre || "Medicamento"}${item.presentacion ? ` (${item.presentacion})` : ""}`;
      const dosis = item.dosis || "-";
      const duracion = item.duracion || "-";
      const cantidad = item.cantidad || "-";
      const inst = item.instrucciones || "-";
      return `${i + 1}. ${med}\n   Dosis: ${dosis}   Duracion: ${duracion}   Cantidad: ${cantidad}\n   Indicaciones: ${inst}`;
    }).join("\n\n");

    const notasTexto = (pr.notas || "").trim();
    const recetaTexto = [plantillaTexto, medsTexto, notasTexto ? `Notas:\n${notasTexto}` : ""]
      .filter(Boolean)
      .join("\n\n");

    doc.fillColor("#111").fontSize(9.5).font("Helvetica")
       .text(recetaTexto || " ", marginL + 10, recetaBodyY, { width: pageW - 20, lineGap: 2 });
    const bodyH = doc.heightOfString(recetaTexto || " ", { width: pageW - 20, lineGap: 2 });
    let rowY = recetaBodyY + Math.max(120, bodyH) + 8;
    /*
    items.forEach((item, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#fcfcfc";
      const med = item.medicamento_nombre + (item.presentacion ? ` (${item.presentacion})` : "");
      const inst = item.instrucciones || "—";
      
      doc.fontSize(7).font(medicoFonts.normal);
      const medHeight = doc.heightOfString(med, { width: colW.med });
      const instHeight = doc.heightOfString(inst, { width: colW.inst });
      const rowHeight = Math.max(14, medHeight + 6, instHeight + 6);
      
      doc.rect(marginL, rowY, pageW, rowHeight).fill(bg);
      doc.fillColor("#111").fontSize(7).font(medicoFonts.normal);
      
      doc.text(med,                     cols.med,  rowY + 3, { width: colW.med });
      doc.text(item.dosis       || "—", cols.dosis,rowY + 3, { width: colW.dosis });
      doc.text(item.duracion    || "—", cols.dur,  rowY + 3, { width: colW.dur  });
      doc.text(item.cantidad    || "—", cols.cant, rowY + 3, { width: colW.cant });
      doc.text(inst,                    cols.inst, rowY + 3, { width: colW.inst });
      
      rowY += rowHeight;
    });

    doc.rect(marginL, tableTop, pageW, rowY - tableTop).stroke(tColor);

    // ── Notas ───────────────────────────────────────────────────────
    if (pr.notas) {
      const notasY = rowY + 10;
      doc.fillColor(tColor).fontSize(7).font(medicoFonts.bold).text("Indicaciones:", marginL, notasY);
      doc.fillColor(GRAY).fontSize(7).font(medicoFonts.italic)
         .text(pr.notas, marginL, notasY + 10, { width: pageW });
      rowY = notasY + 22;
    }

    // ── Horarios de atención ───────────────────────────────────────
    */
    if (tMostrarHorarios) {
      const horariosY = rowY + 10;
      doc.moveTo(marginL, horariosY).lineTo(marginL + pageW, horariosY).stroke("#e0e0e0");
      
      doc.fillColor(tColor).fontSize(7).font("Helvetica-Bold")
         .text("Horarios de Atención", marginL, horariosY + 4);
      
      let hY = horariosY + 14;
      tHorarios.forEach(h => {
        doc.fontSize(6.5).font("Helvetica-Bold").fillColor("#374151")
           .text(h.dias, marginL, hY, { width: 120 });
        doc.fontSize(6.5).font("Helvetica").fillColor("#555")
           .text(h.horario, marginL + 120, hY, { width: 100 });
        hY += 10;
      });
      
      rowY = hY + 8;
    }

    // Mantener aire minimo sin separar la firma del bloque de contenido.
    const minContentY = recetaBodyY + 150;
    if (rowY < minContentY) rowY = minContentY;

    // ── Firma ───────────────────────────────────────────────────────
    let firmaBottom = rowY;
    if (tFirma) {
      const firmaX = marginL + pageW - 160;
      const firmaW = 160;
      let firmaY = rowY + 14;
      // Imagen de firma digital
      if (firmaBuffer) {
        try {
          doc.image(firmaBuffer, firmaX + 30, firmaY - 10, { width: 100, height: 50, fit: [100, 50] });
          firmaY += 45;
        } catch { /* ignorar si imagen inválida */ }
      }
      doc.moveTo(firmaX, firmaY).lineTo(firmaX + firmaW, firmaY).stroke(GRAY);
      doc.fillColor(GRAY).fontSize(6.5).font("Helvetica-Bold")
         .text(tFirmaLabel, firmaX, firmaY + 3, { width: firmaW, align: "center" });
      if (medicoDisplay) {
        doc.fillColor(GRAY).fontSize(6.5).font("Helvetica")
           .text(medicoDisplay, firmaX, firmaY + 12, { width: firmaW, align: "center" });
      }
      firmaBottom = firmaY + (medicoDisplay ? 24 : 14);
    }

    // ── Pie de página ───────────────────────────────────────────────
    const footerY = Math.min(720, firmaBottom + 18);
    if (tFooter) {
      doc.rect(marginL, footerY, pageW, 20).fill(tColor);
      doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica-Bold")
         .text(tFooter, marginL + 5, footerY + 6, { width: pageW - 10, align: "center" });
    }

    const cardBottom = tFooter ? footerY + 20 : Math.min(740, firmaBottom + 12);
    doc.lineWidth(0.8).strokeColor("#dddddd").rect(marginL, topY, pageW, cardBottom - topY).stroke();

    doc.end();
  } catch (e) {
    console.error("PDF error:", e);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
