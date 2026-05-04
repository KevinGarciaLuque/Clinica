/**
 * MÓDULO 5 — Prescripción Digital
 */
const router  = require("express").Router();
const pool    = require("../db");
const auth    = require("../middlewares/auth");
const crypto  = require("crypto");
const PDFDoc  = require("pdfkit");
const QRCode  = require("qrcode");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

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
 * Body: { historia_id?, cita_id?, paciente_id, notas?, items: [{medicamento_id?, medicamento_texto?, dosis, duracion, cantidad, instrucciones}] }
 */
router.post("/", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let cid = clinicaOf(req);

    const { historia_id, cita_id, paciente_id, notas, items = [] } = req.body;
    if (!paciente_id) throw new Error("paciente_id requerido");
    if (!items.length)  throw new Error("Debe incluir al menos un medicamento");

    // Si es SUPER_ADMIN sin clinica_id, derivarlo del paciente
    if (!cid) {
      const [[pac]] = await conn.query("SELECT clinica_id FROM pacientes WHERE id = ? LIMIT 1", [paciente_id]);
      if (!pac) throw new Error("Paciente no encontrado");
      cid = pac.clinica_id;
    }

    const codigo_qr = crypto.randomBytes(8).toString("hex").toUpperCase();

    const [r] = await conn.query(
      `INSERT INTO prescripciones (clinica_id, historia_id, cita_id, paciente_id, medico_id, codigo_qr, notas)
       VALUES (?,?,?,?,?,?,?)`,
      [cid, historia_id || null, cita_id || null, paciente_id, req.user.id, codigo_qr, notas || null]
    );
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
    const [[pr]] = await pool.query(
      `SELECT pr.*,
              p.nombres   AS pac_nombres,   p.apellidos   AS pac_apellidos,
              p.fecha_nacimiento,           p.dni,
              u.nombres   AS med_nombres,   u.apellidos   AS med_apellidos,
              u.numero_colegiatura,
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

    // 2. Buscar plantilla predeterminada
    let tpl = null;
    const [tplRows] = await pool.query(
      `SELECT contenido FROM plantillas_documentos WHERE clinica_id=? AND tipo='receta' AND es_predeterminada=1 AND activo=1 LIMIT 1`,
      [pr.clinica_id]
    );
    if (tplRows.length) {
      try { tpl = JSON.parse(tplRows[0].contenido); } catch { tpl = null; }
    }

    // 3. Generar imagen QR como buffer PNG
    const qrCode = pr.codigo_qr || `RX-${String(pr.id).padStart(8, "0")}`;
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const qrText  = `${baseUrl}/rx/${qrCode}`;
    const qrBuffer = await QRCode.toBuffer(qrText, {
      type:  "png",
      width: 120,
      margin: 1,
    });

    // 4. Configurar valores del template o defaults
    const tColor      = tpl?.color || "#1a2744";
    const tTextColor  = tpl?.header_text_color || "#ffffff";
    const tClinica    = tpl?.clinica || pr.clinica_nombre;
    const tMedico     = tpl?.medico || `Dr(a). ${pr.med_nombres} ${pr.med_apellidos}`;
    const tCred       = tpl?.credenciales || (pr.numero_colegiatura ? `Col. ${pr.numero_colegiatura}` : "") || pr.especialidad || "";
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
      "Brush Script MT": "Times-Roman",
      "Segoe Script": "Helvetica",
      "Gabriola": "Times-Roman",
      "Kristen ITC": "Helvetica",
      "Lucida Handwriting": "Times-Roman",
      "Vladimir Script": "Times-Roman",
      "Edwardian Script ITC": "Times-Roman",
      "Lucida Console": "Courier",
      "Comic Sans MS": "Helvetica",
    };

    const getClinicaFont = () => {
      const f = tpl?.clinica_font || "Arial, Helvetica, sans-serif";
      const base = f.split(",")[0].replace(/['"]/g, "").trim();
      const pdfFont = fontMap[base] || "Helvetica";
      return {
        normal: pdfFont,
        bold: pdfFont === "Courier" ? "Courier-Bold" : pdfFont === "Times-Roman" ? "Times-Bold" : "Helvetica-Bold",
      };
    };

    const getMedicoFont = () => {
      const f = tpl?.medico_font || "Arial, Helvetica, sans-serif";
      const base = f.split(",")[0].replace(/['"]/g, "").trim();
      const pdfFont = fontMap[base] || "Helvetica";
      return {
        normal: pdfFont,
        bold: pdfFont === "Courier" ? "Courier-Bold" : pdfFont === "Times-Roman" ? "Times-Bold" : "Helvetica-Bold",
      };
    };

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
        }
      } catch { logoBuffer = null; }
    }

    // 5. Construir PDF
    const doc = new PDFDoc({ size: "LETTER", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="receta-${pr.id}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width - 100;
    const marginL = 50;
    const GRAY = "#555555";

    // ── Encabezado con color del template ──────────────────────────
    const headerH = logoBuffer ? 80 : 70;
    doc.rect(marginL, 40, pageW, headerH).fill(tColor);

    const clinicaFonts = getClinicaFont();
    const clinicaFontSize = parseFloat(tpl?.clinica_font_size) || 1.25;
    const medicoFonts = getMedicoFont();
    const medicoFontSize = parseFloat(tpl?.medico_font_size) || 0.85;

    let headerTextX = 60;
    let headerTextW = pageW - 130;

    if (logoBuffer) {
      // Logo a la izquierda
      doc.image(logoBuffer, 55, 42, { width: 55, fit: [55, 70] });
      headerTextX = 120;
      headerTextW = pageW - 180;
    }

    doc.fillColor(tTextColor)
       .fontSize(clinicaFontSize * 14).font(clinicaFonts.bold)
       .text(tClinica || "", headerTextX, 48, { width: headerTextW });

    doc.fontSize(medicoFontSize * 11).font(medicoFonts.normal)
       .text(tMedico, headerTextX, 48 + (clinicaFontSize * 14) + 2, { width: headerTextW });

    if (tCred) {
      const credY = 48 + (clinicaFontSize * 14) + 2 + (medicoFontSize * 11) + 4;
      doc.fillColor(tTextColor + "bf").fontSize(8).font("Helvetica")
         .text(tCred, headerTextX, credY, { width: headerTextW });
    }

    // QR en esquina superior derecha
    const qrX = marginL + pageW - 70;
    doc.image(qrBuffer, qrX, 45, { width: 60, height: 60 });
    doc.fillColor(tTextColor).fontSize(8).font("Helvetica")
       .text(`Cód: ${qrCode}`, qrX - 5, 109, { width: 75, align: "center" });

    // ── Título ──────────────────────────────────────────────────────
    const titleY = 40 + headerH + 12;
    doc.fillColor(tColor).fontSize(13).font("Helvetica-Bold")
       .text("RECETA MÉDICA", marginL, titleY, { align: "center", width: pageW });

    // ── Datos del paciente y médico ─────────────────────────────────
    const infoY = titleY + 22;
    doc.rect(marginL, infoY, pageW, 56).fill("#f0f4ff");

    doc.fillColor(tColor).fontSize(8).font("Helvetica-Bold")
       .text("PACIENTE", marginL + 10, infoY + 6);
    doc.fillColor("#111").fontSize(10).font("Helvetica-Bold")
       .text(`${pr.pac_nombres} ${pr.pac_apellidos}`, marginL + 10, infoY + 17);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica")
       .text(
         `DNI: ${pr.dni || "—"}  |  F.Nac: ${pr.fecha_nacimiento ? new Date(pr.fecha_nacimiento).toLocaleDateString("es-PE") : "—"}`,
         marginL + 10, infoY + 31
       )
       .text(`Estado: ${pr.estado}`, marginL + 10, infoY + 43);

    const midX = marginL + pageW / 2 + 10;
    doc.fillColor(tColor).fontSize(8).font("Helvetica-Bold")
       .text("MÉDICO PRESCRIPTOR", midX, infoY + 6);
    doc.fillColor("#111").fontSize(10).font("Helvetica-Bold")
       .text(`Dr(a). ${pr.med_nombres} ${pr.med_apellidos}`, midX, infoY + 17);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica")
       .text(pr.especialidad || "", midX, infoY + 31)
       .text(`Fecha: ${new Date(pr.creado_en).toLocaleDateString("es-PE")}`, midX, infoY + 43);

    // ── Tabla de medicamentos ───────────────────────────────────────
    const tableTop = infoY + 66;
    const cols = { med: 60, dosis: 220, dur: 320, cant: 400, inst: 455 };
    const colW = { med: 155, dosis: 95, dur: 75, cant: 50, inst: pageW - 405 };

    // Cabecera tabla
    doc.rect(marginL, tableTop, pageW, 18).fill(tColor);
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
    doc.text("Medicamento",  cols.med,  tableTop + 5, { width: colW.med  });
    doc.text("Dosis",        cols.dosis, tableTop + 5, { width: colW.dosis });
    doc.text("Duración",     cols.dur,   tableTop + 5, { width: colW.dur  });
    doc.text("Cantidad",     cols.cant,  tableTop + 5, { width: colW.cant });
    doc.text("Instrucciones",cols.inst,  tableTop + 5, { width: colW.inst });

    let rowY = tableTop + 20;
    items.forEach((item, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f7f9ff";
      const med = item.medicamento_nombre + (item.presentacion ? ` (${item.presentacion})` : "");
      const inst = item.instrucciones || "—";
      
      doc.fontSize(8).font("Helvetica");
      const medHeight = doc.heightOfString(med, { width: colW.med });
      const instHeight = doc.heightOfString(inst, { width: colW.inst });
      const rowHeight = Math.max(18, medHeight + 10, instHeight + 10);
      
      doc.rect(marginL, rowY, pageW, rowHeight).fill(bg);
      doc.fillColor("#111").fontSize(8).font("Helvetica");
      
      doc.text(med,                     cols.med,  rowY + 5, { width: colW.med });
      doc.text(item.dosis       || "—", cols.dosis,rowY + 5, { width: colW.dosis });
      doc.text(item.duracion    || "—", cols.dur,  rowY + 5, { width: colW.dur  });
      doc.text(item.cantidad    || "—", cols.cant, rowY + 5, { width: colW.cant });
      doc.text(inst,                    cols.inst, rowY + 5, { width: colW.inst });
      
      rowY += rowHeight;
    });

    doc.rect(marginL, tableTop, pageW, rowY - tableTop).stroke(tColor);

    // ── Notas ───────────────────────────────────────────────────────
    if (pr.notas) {
      const notasY = rowY + 16;
      doc.fillColor(tColor).fontSize(8).font("Helvetica-Bold").text("Indicaciones adicionales:", marginL, notasY);
      doc.fillColor(GRAY).fontSize(9).font("Helvetica-Oblique")
         .text(pr.notas, marginL, notasY + 13, { width: pageW });
      rowY = notasY + 30 + Math.ceil(pr.notas.length / 90) * 12;
    }

    // ── Horarios de atención ───────────────────────────────────────
    if (tMostrarHorarios) {
      const horariosY = rowY + 16;
      doc.moveTo(marginL, horariosY).lineTo(marginL + pageW, horariosY).stroke("#e0e0e0");
      
      doc.fillColor(tColor).fontSize(9).font("Helvetica-Bold")
         .text("Horarios de Atención", marginL, horariosY + 6);
      
      let hY = horariosY + 20;
      tHorarios.forEach(h => {
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#374151")
           .text(h.dias, marginL, hY, { width: 140 });
        doc.fontSize(8).font("Helvetica").fillColor("#555")
           .text(h.horario, marginL + 140, hY, { width: 120 });
        hY += 14;
        
        // Línea punteada visual
        doc.moveTo(marginL, hY - 2).lineTo(marginL + pageW, hY - 2).dash(2, { space: 3 }).stroke("#e0e0e0");
      });
      
      rowY = hY + 10;
    }

    // ── Firma ───────────────────────────────────────────────────────
    if (tFirma) {
      const firmaY = Math.max(rowY + 40, doc.page.height - 140);
      doc.moveTo(marginL + pageW - 200, firmaY).lineTo(marginL + pageW, firmaY).stroke(GRAY);
      doc.fillColor(GRAY).fontSize(8).font("Helvetica")
         .text(tFirmaLabel, marginL + pageW - 200, firmaY + 4, { width: 200, align: "center" })
         .text(tMedico, marginL + pageW - 200, firmaY + 16, { width: 200, align: "center" });
    }

    // ── Pie de página ───────────────────────────────────────────────
    if (tFooter) {
      doc.rect(marginL, doc.page.height - 50, pageW, 24).fill(tColor);
      doc.fillColor("#ffffff").fontSize(7.5).font("Helvetica")
         .text(tFooter, marginL + 5, doc.page.height - 43, { width: pageW - 10, align: "center" });
    } else {
      doc.rect(marginL, doc.page.height - 50, pageW, 24).fill("#e8eef8");
      doc.fillColor(GRAY).fontSize(7.5).font("Helvetica")
         .text(
           `Receta N° ${String(pr.id).padStart(6, "0")}  ·  ${pr.clinica_nombre}  ·  Válida 30 días desde emisión  ·  Cód. verificación: ${qrCode}`,
           marginL + 5, doc.page.height - 43, { width: pageW - 10, align: "center" }
         );
    }

    doc.end();
  } catch (e) {
    console.error("PDF error:", e);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
