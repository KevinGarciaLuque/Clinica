/**
 * Genera un PDF a partir de un HTML ya armado en el frontend (buildHTML de Plantillas.jsx),
 * para que el documento generado sea visualmente idéntico al preview que ve el doctor.
 */
const router = require("express").Router();
const auth   = require("../middlewares/auth");
const fs     = require("fs");

// @sparticuz/chromium empaqueta un binario de Linux (pensado para el contenedor
// de Railway). En desarrollo local sobre Windows no hay binario compatible, así
// que si existe un Chrome/Edge instalado en la máquina se usa ese en su lugar.
const WINDOWS_BROWSER_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

let browserPromise = null;
async function getBrowser() {
  // Si el navegador previamente lanzado murio o se desconecto (ej. se cerro Chrome
  // manualmente), descartar la instancia cacheada y relanzar una nueva.
  if (browserPromise) {
    const cached = await browserPromise.catch(() => null);
    if (!cached || !cached.connected) browserPromise = null;
  }

  if (!browserPromise) {
    const puppeteer = require("puppeteer-core");

    const localBrowser = process.platform === "win32"
      ? WINDOWS_BROWSER_PATHS.find((p) => fs.existsSync(p))
      : null;

    const launchOpts = localBrowser
      ? { executablePath: localBrowser, headless: true }
      : await (async () => {
          const chromium = require("@sparticuz/chromium").default;
          return {
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless ?? true,
          };
        })();

    browserPromise = puppeteer.launch(launchOpts).catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}

// Mismo mapeo de tamaños de papel que getPaper() en frontend/src/pages/admin/Plantillas.jsx
const PAPER_SIZES = {
  LETTER:      { w: 8.5,  h: 11 },
  HALF_LETTER: { w: 5.5,  h: 8.5 },
  LEGAL:       { w: 8.5,  h: 14 },
  A4:          { w: 8.27, h: 11.69 },
};

function getPaperInches(size, orientacion) {
  const p = PAPER_SIZES[String(size || "LETTER").toUpperCase()] || PAPER_SIZES.LETTER;
  const landscape = orientacion === "landscape";
  return {
    width:  `${landscape ? p.h : p.w}in`,
    height: `${landscape ? p.w : p.h}in`,
  };
}

// POST /api/documentos/generar-pdf
router.post("/generar-pdf", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  let page;
  try {
    const { html, paper_size, orientacion, nombre_archivo } = req.body;
    if (!html || typeof html !== "string") {
      return res.status(400).json({ ok: false, msg: "html requerido" });
    }

    const { width, height } = getPaperInches(paper_size, orientacion);

    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      width, height,
      printBackground: true,
      margin: { top: "0in", bottom: "0in", left: "0in", right: "0in" },
    });

    const nombre = (nombre_archivo || "documento").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${nombre}.pdf"`);
    // page.pdf() puede devolver Uint8Array (no Buffer) segun la version de puppeteer;
    // sin este wrap, res.send lo serializa como JSON en vez de bytes binarios.
    res.send(Buffer.from(pdfBuffer));
  } catch (e) {
    console.error("Error generando PDF:", e);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: e.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

module.exports = router;
