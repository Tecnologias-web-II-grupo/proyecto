const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || path.join(ROOT_DIR, '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;

const puppeteer = require('puppeteer');
let installPromise = null;
let browserPromise = null;
let browserInstance = null;

function existeEjecutable(ruta) {
  try {
    if (!ruta || !fs.existsSync(ruta)) return false;
    fs.accessSync(ruta, fs.constants.R_OK | fs.constants.X_OK);
    return fs.statSync(ruta).isFile();
  } catch {
    return false;
  }
}

function buscarChromeEnCache() {
  if (!fs.existsSync(CACHE_DIR)) return null;
  const nombres = new Set(['chrome', 'google-chrome', 'chromium', 'chrome-headless-shell', 'headless_shell']);
  const pendientes = [CACHE_DIR];
  let visitados = 0;

  while (pendientes.length && visitados < 5000) {
    const dir = pendientes.shift();
    visitados += 1;
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }

    for (const entrada of entradas) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) pendientes.push(ruta);
      else if (nombres.has(entrada.name.toLowerCase()) && existeEjecutable(ruta)) return ruta;
    }
  }
  return null;
}

function resolverEjecutable() {
  const configurado = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
  if (existeEjecutable(configurado)) return configurado;

  try {
    const esperado = puppeteer.executablePath();
    if (existeEjecutable(esperado)) return esperado;
  } catch {}

  const cacheado = buscarChromeEnCache();
  if (cacheado) return cacheado;

  return [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find(existeEjecutable) || null;
}

function instalarNavegadores() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(npx, ['puppeteer', 'browsers', 'install', 'chrome'], {
      cwd: ROOT_DIR,
      env: { ...process.env, PUPPETEER_CACHE_DIR: CACHE_DIR },
      stdio: 'inherit',
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('La instalación del navegador excedió el tiempo permitido.'));
    }, 240000);

    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`No se pudo instalar Chrome para Puppeteer (código ${code}).`));
    });
  });
}

async function asegurarChrome() {
  let executablePath = resolverEjecutable();
  if (executablePath) return executablePath;

  if (!installPromise) {
    installPromise = instalarNavegadores().finally(() => { installPromise = null; });
  }
  await installPromise;

  executablePath = resolverEjecutable();
  if (!executablePath) throw new Error(`Chrome no quedó disponible para Puppeteer. Caché: ${CACHE_DIR}`);
  return executablePath;
}

async function obtenerBrowser() {
  if (browserInstance?.connected) return browserInstance;
  if (browserPromise) return browserPromise;

  browserPromise = (async () => {
    const executablePath = await asegurarChrome();
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--font-render-hinting=none',
      ],
    });

    browserInstance = browser;
    browser.once('disconnected', () => {
      browserInstance = null;
      browserPromise = null;
    });
    console.log(`[document-renderer] Chrome reutilizable iniciado: ${executablePath}`);
    return browser;
  })().finally(() => {
    browserPromise = null;
  });

  return browserPromise;
}

async function calentarNavegador() {
  try {
    const browser = await obtenerBrowser();
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>', { waitUntil: 'domcontentloaded', timeout: 5000 });
    await page.close();
    console.log('[document-renderer] Navegador precalentado.');
    return true;
  } catch (error) {
    console.warn('[document-renderer] No se pudo precalentar Chrome:', error.message);
    return false;
  }
}

async function cerrarBrowser() {
  const browser = browserInstance;
  browserInstance = null;
  browserPromise = null;
  if (browser?.connected) await browser.close().catch(() => {});
}

function obtenerEstadoBrowser() {
  return {
    chrome: Boolean(resolverEjecutable()),
    browserActivo: Boolean(browserInstance?.connected),
    cacheDir: CACHE_DIR,
  };
}

module.exports = {
  CACHE_DIR,
  asegurarChrome,
  resolverEjecutable,
  obtenerBrowser,
  calentarNavegador,
  cerrarBrowser,
  obtenerEstadoBrowser,
};
