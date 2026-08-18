const { join } = require('path');

module.exports = {
  cacheDirectory: join(__dirname, 'node_modules', '.puppeteer_cache'),
  chrome: {
    skipDownload: false,
  },
};
