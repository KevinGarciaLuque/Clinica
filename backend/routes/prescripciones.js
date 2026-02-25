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
 * Genera y devuelve la receta en PDF con código QR.
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

    // 2. Generar imagen QR como buffer PNG
    const qrBuffer = await QRCode.toBuffer(pr.codigo_qr, {
      type:  "png",
      width: 120,
      margin: 1,
    });

    // 3. Construir PDF
    const doc = new PDFDoc({ size: "LETTER", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="receta-${pr.id}.pdf"`
    );
    doc.pipe(res);

    const pageW = doc.page.width - 100; // margen 50 a c/lado
    const BLUE  = "#1a4fa0";
    const GRAY  = "#555555";

    // ── Encabezado ──────────────────────────────────────────────────
    doc.rect(50, 40, pageW, 70).fill(BLUE);
    doc.fillColor("white")
       .fontSize(18).font("Helvetica-Bold")
       .text(pr.clinica_nombre || "Clínica", 60, 52, { width: pageW - 130 });
    doc.fontSize(9).font("Helvetica")
       .text(pr.clinica_direccion || "", 60, 76, { width: pageW - 130 })
       .text(pr.clinica_telefono ? `Tel: ${pr.clinica_telefono}` : "", 60, 88);

    // QR en esquina superior derecha
    doc.image(qrBuffer, 50 + pageW - 105, 45, { width: 60, height: 60 });

    doc.fillColor(BLUE).fontSize(8).font("Helvetica")
       .text(`Cód: ${pr.codigo_qr}`, 50 + pageW - 115, 109, { width: 75, align: "center" });

    // ── Título ──────────────────────────────────────────────────────
    doc.moveDown(0.5);
    doc.fillColor(BLUE).fontSize(13).font("Helvetica-Bold")
       .text("RECETA MÉDICA", 50, 122, { align: "center", width: pageW });

    // ── Datos del paciente y médico ─────────────────────────────────
    const infoY = 148;
    doc.rect(50, infoY, pageW, 56).fill("#f0f4ff");

    doc.fillColor(BLUE).fontSize(8).font("Helvetica-Bold")
       .text("PACIENTE", 60, infoY + 6);
    doc.fillColor("#111").fontSize(10).font("Helvetica-Bold")
       .text(`${pr.pac_nombres} ${pr.pac_apellidos}`, 60, infoY + 17);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica")
       .text(
         `DNI: ${pr.dni || "—"}  |  F.Nac: ${pr.fecha_nacimiento ? new Date(pr.fecha_nacimiento).toLocaleDateString("es-PE") : "—"}`,
         60, infoY + 31
       )
       .text(`Estado: ${pr.estado}`, 60, infoY + 43);

    const midX = 50 + pageW / 2 + 10;
    doc.fillColor(BLUE).fontSize(8).font("Helvetica-Bold")
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
    doc.rect(50, tableTop, pageW, 18).fill(BLUE);
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
    doc.text("Medicamento",  cols.med,  tableTop + 5, { width: colW.med  });
    doc.text("Dosis",        cols.dosis, tableTop + 5, { width: colW.dosis });
    doc.text("Duración",     cols.dur,   tableTop + 5, { width: colW.dur  });
    doc.text("Cantidad",     cols.cant,  tableTop + 5, { width: colW.cant });
    doc.text("Instrucciones",cols.inst,  tableTop + 5, { width: colW.inst });

    let rowY = tableTop + 20;
    items.forEach((item, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f7f9ff";
      doc.rect(50, rowY, pageW, 22).fill(bg);
      doc.fillColor("#111").fontSize(8).font("Helvetica");
      const med = item.medicamento_nombre + (item.presentacion ? ` (${item.presentacion})` : "");
      doc.text(med,                    cols.med,  rowY + 5, { width: colW.med,   ellipsis: true });
      doc.text(item.dosis       || "—", cols.dosis,rowY + 5, { width: colW.dosis });
      doc.text(item.duracion    || "—", cols.dur,  rowY + 5, { width: colW.dur  });
      doc.text(item.cantidad    || "—", cols.cant, rowY + 5, { width: colW.cant });
      doc.text(item.instrucciones || "—", cols.inst, rowY + 5, { width: colW.inst, ellipsis: true });
      rowY += 22;

      // Si la fila tiene instrucciones largas o nombre largo, agrega 2da línea
      if (item.instrucciones && item.instrucciones.length > 45) {
        doc.rect(50, rowY, pageW, 14).fill(bg);
        doc.fillColor(GRAY).fontSize(7.5).font("Helvetica-Oblique")
           .text(item.instrucciones, cols.inst, rowY + 2, { width: colW.inst * 2 });
        rowY += 14;
      }
    });

    doc.rect(50, tableTop, pageW, rowY - tableTop).stroke(BLUE);

    // ── Notas ───────────────────────────────────────────────────────
    if (pr.notas) {
      const notasY = rowY + 16;
      doc.fillColor(BLUE).fontSize(8).font("Helvetica-Bold").text("Indicaciones adicionales:", 50, notasY);
      doc.fillColor(GRAY).fontSize(9).font("Helvetica-Oblique")
         .text(pr.notas, 50, notasY + 13, { width: pageW });
      rowY = notasY + 30 + Math.ceil(pr.notas.length / 90) * 12;
    }

    // ── Firma ───────────────────────────────────────────────────────
    const firmaY = Math.max(rowY + 40, doc.page.height - 130);
    doc.moveTo(50 + pageW - 200, firmaY).lineTo(50 + pageW, firmaY).stroke(GRAY);
    doc.fillColor(GRAY).fontSize(8).font("Helvetica")
       .text(`Dr(a). ${pr.med_nombres} ${pr.med_apellidos}`, 50 + pageW - 200, firmaY + 4, { width: 200, align: "center" })
       .text(pr.especialidad || "Médico", 50 + pageW - 200, firmaY + 16, { width: 200, align: "center" });

    // ── Pie de página ───────────────────────────────────────────────
    doc.rect(50, doc.page.height - 50, pageW, 24).fill("#e8eef8");
    doc.fillColor(GRAY).fontSize(7.5).font("Helvetica")
       .text(
         `Receta N° ${String(pr.id).padStart(6, "0")}  ·  ${pr.clinica_nombre}  ·  Válida 30 días desde emisión  ·  Cód. verificación: ${pr.codigo_qr}`,
         55, doc.page.height - 43, { width: pageW - 10, align: "center" }
       );

    doc.end();
  } catch (e) {
    console.error("PDF error:", e);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
