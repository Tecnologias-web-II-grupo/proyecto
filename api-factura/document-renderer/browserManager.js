const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// En Render guardamos Chrome dentro del propio proyecto para que el binario
// instalado durante el build siga disponible al arrancar el servicio.
const CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, '..', 'node_modules', '.puppeteer_cache');
process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;

const puppeteer = require('puppeteer');

let installPromise = null;

function existeEjecutable(ruta) {
  try {
    return Boolean(ruta) && fs.existsSync(ruta) && fs.statSync(ruta).isFile();
  } catch {
    return false;
  }
}

function buscarChromeEnCache() {
  if (!fs.existsSync(CACHE_DIR)) return null;

  const candidatos = [];
  const recorrer = (dir, profundidad = 0) => {
    if (profundidad > 6) return;
    let entradas = [];
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entrada of entradas) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta, profundidad + 1);
        continue;
      }

      const nombre = entrada.name.toLowerCase();
      if (['chrome', 'google-chrome', 'chromium', 'chrome-headless-shell'].includes(nombre)) {
        candidatos.push(ruta);
      }
    }
  };

  recorrer(CACHE_DIR);
  return candidatos.find(existeEjecutable) || null;
}

function resolverEjecutable() {
  const configurado = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
  if (existeEjecutable(configurado)) return configurado;

  // Primero buscamos el binario que instalamos explícitamente. Esto evita que
  // puppeteer.executablePath() apunte a ~/.cache/puppeteer mientras Render tiene
  // el navegador en node_modules/.puppeteer_cache.
  const cacheado = buscarChromeEnCache();
  if (cacheado) return cacheado;

  try {
    const detected = puppeteer.executablePath();
    if (existeEjecutable(detected)) return detected;
  } catch (_) {}

  const comunes = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  return comunes.find(existeEjecutable) || null;
}

function instalarChrome() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(
      npx,
      ['puppeteer', 'browsers', 'install', 'chrome'],
      {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          PUPPETEER_CACHE_DIR: CACHE_DIR,
        },
        stdio: 'inherit',
      }
    );

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('La instalación de Chrome excedió el tiempo permitido.'));
    }, 240000);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

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
    installPromise = instalarChrome().finally(() => {
      installPromise = null;
    });
  }

  await installPromise;
  executablePath = resolverEjecutable();

  if (!executablePath) {
    throw new Error(
      `Chrome no quedó disponible para Puppeteer. Caché utilizada: ${CACHE_DIR}`
    );
  }

  return executablePath;
}

module.exports = {
  CACHE_DIR,
  asegurarChrome,
  resolverEjecutable,
};
