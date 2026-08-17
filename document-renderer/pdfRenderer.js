const puppeteer = require('puppeteer');

async function generarPdf(html, launch = puppeteer.launch) {
  let browser;
  let page;
  try {
    browser = await launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  } finally {
    // Cada solicitud libera su página y navegador incluso cuando falla la conversión.
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { generarPdf };
