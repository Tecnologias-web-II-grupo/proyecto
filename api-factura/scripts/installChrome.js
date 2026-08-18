const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || path.join(ROOT_DIR, '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;
fs.mkdirSync(CACHE_DIR, { recursive: true });

console.log(`[puppeteer] Caché: ${CACHE_DIR}`);

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npx,
  ['puppeteer', 'browsers', 'install'],
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
  console.log(`[puppeteer] Ejecutable esperado: ${puppeteer.executablePath()}`);
} catch (error) {
  console.error('[puppeteer] No se pudo resolver el ejecutable después de instalar:', error.message);
  process.exit(1);
}
