const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || path.join(ROOT_DIR, '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;

const puppeteer = require('puppeteer');
let installPromise = null;

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
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entrada of entradas) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        pendientes.push(ruta);
      } else if (nombres.has(entrada.name.toLowerCase()) && existeEjecutable(ruta)) {
        return ruta;
      }
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
  } catch (_) {}

  const cacheado = buscarChromeEnCache();
  if (cacheado) return cacheado;

  const comunes = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  return comunes.find(existeEjecutable) || null;
}

function instalarNavegadores() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(npx, ['puppeteer', 'browsers', 'install'], {
      cwd: ROOT_DIR,
      env: { ...process.env, PUPPETEER_CACHE_DIR: CACHE_DIR },
      stdio: 'inherit',
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('La instalación del navegador excedió el tiempo permitido.'));
    }, 240000);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`No se pudo instalar el navegador para Puppeteer (código ${code}).`));
    });
  });
}

async function asegurarChrome() {
  let executablePath = resolverEjecutable();
  if (executablePath) {
    console.log(`[document-renderer] Chrome: ${executablePath}`);
    return executablePath;
  }

  console.warn(`[document-renderer] No se encontró Chrome en ${CACHE_DIR}. Se intentará instalar.`);

  if (!installPromise) {
    installPromise = instalarNavegadores().finally(() => {
      installPromise = null;
    });
  }

  await installPromise;
  executablePath = resolverEjecutable();

  if (!executablePath) {
    let contenido = 'no disponible';
    try {
      contenido = fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).join(', ') : 'la carpeta no existe';
    } catch (_) {}
    throw new Error(`Chrome no quedó disponible para Puppeteer. Caché: ${CACHE_DIR}. Contenido: ${contenido}`);
  }

  console.log(`[document-renderer] Chrome instalado: ${executablePath}`);
  return executablePath;
}

module.exports = { CACHE_DIR, asegurarChrome, resolverEjecutable };
