/**
 * MÓDULO 6 — Estudios y Exámenes (solicitudes + resultados)
 */
const router  = require("express").Router();
const pool    = require("../db");
const auth    = require("../middlewares/auth");
const PDFDoc  = require("pdfkit");
const https   = require("https");
const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const sse     = require("../utils/sseManager");

let _ndReady = false;
async function ensureNombreDisplayColumn() {
  if (_ndReady) return;
  try {
    const [c] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'nombre_display'");
    if (!c.length) await pool.query("ALTER TABLE usuarios ADD COLUMN nombre_display VARCHAR(150) NULL AFTER apellidos");
    _ndReady = true;
  } catch (e) { console.error("ensureNombreDisplayColumn:", e.message); }
}
const webPush = require("../utils/webPush");
const { notificarRecepcionistas } = require("../utils/notificarRecepcion");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

let estudiosHasFirmaCol;
const hasEstudiosFirmaCol = async () => {
  if (estudiosHasFirmaCol !== undefined) return estudiosHasFirmaCol;
  const [rows] = await pool.query("SHOW COLUMNS FROM estudios_solicitudes LIKE 'firma_digital_url'");
  estudiosHasFirmaCol = rows.length > 0;
  return estudiosHasFirmaCol;
};

/**
 * GET /api/estudios?paciente_id=&historia_id=&estado=
 */
router.get("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    await ensureNombreDisplayColumn();
    const { paciente_id, historia_id, estado, page = 1 } = req.query;
    const limit  = 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT s.*,
             p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
             u.nombres AS medico_nombres, u.apellidos AS medico_apellidos, u.nombre_display AS medico_nombre_display
      FROM estudios_solicitudes s
      JOIN pacientes p ON p.id = s.paciente_id
      JOIN usuarios  u ON u.id = s.medico_id
      WHERE s.clinica_id = ?`;
    const params = [cid];

    if (paciente_id) { sql += " AND s.paciente_id = ?"; params.push(paciente_id); }
    if (historia_id) { sql += " AND s.historia_id = ?"; params.push(historia_id); }
    if (estado)      { sql += " AND s.estado = ?";      params.push(estado); }

    sql += " ORDER BY s.creado_en DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/estudios/pdf?paciente_id=&historia_id=
 * Genera PDF de solicitud de estudios con el mismo formato de la receta.
 * DEBE ir antes de /:id para que Express no lo capture como parámetro.
 */
router.get("/pdf", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    let { paciente_id, historia_id, estudio_id } = req.query;

    // Si viene estudio_id, resolvemos el paciente_id desde ese registro (imprimir un solo estudio)
    if (estudio_id) {
      const [[est]] = await pool.query(
        "SELECT paciente_id FROM estudios_solicitudes WHERE id=? AND clinica_id=? LIMIT 1",
        [estudio_id, cid]
      );
      if (!est) return res.status(404).json({ ok: false, msg: "Estudio no encontrado" });
      paciente_id = est.paciente_id;
    }
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    // 1. Datos del paciente, médico y clínica
    const [[pac]] = await pool.query(
      "SELECT id, nombres, apellidos FROM pacientes WHERE id=? AND clinica_id=?",
      [paciente_id, cid]
    );
    if (!pac) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    const [[clinica]] = await pool.query(
      "SELECT nombre FROM clinicas WHERE id=?",
      [cid]
    );

    const [[medico]] = await pool.query(
      `SELECT u.nombres, u.apellidos, u.numero_colegiatura, u.firma_url, e.nombre AS especialidad
       FROM usuarios u LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE u.id=?`,
      [req.user.id]
    );

    // 2. Estudios a imprimir
    let sql = `
      SELECT s.*
      FROM estudios_solicitudes s
      WHERE s.clinica_id=? AND s.paciente_id=?`;
    const params = [cid, paciente_id];
    if (estudio_id)       { sql += " AND s.id=?";          params.push(estudio_id); }
    else if (historia_id) { sql += " AND s.historia_id=?"; params.push(historia_id); }
    sql += " ORDER BY s.creado_en ASC";
    const [estudios] = await pool.query(sql, params);

    // 3. Plantilla predeterminada (misma que receta)
    let tpl = null;
    const [predCol] = await pool.query("SHOW COLUMNS FROM plantillas_documentos LIKE 'es_predeterminada'");
    const orderTpl = predCol.length ? "es_predeterminada DESC, id DESC" : "id DESC";
    const [tplRows] = await pool.query(
      `SELECT contenido FROM plantillas_documentos WHERE clinica_id=? AND tipo='receta' AND activo=1 ORDER BY ${orderTpl} LIMIT 1`,
      [cid]
    );
    if (tplRows.length) { try { tpl = JSON.parse(tplRows[0].contenido); } catch { tpl = null; } }

    // 4. Valores del template
    const tColor      = tpl?.color || "#1a2744";
    const tTextColor  = tpl?.header_text_color || "#ffffff";
    const tClinica    = tpl?.clinica || clinica?.nombre || "";
    const medicoBase  = medico ? `${medico.nombres} ${medico.apellidos}`.trim() : "";
    const tMedico     = tpl?.medico ? tpl.medico : medicoBase;
    const tCred       = tpl?.credenciales || (medico?.numero_colegiatura ? `Col. ${medico.numero_colegiatura}` : "") || medico?.especialidad || "";
    const tFooter     = tpl?.footer || "";
    const tLogoUrl    = tpl?.logo_url || "";
    const tFirma      = tpl?.mostrar_firma !== false;
    const tFirmaLabel = tpl?.etiqueta_firma || "FIRMA";

    // 5. Logo
    let logoBuffer = null;
    if (tLogoUrl) {
      try {
        if (tLogoUrl.startsWith("data:")) {
          logoBuffer = Buffer.from(tLogoUrl.split(",")[1], "base64");
        } else if (tLogoUrl.startsWith("http")) {
          const client = tLogoUrl.startsWith("https") ? https : http;
          logoBuffer = await new Promise(resolve => {
            client.get(tLogoUrl, r => {
              const chunks = [];
              r.on("data", c => chunks.push(c));
              r.on("end", () => resolve(Buffer.concat(chunks)));
            }).on("error", () => resolve(null));
          });
        }
      } catch { logoBuffer = null; }
    }

    // 5b. Imagen de firma digital del médico
    let firmaBuffer = null;
    const firmaUrl = [...estudios].reverse().find(s => s.firma_digital_url)?.firma_digital_url || null;
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
          const localPath = path.isAbsolute(firmaUrl)
            ? firmaUrl
            : path.join(process.cwd(), firmaUrl.replace(/^\//, ""));
          if (fs.existsSync(localPath)) {
            firmaBuffer = await fs.promises.readFile(localPath);
          }
        }
      } catch { firmaBuffer = null; }
    }

    // 6. Fuentes
    const fontMap = { "Arial":"Helvetica","Helvetica":"Helvetica","Times":"Times-Roman","Times New Roman":"Times-Roman","Georgia":"Times-Roman","Verdana":"Helvetica","Tahoma":"Helvetica" };
    const resolveFont = (cssFont) => {
      const base = (cssFont || "Arial").split(",")[0].replace(/['"]/g,"").trim();
      const pdfFont = fontMap[base] || "Helvetica";
      return {
        normal: pdfFont,
        bold:   pdfFont === "Times-Roman" ? "Times-Bold" : "Helvetica-Bold",
      };
    };
    const clinicaFonts = resolveFont(tpl?.clinica_font);
    const medicoFonts  = resolveFont(tpl?.medico_font);
    const clinicFontPt = Math.max(16, Math.min(parseFloat(tpl?.clinica_font_size || 1.25) * 10, 36));
    const doctorFontPt = Math.max(11, Math.min(parseFloat(tpl?.medico_font_size  || 0.85) * 9,  24));

    // 7. Construir PDF
    const doc = new PDFDoc({ size: "LETTER", margin: 0 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="estudios-${paciente_id}.pdf"`);
    doc.pipe(res);

    const pageW   = doc.page.width - 100;
    const marginL = 50;
    const GRAY    = "#555555";

    // ── Encabezado ──────────────────────────────────────────────────
    doc.fillColor(tTextColor).fontSize(clinicFontPt).font(clinicaFonts.bold);
    const clinicH = doc.heightOfString(tClinica, { width: pageW - 100 });
    doc.fontSize(doctorFontPt).font(medicoFonts.normal);
    const doctorH = tMedico ? doc.heightOfString(tMedico, { width: pageW - 100 }) : 0;
    const credH   = tCred   ? doc.fontSize(8).heightOfString(tCred, { width: pageW - 100 }) : 0;
    const logoSize = logoBuffer ? 70 : 0;
    const headerH  = Math.max(logoSize + 20, clinicH + doctorH + credH + 26);
    const topY     = 14;

    doc.rect(marginL, topY, pageW, headerH).fill(tColor);

    let textX = marginL + 15;
    if (logoBuffer) {
      doc.save().fillOpacity(0.15).fillColor("#ffffff");
      doc.roundedRect(marginL + 10, topY + 10, logoSize, logoSize, 6).fill();
      doc.restore();
      doc.image(logoBuffer, marginL + 10, topY + 10, { fit: [logoSize, logoSize] });
      textX = marginL + logoSize + 20;
    }
    const textW = marginL + pageW - textX - 10;
    let hY = topY + 8;
    doc.fillColor(tTextColor).fontSize(clinicFontPt).font(clinicaFonts.bold)
       .text(tClinica, textX, hY, { width: textW });
    hY += clinicH;
    if (tMedico) {
      hY += 6;
      doc.fillColor(tTextColor).fontSize(doctorFontPt).font(medicoFonts.normal)
         .text(tMedico, textX, hY, { width: textW });
      hY += doctorH;
    }
    if (tCred) {
      doc.fillColor(tTextColor + "bf").fontSize(8).font(medicoFonts.normal)
         .text(tCred, textX, hY + 4, { width: textW });
    }

    // ── Info paciente ────────────────────────────────────────────────
    const infoY     = topY + headerH + 14;
    const pacNombre = `${pac.nombres} ${pac.apellidos}`;
    const fecha     = new Date().toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" });

    doc.fillColor("#333").fontSize(11).font("Helvetica").text("Paciente:", marginL + 10, infoY);
    doc.fillColor("#333").fontSize(11).font("Helvetica").text(pacNombre, marginL + 70, infoY, { width: pageW - 250, underline: true });
    doc.fillColor("#333").fontSize(11).font("Helvetica").text("Fecha:", marginL + pageW - 220, infoY);
    doc.fillColor("#333").fontSize(11).font("Helvetica").text(fecha, marginL + pageW - 170, infoY, { width: 150, underline: true });

    const sepY = infoY + 24;
    doc.strokeColor("#eeeeee").lineWidth(0.8)
       .moveTo(marginL + 10, sepY).lineTo(marginL + pageW - 10, sepY).stroke();

    // ── Título ───────────────────────────────────────────────────────
    const tituloY = sepY + 16;
    doc.fillColor(tColor).fontSize(14).font("Helvetica-Bold")
       .text("SOLICITUD DE ESTUDIOS", marginL + 10, tituloY);

    let bodyY = tituloY + 30;

    // ── Lista de estudios ────────────────────────────────────────────
    if (estudios.length === 0) {
      doc.fillColor(GRAY).fontSize(10).font("Helvetica-Oblique")
         .text("Sin solicitudes de estudios.", marginL + 10, bodyY);
      bodyY += 20;
    } else {
      estudios.forEach((s, i) => {
        const tipo    = s.tipo || "LABORATORIO";
        const desc    = s.descripcion || "";
        const urgente = s.urgente ? " ⚠ URGENTE" : "";

        doc.fillColor(tColor).fontSize(9.5).font("Helvetica-Bold")
           .text(`${i + 1}. [${tipo}]${urgente}`, marginL + 10, bodyY, { width: pageW - 20 });
        bodyY += 14;

        doc.fillColor("#111").fontSize(9).font("Helvetica")
           .text(desc, marginL + 20, bodyY, { width: pageW - 30, lineGap: 1.5 });
        bodyY += doc.heightOfString(desc, { width: pageW - 30, lineGap: 1.5 }) + 10;

        if (i < estudios.length - 1) {
          doc.strokeColor("#eeeeee").lineWidth(0.5)
             .moveTo(marginL + 10, bodyY).lineTo(marginL + pageW - 10, bodyY).stroke();
          bodyY += 8;
        }
      });
    }

    // ── Firma ────────────────────────────────────────────────────────
    let rowY = Math.max(bodyY + 10, tituloY + 150);
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
      if (tMedico) {
        doc.fillColor(GRAY).fontSize(6.5).font("Helvetica")
           .text(tMedico, firmaX, firmaY + 12, { width: firmaW, align: "center" });
      }
      firmaBottom = firmaY + (tMedico ? 24 : 14);
    }

    // ── Pie de página ────────────────────────────────────────────────
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
    console.error("[estudios/pdf]", e);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/estudios/:id  — con resultados
 */
router.get("/:id", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    await ensureNombreDisplayColumn();

    const [[sol]] = await pool.query(
      `SELECT s.*,
              p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
              u.nombres AS medico_nombres, u.apellidos AS medico_apellidos, u.nombre_display AS medico_nombre_display
       FROM estudios_solicitudes s
       JOIN pacientes p ON p.id = s.paciente_id
       JOIN usuarios  u ON u.id = s.medico_id
       WHERE s.id = ? AND s.clinica_id = ?`,
      [req.params.id, cid]
    );
    if (!sol) return res.status(404).json({ ok: false, msg: "No encontrado" });

    const [resultados] = await pool.query(
      "SELECT * FROM estudios_resultados WHERE solicitud_id = ? AND clinica_id = ?",
      [sol.id, cid]
    );

    res.json({ ok: true, data: { ...sol, resultados } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/estudios
 * Body: { paciente_id, historia_id?, tipo, descripcion, urgente?, firma_digital_url? }
 */
router.post("/", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { paciente_id, historia_id, cita_id, tipo = "LABORATORIO", descripcion, urgente = 0, firma_digital_url } = req.body;
    if (!paciente_id || !descripcion) {
      return res.status(400).json({ ok: false, msg: "paciente_id y descripcion son requeridos" });
    }

    const hasFirmaCol = await hasEstudiosFirmaCol();
    const insertSql = hasFirmaCol
      ? `INSERT INTO estudios_solicitudes (clinica_id, paciente_id, medico_id, historia_id, cita_id, tipo, descripcion, urgente, firma_digital_url)
         VALUES (?,?,?,?,?,?,?,?,?)`
      : `INSERT INTO estudios_solicitudes (clinica_id, paciente_id, medico_id, historia_id, cita_id, tipo, descripcion, urgente)
         VALUES (?,?,?,?,?,?,?,?)`;
    const insertParams = hasFirmaCol
      ? [cid, paciente_id, req.user.id, historia_id || null, cita_id || null, tipo, descripcion, urgente ? 1 : 0, firma_digital_url || null]
      : [cid, paciente_id, req.user.id, historia_id || null, cita_id || null, tipo, descripcion, urgente ? 1 : 0];

    const [r] = await pool.query(insertSql, insertParams);
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PATCH /api/estudios/:id/estado
 */
router.patch("/:id/estado", auth("ADMIN","MEDICO","ENFERMERA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { estado } = req.body;
    const validos = ["SOLICITADO","EN_PROCESO","COMPLETADO","CANCELADO"];
    if (!validos.includes(estado)) return res.status(400).json({ ok: false, msg: "Estado inválido" });

    await pool.query(
      "UPDATE estudios_solicitudes SET estado=? WHERE id=? AND clinica_id=?",
      [estado, req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PATCH /api/estudios/:id/enviar-recepcion
 * El médico envía el estudio a la cola de recepción y notifica a los recepcionistas.
 */
router.patch("/:id/enviar-recepcion", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [[s]] = await pool.query(
      `SELECT s.paciente_id, s.tipo, p.nombres, p.apellidos
       FROM estudios_solicitudes s
       JOIN pacientes p ON p.id = s.paciente_id
       WHERE s.id=? AND s.clinica_id=? LIMIT 1`,
      [req.params.id, cid]
    );
    if (!s) return res.status(404).json({ ok: false, msg: "Estudio no encontrado" });

    await pool.query(
      `UPDATE estudios_solicitudes SET enviado_recepcion_en=NOW()
       WHERE id=? AND clinica_id=? AND enviado_recepcion_en IS NULL`,
      [req.params.id, cid]
    );

    await notificarRecepcionistas(pool, sse, webPush, {
      clinicaId: cid,
      tipo: "ESTUDIO_ENVIADO_RECEPCION",
      mensaje: `Nuevo estudio (${s.tipo}) para ${s.nombres} ${s.apellidos} listo para recepción`,
      pacienteId: s.paciente_id,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/estudios/:id/resultado
 */
router.post("/:id/resultado", auth("ADMIN","MEDICO","ENFERMERA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const solicitudId = req.params.id;

    const {
      nombre_examen, valor_resultado,
      valor_referencia_min, valor_referencia_max,
      unidad, anormal = 0, archivo_url,
    } = req.body;

    const [r] = await pool.query(
      `INSERT INTO estudios_resultados
         (solicitud_id, clinica_id, nombre_examen, valor_resultado,
          valor_referencia_min, valor_referencia_max, unidad, anormal, archivo_url)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        solicitudId, cid,
        nombre_examen || null,
        valor_resultado || null,
        valor_referencia_min || null,
        valor_referencia_max || null,
        unidad || null,
        anormal ? 1 : 0,
        archivo_url || null,
      ]
    );

    await pool.query(
      "UPDATE estudios_solicitudes SET estado='COMPLETADO' WHERE id=? AND clinica_id=?",
      [solicitudId, cid]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
