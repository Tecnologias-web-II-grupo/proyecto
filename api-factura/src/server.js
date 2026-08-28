require('./react/registerJsx');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { renderApiConsole } = require('./ui/api/ApiConsole.jsx');
require('dotenv').config();

const facturaRoutes = require('./routes/facturaRoutes');
const portalRoutes = require('./routes/portalRoutes');
const { ensurePortalSchema } = require('./portal/schema');
const { asegurarEsquemaCompartido } = require('./controllers/facturaController');
const { ensureFacturaSmartSchema } = require('./services/facturaSmartIntegration');
const { createDocumentRoutes } = require('../document-renderer/routes');
const { calentarNavegador, obtenerEstadoBrowser, cerrarBrowser } = require('../document-renderer/browserManager');
const { obtenerEstadoRenderer } = require('../document-renderer/pdfRenderer');

const app = express();
// Render termina HTTPS en un proxy y envía X-Forwarded-For.
// Confiar en un salto permite que express-rate-limit identifique correctamente la IP real.
app.set('trust proxy', 1);
const API_VERSION = '5.1.0';
const TEMPLATE_VERSION = 'factura-visual-generica-v1';

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
  if (String(process.env.CORS_ALLOW_ALL || 'false').toLowerCase() === 'true') return true;
  if (allowedOrigins.size === 0) return false;
  return allowedOrigins.has(origin);
}

app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes. Intente nuevamente más tarde.',
  },
});
app.use(generalLimiter);
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
  },
});
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
   res.setHeader('Access-Control-Allow-Origin',String(process.env.CORS_ALLOW_ALL || 'false').toLowerCase() === 'true' ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Api-Key, X-Request-Id, X-FacturaSmart-Access-Token, X-FacturaSmart-Base-Url');
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
  descripcion: 'Servicio especializado de factura visual PDF. Los sistemas clientes crean comprobantes por API REST y las cuentas registradas administran su logo y consultan sus facturas.',
  endpoints: {
    crear: 'POST /api/facturas',
    listar: 'GET /api/facturas?origen=&referenciaExterna=&limit=&offset=',
    consultarJson: 'GET /api/facturas/:id',
    documentoPdf: 'GET /api/documentos/facturas/:id?formato=pdf|html&plantilla=auto|generica',
    actualizarLogo: 'PATCH /api/facturas/:id/logo (logo principal y/o logo blanco; JSON data URL o multipart/form-data)',
    facturaElectronicaEstado: 'GET /api/facturas/:id/electronica',
    facturaElectronicaXml: 'GET /api/facturas/:id/electronica/xml',
    health: 'GET /health',
    healthDocumentos: 'GET /health/documentos',
    contrato: 'GET /api/contrato',
    portalRegistro: 'POST /api/portal/auth/register',
    portalLogin: 'POST /api/portal/auth/login',
    portalFacturas: 'GET /api/portal/facturas',
    portalPerfil: 'PUT /api/portal/perfil',
    portalRotarApiKey: 'POST /api/portal/integracion/api-key/rotar',
  },
  interoperabilidad: {
    origen: 'Identificador opcional del sistema cliente, por ejemplo sistema-escolar.',
    referenciaExterna: 'Referencia opcional e idempotente del cliente, por ejemplo cargo:42.',
    logo: 'Opcional. Admite dos variantes: emisor.logoUrl / archivo logo para fondos claros y emisor.logoUrlBlanco / archivo logoBlanco para el encabezado oscuro. PNG/JPG/WEBP, máximo 500 KB por variante.',
    plantillaPdf: 'La factura visual usa una única plantilla configurable del servicio. El sistema cliente aporta los datos del emisor, receptor, conceptos, totales y su logo mediante la cuenta vinculada.',
    perfilV44Visual: 'En POST /api/facturas use perfilValidacion=v44-visual para validar el comprobante visual con campos ampliados cuando se proporcionen.',
    autenticacionCliente: 'Si se envía X-Api-Key, la factura queda asociada a la cuenta registrada y usa el logo guardado en ese portal. La referencia externa mantiene idempotencia.',
    facturaSmart: 'Opcional: un sistema cliente puede enviar X-FacturaSmart-Access-Token y X-FacturaSmart-Base-Url. Factura Bonita registra la misma factura en FacturaSmart, recupera el XML y lo conserva asociado al comprobante visual.',
  },
};

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) app.use(express.static(frontendDist));

app.get('/docs', (req, res) => res.type('html').send(renderApiConsole(contrato)));
app.get('/api/contrato', (req, res) => res.json(contrato));
app.get('/health', (req, res) => res.json({ status: 'ok', version: API_VERSION, templateVersion: TEMPLATE_VERSION }));
app.get('/health/documentos', (req, res) => {
  const browser = obtenerEstadoBrowser();
  const renderer = obtenerEstadoRenderer();
  const pdfDisponible = Boolean(browser.chrome);
  res.status(200).json({
    status: pdfDisponible ? 'ok' : 'degraded',
    version: API_VERSION,
    templateVersion: TEMPLATE_VERSION,
    pdfDisponible,
    htmlDisponible: true,
    detalle: pdfDisponible
      ? 'PDF y vista HTML disponibles.'
      : 'La vista HTML está disponible; el motor PDF se está preparando o requiere reinicio.',
    ...browser,
    renderer,
  });
});

app.use('/api/facturas', facturaRoutes);
app.use('/api/portal/auth/login', loginLimiter);
app.use('/api/portal', portalRoutes);
app.use('/api/documentos', createDocumentRoutes());

app.get('/', (req, res) => {
  const indexFile = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  return res.type('html').send(renderApiConsole(contrato));
});
app.get(/^\/(?!api\/|health(?:\/|$)|docs$).*/, (req, res, next) => {
  const indexFile = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  return next();
});

app.use((err, req, res, next) => {
  console.error('[error]', err);

  const status = Number(err.status) || 500;

  if (status === 503) {
    res.set('Retry-After', '2');
  }

  const respuesta = {
    error: status >= 500
      ? 'Error interno del servicio'
      : 'Solicitud inválida',
  };

  if (status < 500) {
    respuesta.detalle = err.message;
  }

  res.status(status).json(respuesta);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`API compartida de facturación corriendo en el puerto ${PORT}`);
    Promise.allSettled([asegurarEsquemaCompartido(), ensurePortalSchema(), ensureFacturaSmartSchema(), calentarNavegador()]);
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
