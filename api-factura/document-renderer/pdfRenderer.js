const path = require('path');

// Esta variable debe existir antes de cargar Puppeteer. En Render, si Puppeteer
// se carga primero puede memorizar ~/.cache/puppeteer y luego no encontrar el
// Chrome instalado durante el build.
if (!process.env.PUPPETEER_CACHE_DIR) {
  process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '..', '.cache', 'puppeteer');
}

const puppeteer = require('puppeteer');
const { asegurarChrome } = require('./browserManager');

async function generarPdf(html) {
  const executablePath = await asegurarChrome();
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });

    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: Number(process.env.DOCUMENT_RENDERER_TIMEOUT_MS || 90000),
      });

      // Espera imágenes incrustadas (incluido el logo) antes de imprimir.
      await page.evaluate(async () => {
        const images = Array.from(document.images || []);
        await Promise.all(images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        }));
      });

      await page.emulateMediaType('print');

      return await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        tagged: true,
      });
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { generarPdf };
