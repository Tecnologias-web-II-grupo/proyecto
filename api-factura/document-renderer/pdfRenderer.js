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
      ],
    });

    const page = await browser.newPage();

    try {
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
      await page.close().catch(() => {});
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { generarPdf };
