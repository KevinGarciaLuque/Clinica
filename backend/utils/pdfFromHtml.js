/**
 * utils/pdfFromHtml.js
 * Motor compartido de generación de PDF a partir de HTML (puppeteer-core).
 * Extraído de routes/documentosPdf.js para que otros módulos (ej. facturación)
 * puedan generar PDFs sin duplicar el manejo del navegador headless.
 */
const fs = require("fs");

const WINDOWS_BROWSER_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

let browserPromise = null;
async function getBrowser() {
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

/**
 * @returns {Promise<Buffer>} buffer del PDF generado
 */
async function generarPdfDesdeHtml(html, { paper_size, orientacion } = {}) {
  const { width, height } = getPaperInches(paper_size, orientacion);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      width, height,
      printBackground: true,
      margin: { top: "0in", bottom: "0in", left: "0in", right: "0in" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { getBrowser, getPaperInches, generarPdfDesdeHtml };
