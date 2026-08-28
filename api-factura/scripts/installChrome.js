const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || path.join(ROOT_DIR, '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;
fs.mkdirSync(CACHE_DIR, { recursive: true });

console.log(`[puppeteer] Caché: ${CACHE_DIR}`);

// Ejecutar la CLI con Node evita depender de npx.cmd. En Windows, algunas
// versiones de Node no pueden iniciar directamente archivos .cmd y responden
// con spawnSync EINVAL aunque npx esté correctamente instalado.
const puppeteerEntry = require.resolve('puppeteer');
const puppeteerCli = path.join(path.dirname(puppeteerEntry), 'node', 'cli.js');
const result = spawnSync(
  process.execPath,
  [puppeteerCli, 'browsers', 'install', 'chrome'],
  {
    cwd: ROOT_DIR,
    env: { ...process.env, PUPPETEER_CACHE_DIR: CACHE_DIR },
    stdio: 'inherit',
  }
);

if (result.error) {
  console.error('[puppeteer] No se pudo ejecutar la instalación:', result.error.message);
  process.exit(1);
}

if ((result.status ?? 1) !== 0) {
  console.error(`[puppeteer] La instalación terminó con código ${result.status}.`);
  process.exit(result.status ?? 1);
}

try {
  const puppeteer = require('puppeteer');
  // Puppeteer 25 puede resolver esta ruta de forma asíncrona.
  Promise.resolve(puppeteer.executablePath()).then((executablePath) => {
    console.log(`[puppeteer] Ejecutable esperado: ${executablePath}`);
  });
} catch (error) {
  console.error('[puppeteer] No se pudo resolver el ejecutable después de instalar:', error.message);
  process.exit(1);
}
