/**
 * Genera un PDF a partir de un HTML ya armado en el frontend (buildHTML de Plantillas.jsx),
 * para que el documento generado sea visualmente idéntico al preview que ve el doctor.
 */
const router = require("express").Router();
const auth   = require("../middlewares/auth");
const { generarPdfDesdeHtml } = require("../utils/pdfFromHtml");

// POST /api/documentos/generar-pdf
router.post("/generar-pdf", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const { html, paper_size, orientacion, nombre_archivo } = req.body;
    if (!html || typeof html !== "string") {
      return res.status(400).json({ ok: false, msg: "html requerido" });
    }

    const pdfBuffer = await generarPdfDesdeHtml(html, { paper_size, orientacion });

    const nombre = (nombre_archivo || "documento").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${nombre}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error("Error generando PDF:", e);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
