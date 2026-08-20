require('./react/registerJsx');
const express = require('express');
const { renderApiConsole } = require('./ui/api/ApiConsole.jsx');
require('dotenv').config();

const facturaRoutes = require('./routes/facturaRoutes');
const { asegurarEsquemaCompartido } = require('./controllers/facturaController');
const { createDocumentRoutes } = require('../document-renderer/routes');
const { calentarNavegador, obtenerEstadoBrowser, cerrarBrowser } = require('../document-renderer/browserManager');
const { obtenerEstadoRenderer } = require('../document-renderer/pdfRenderer');

const app = express();
const API_VERSION = '2.9.0';
const TEMPLATE_VERSION = 'factura-v44-react-readable-clean-v15';

const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

// Este API se diseñó para ser consumido por varios proyectos. Por defecto es
// público a nivel CORS; quien quiera restringirlo puede usar CORS_ALLOW_ALL=false
// y declarar FRONTEND_URL con una lista separada por comas.
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (String(process.env.CORS_ALLOW_ALL || 'true').toLowerCase() !== 'false') return true;
  if (allowedOrigins.size === 0) return false;
  return allowedOrigins.has(origin);
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', String(process.env.CORS_ALLOW_ALL || 'true').toLowerCase() !== 'false' ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Api-Key, X-Request-Id');
    res.setHeader('Access-Control-Expose-Headers', 'Retry-After, X-Idempotent-Replay');
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
  descripcion: 'Registra y consulta facturas y genera un comprobante PDF visual de solo lectura, con perfil opcional v44-visual para validar y mostrar información fiscal ampliada.',
  endpoints: {
    crear: 'POST /api/facturas',
    listar: 'GET /api/facturas?origen=&referenciaExterna=&limit=&offset=',
    consultarJson: 'GET /api/facturas/:id',
    documentoPdf: 'GET /api/documentos/facturas/:id?formato=pdf&plantilla=auto|educontrol|generica',
    actualizarLogo: 'PATCH /api/facturas/:id/logo (logo principal y/o logo blanco; JSON data URL o multipart/form-data)',
    health: 'GET /health',
    healthDocumentos: 'GET /health/documentos',
    contrato: 'GET /api/contrato',
  },
  interoperabilidad: {
    origen: 'Identificador opcional del sistema cliente, por ejemplo educontrol.',
    referenciaExterna: 'Referencia opcional e idempotente del cliente, por ejemplo cargo:42.',
    logo: 'Opcional. Admite dos variantes: emisor.logoUrl / archivo logo para fondos claros y emisor.logoUrlBlanco / archivo logoBlanco para el encabezado oscuro. PNG/JPG/WEBP, máximo 500 KB por variante.',
    plantillaPdf: 'auto usa EduControl cuando origen=educontrol; para otros sistemas usa la plantilla genérica. Ambas plantillas muestran los campos fiscales ampliados cuando se envían.',
    perfilV44Visual: 'En POST /api/facturas use perfilValidacion=v44-visual para exigir el conjunto ampliado de campos del comprobante visual. No genera XML ni firma digital.',
  },
};

app.get('/', (req, res) => res.type('html').send(renderApiConsole(contrato)));
app.get('/docs', (req, res) => res.type('html').send(renderApiConsole(contrato)));
app.get('/api/contrato', (req, res) => res.json(contrato));
app.get('/health', (req, res) => res.json({ status: 'ok', version: API_VERSION, templateVersion: TEMPLATE_VERSION }));
app.get('/health/documentos', (req, res) => {
  const browser = obtenerEstadoBrowser();
  const renderer = obtenerEstadoRenderer();
  res.status(browser.chrome ? 200 : 503).json({
    status: browser.chrome ? 'ok' : 'chrome_no_disponible',
    version: API_VERSION,
    templateVersion: TEMPLATE_VERSION,
    ...browser,
    renderer,
  });
});

app.use('/api/facturas', facturaRoutes);
app.use('/api/documentos', createDocumentRoutes());

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  const status = Number(err.status) || 400;
  if (status === 503) res.set('Retry-After', '2');
  res.status(status).json({
    error: status >= 500 ? 'Error interno del servicio' : 'Solicitud inválida',
    detalle: err.message,
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`API compartida de facturación corriendo en el puerto ${PORT}`);
    Promise.allSettled([asegurarEsquemaCompartido(), calentarNavegador()]);
  });

  const cerrar = async () => {
    server.close(async () => {
      await cerrarBrowser().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.once('SIGTERM', cerrar);
  process.once('SIGINT', cerrar);
}

module.exports = app;
