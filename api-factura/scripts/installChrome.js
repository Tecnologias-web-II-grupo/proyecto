const path = require('path');
const { spawnSync } = require('child_process');

const cacheDir = path.join(__dirname, '..', 'node_modules', '.puppeteer_cache');
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

process.exit(result.status ?? 1);
