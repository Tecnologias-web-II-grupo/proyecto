const fs = require('fs');
const puppeteer = require('puppeteer');

function resolverEjecutable() {
  const configurado = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
  if (configurado && fs.existsSync(configurado)) return configurado;

  try {
    const detected = puppeteer.executablePath();
    if (detected && fs.existsSync(detected)) return detected;
  } catch (_) {
    // Se intenta luego con rutas comunes del sistema.
  }

  const rutasComunes = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  return rutasComunes.find((ruta) => fs.existsSync(ruta)) || null;
}

async function generarPdf(html) {
  const executablePath = resolverEjecutable();

  if (!executablePath) {
    throw new Error(
      'Chrome no está instalado para Puppeteer. Ejecute "npx puppeteer browsers install chrome" durante el build.'
    );
  }

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
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: Number(process.env.DOCUMENT_RENDERER_TIMEOUT_MS || 90000),
    });

    await page.emulateMediaType('print');

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generarPdf };
