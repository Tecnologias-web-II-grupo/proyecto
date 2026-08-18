const express = require('express');
require('dotenv').config();

const facturaRoutes = require('./routes/facturaRoutes');
const { createDocumentRoutes } = require('../document-renderer/routes');

const app = express();

const allowedOrigins = new Set(
  [
    'https://proyecto-five-ivory.vercel.app',
    ...(process.env.FRONTEND_URL || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ]
);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.vercel.app') &&
      (
        url.hostname === 'proyecto-five-ivory.vercel.app' ||
        url.hostname.startsWith('proyecto-five-ivory-')
      )
    );
  } catch {
    return false;
  }
}

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      return res.status(403).json({ error: 'Origen no permitido' });
    }
    return res.sendStatus(204);
  }

  next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(
      `[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - startedAt}ms`
    );
  });
  next();
});

app.use(express.json({ limit: '2mb' }));


app.get('/', (req, res) => {
  res.json({
    servicio: 'API de Facturación al Cliente',
    estado: 'activo',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      crearFactura: 'POST /api/facturas',
      consultarFactura: 'GET /api/facturas/:id',
      documento: 'GET /api/documentos/facturas/:id (PDF de solo lectura)',
    },
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/health/documentos', async (req, res) => {
  try {
    const { resolverEjecutable } = require('../document-renderer/browserManager');
    const executablePath = resolverEjecutable();
    res.status(executablePath ? 200 : 503).json({
      status: executablePath ? 'ok' : 'chrome_no_disponible',
      chrome: Boolean(executablePath)
    });
  } catch (error) {
    res.status(503).json({ status: 'error', chrome: false });
  }
});
app.use('/api/facturas', facturaRoutes);
app.use('/api/documentos', createDocumentRoutes());

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(err.status || 400).json({
    error: err.status >= 500 ? 'Error interno del servicio' : 'Solicitud inválida',
    detalle: err.message,
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API de Facturación al Cliente corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;
