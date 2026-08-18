const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, '..', 'node_modules', '.puppeteer_cache');
process.env.PUPPETEER_CACHE_DIR = cacheDir;
fs.mkdirSync(cacheDir, { recursive: true });

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npx,
  ['puppeteer', 'browsers', 'install', 'chrome'],
  {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: cacheDir,
    },
    stdio: 'inherit',
  }
);

if (result.error) {
  console.error('[puppeteer] No se pudo ejecutar la instalación de Chrome:', result.error.message);
  process.exit(1);
}

if ((result.status ?? 1) !== 0) {
  console.error(`[puppeteer] La instalación de Chrome terminó con código ${result.status}.`);
}

process.exit(result.status ?? 1);
