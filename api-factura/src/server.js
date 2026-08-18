const express = require('express');
require('dotenv').config();

const facturaRoutes = require('./routes/facturaRoutes');
const { createDocumentRoutes } = require('../document-renderer/routes');

const app = express();
const API_VERSION = '1.2.0';
const TEMPLATE_VERSION = 'factura-compartida-v1';

const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (process.env.CORS_ALLOW_ALL === 'true') return true;
  if (allowedOrigins.size === 0) return true;
  return allowedOrigins.has(origin);
}

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ALLOW_ALL === 'true' ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origen no permitido' });
    return res.sendStatus(204);
  }

  next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

app.use(express.json({ limit: '2mb' }));

const contrato = {
  servicio: 'API compartida de facturación al cliente',
  version: API_VERSION,
  templateVersion: TEMPLATE_VERSION,
  descripcion: 'Registra una factura, permite recuperarla como JSON y genera un PDF visual de solo lectura.',
  endpoints: {
    crear: 'POST /api/facturas',
    consultarJson: 'GET /api/facturas/:id',
    documentoPdf: 'GET /api/documentos/facturas/:id?formato=pdf',
    actualizarLogo: 'PATCH /api/facturas/:id/logo',
    health: 'GET /health',
    contrato: 'GET /api/contrato',
  },
  consumoPorOtrosServicios: {
    paso1: 'Enviar la factura mediante POST /api/facturas.',
    paso2: 'Guardar el id retornado por el API.',
    paso3: 'Otros servicios pueden recuperar los datos con GET /api/facturas/:id.',
    paso4: 'El comprobante visual se obtiene con GET /api/documentos/facturas/:id?formato=pdf.',
  },
  logo: 'Opcional. Enviar emisor.logoUrl como data URL PNG, JPG o WEBP. El diseño no está amarrado a EduControl ni a otro micrositio.',
};

app.get('/', (req, res) => res.json({ estado: 'activo', ...contrato }));
app.get('/api/contrato', (req, res) => res.json(contrato));
app.get('/health', (req, res) => res.json({ status: 'ok', version: API_VERSION, templateVersion: TEMPLATE_VERSION }));

app.get('/health/documentos', async (req, res) => {
  try {
    const { resolverEjecutable } = require('../document-renderer/browserManager');
    const executablePath = resolverEjecutable();
    res.status(executablePath ? 200 : 503).json({
      status: executablePath ? 'ok' : 'chrome_no_disponible',
      chrome: Boolean(executablePath),
      version: API_VERSION,
      templateVersion: TEMPLATE_VERSION,
    });
  } catch {
    res.status(503).json({ status: 'error', chrome: false, version: API_VERSION, templateVersion: TEMPLATE_VERSION });
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
    console.log(`API compartida de facturación al cliente corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;
