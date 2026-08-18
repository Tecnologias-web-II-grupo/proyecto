const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CACHE_DIR = path.join(__dirname, '..', 'node_modules', '.puppeteer_cache');
if (!process.env.PUPPETEER_CACHE_DIR) {
  process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;
}

const puppeteer = require('puppeteer');

let installPromise = null;

function resolverEjecutable() {
  const configurado = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
  if (configurado && fs.existsSync(configurado)) return configurado;

  try {
    const detected = puppeteer.executablePath();
    if (detected && fs.existsSync(detected)) return detected;
  } catch (_) {}

  const comunes = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  return comunes.find((ruta) => fs.existsSync(ruta)) || null;
}

function instalarChrome() {
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
