const puppeteer = require('puppeteer');

function launchOptions() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  };
}

async function generarPdf(html, launch = puppeteer.launch) {
  let browser;
  let page;

  try {
    browser = await launch(launchOptions());
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.emulateMediaType('print');

    return Buffer.from(await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    }));
  } catch (error) {
    if (/Could not find Chrome|Browser was not found|executable/i.test(String(error?.message || ''))) {
      const wrapped = new Error(
        'Chrome no está instalado para Puppeteer. En Render ejecuta npm install con el postinstall del proyecto o usa el Build Command: npm install && npx puppeteer browsers install chrome.'
      );
      wrapped.cause = error;
      throw wrapped;
    }
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { generarPdf };
