const crypto = require('crypto');
const { obtenerBrowser, cerrarBrowser } = require('./browserManager');

const MAX_CONCURRENCY = Math.min(Math.max(Number(process.env.PDF_MAX_CONCURRENCY || 1), 1), 4);
const MAX_QUEUE = Math.min(Math.max(Number(process.env.PDF_MAX_QUEUE || 100), 10), 300);
const CACHE_TTL_MS = Math.max(Number(process.env.PDF_CACHE_TTL_MS || 5 * 60 * 1000), 0);
const CACHE_MAX = Math.min(Math.max(Number(process.env.PDF_CACHE_MAX || 40), 5), 200);

let activos = 0;
const cola = [];
const cache = new Map();
const enCurso = new Map();

function hashHtml(html) {
  return crypto.createHash('sha256').update(html).digest('hex');
}

function leerCache(clave) {
  if (!CACHE_TTL_MS) return null;
  const entry = cache.get(clave);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(clave);
    return null;
  }
  cache.delete(clave);
  cache.set(clave, entry);
  return entry.buffer;
}

function guardarCache(clave, buffer) {
  if (!CACHE_TTL_MS) return;
  cache.set(clave, { ts: Date.now(), buffer });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function adquirirSlot() {
  if (activos < MAX_CONCURRENCY) {
    activos += 1;
    return Promise.resolve();
  }
  if (cola.length >= MAX_QUEUE) {
    const error = new Error('El generador PDF alcanzó temporalmente su capacidad.');
    error.status = 503;
    error.code = 'CAPACIDAD_PDF';
    throw error;
  }
  return new Promise((resolve) => cola.push(resolve)).then(() => { activos += 1; });
}

function liberarSlot() {
  activos = Math.max(0, activos - 1);
  const siguiente = cola.shift();
  if (siguiente) siguiente();
}

function errorRecuperableDeBrowser(error) {
  const texto = String(error?.message || error || '').toLowerCase();
  return [
    'target closed',
    'browser has disconnected',
    'session closed',
    'connection closed',
    'protocol error',
    'most likely the page has been closed'
  ].some((fragmento) => texto.includes(fragmento));
}

async function renderPdfUnaVez(html) {
  let page;
  try {
    const browser = await obtenerBrowser();
    page = await browser.newPage();
    const timeoutMs = Number(process.env.DOCUMENT_RENDERER_TIMEOUT_MS || 45000);
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    await page.evaluate(async () => {
      const images = Array.from(document.images || []);
      await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          const timeout = setTimeout(resolve, 2500);
          const terminar = () => { clearTimeout(timeout); resolve(); };
          img.addEventListener('load', terminar, { once: true });
          img.addEventListener('error', terminar, { once: true });
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
    if (page) await page.close().catch(() => {});
  }
}

async function renderPdf(html) {
  await adquirirSlot();
  try {
    try {
      return await renderPdfUnaVez(html);
    } catch (error) {
      if (!errorRecuperableDeBrowser(error)) throw error;
      console.warn('[document-renderer] Reiniciando Chrome después de un fallo recuperable:', error.message);
      await cerrarBrowser().catch(() => {});
      return await renderPdfUnaVez(html);
    }
  } finally {
    liberarSlot();
  }
}

async function generarPdf(html) {
  const clave = hashHtml(html);
  const cached = leerCache(clave);
  if (cached) return cached;
  if (enCurso.has(clave)) return enCurso.get(clave);

  const tarea = renderPdf(html)
    .then((buffer) => {
      guardarCache(clave, buffer);
      return buffer;
    })
    .finally(() => enCurso.delete(clave));

  enCurso.set(clave, tarea);
  return tarea;
}

function obtenerEstadoRenderer() {
  return {
    activos,
    enCola: cola.length,
    maxConcurrentes: MAX_CONCURRENCY,
    capacidadCola: MAX_QUEUE,
    cacheEntradas: cache.size,
    documentosEnCurso: enCurso.size,
  };
}

module.exports = { generarPdf, obtenerEstadoRenderer };
