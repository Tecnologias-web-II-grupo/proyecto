const express = require('express');
require('dotenv').config();

const facturaRoutes = require('./routes/facturaRoutes');
const { asegurarEsquemaCompartido } = require('./controllers/facturaController');
const { createDocumentRoutes } = require('../document-renderer/routes');
const { calentarNavegador, obtenerEstadoBrowser, cerrarBrowser } = require('../document-renderer/browserManager');
const { obtenerEstadoRenderer } = require('../document-renderer/pdfRenderer');

const app = express();
const API_VERSION = '1.8.0';
const TEMPLATE_VERSION = 'factura-v44-visual-presentable-v4';

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
    actualizarLogo: 'PATCH /api/facturas/:id/logo (JSON data URL o multipart/form-data con archivo logo)',
    health: 'GET /health',
    healthDocumentos: 'GET /health/documentos',
    contrato: 'GET /api/contrato',
  },
  interoperabilidad: {
    origen: 'Identificador opcional del sistema cliente, por ejemplo educontrol.',
    referenciaExterna: 'Referencia opcional e idempotente del cliente, por ejemplo cargo:42.',
    logo: 'Opcional. Acepta emisor.logoUrl como data URL o archivo real mediante multipart/form-data (campo logo), PNG/JPG/WEBP hasta 500 KB.',
    plantillaPdf: 'auto usa EduControl cuando origen=educontrol; para otros sistemas usa la plantilla genérica. Ambas plantillas muestran los campos fiscales ampliados cuando se envían.',
    perfilV44Visual: 'En POST /api/facturas use perfilValidacion=v44-visual para exigir el conjunto ampliado de campos del comprobante visual. No genera XML ni firma digital.',
  },
};

function paginaDocs() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>API de Facturación al Cliente</title>
<style>
:root{--navy:#123b5f;--navy2:#0d2a43;--blue:#1682ba;--teal:#1eaaa3;--ink:#203446;--muted:#64798a;--line:#dbe7ed;--soft:#f5f9fb}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;color:var(--ink);background:#eef4f7}a{color:var(--blue);text-decoration:none}.wrap{max-width:1120px;margin:auto;padding:28px 20px 48px}.hero{background:linear-gradient(120deg,var(--navy2),var(--navy));color:#fff;border-top:6px solid var(--teal);border-radius:16px;padding:30px;box-shadow:0 14px 34px rgba(12,48,72,.14)}.hero small{letter-spacing:1.7px;color:#80dfda;font-weight:800}.hero h1{margin:8px 0 8px;font-size:34px}.hero p{max-width:820px;margin:0;color:#d8e8f1;line-height:1.55}.badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.badge{border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:7px 10px;font-size:12px}.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin-top:18px}.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:0 7px 22px rgba(17,55,80,.06)}h2{font-size:19px;margin:0 0 12px;color:var(--navy)}h3{font-size:14px;color:var(--navy);margin:18px 0 7px}.endpoint{display:grid;grid-template-columns:78px 1fr;gap:10px;padding:11px 0;border-bottom:1px solid #edf2f5}.endpoint:last-child{border-bottom:0}.method{font:700 12px ui-monospace,SFMono-Regular,Consolas,monospace;color:#fff;background:var(--blue);border-radius:7px;padding:5px 7px;text-align:center;height:max-content}.method.get{background:#287a68}.method.patch{background:#8a62ba}.path{font:600 13px ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}.desc{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.4}.flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:8px;text-align:center;margin-top:10px}.step{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:12px 8px;font-size:12px;font-weight:700}.arrow{color:var(--teal);font-weight:900}.links{display:grid;gap:9px}.link{display:block;padding:11px 12px;border:1px solid var(--line);border-radius:9px;background:#fbfdfe;font-weight:700}.note{margin-top:14px;background:#eaf8f7;border-left:4px solid var(--teal);padding:12px 14px;border-radius:8px;font-size:12px;line-height:1.5}.foot{color:var(--muted);font-size:12px;margin-top:18px;text-align:center}@media(max-width:800px){.grid{grid-template-columns:1fr}.flow{grid-template-columns:1fr}.arrow{transform:rotate(90deg)}}
</style>
</head>
<body><div class="wrap">
<section class="hero"><small>SERVICIO REST COMPARTIDO</small><h1>API de Facturación al Cliente</h1><p>Registra facturas recibidas desde sistemas clientes, las expone como JSON y genera un comprobante PDF visual de solo lectura. Diseñada para interoperar con diferentes proyectos sin acceso directo a la base de datos.</p><div class="badges"><span class="badge">v${API_VERSION}</span><span class="badge">Plantilla ${TEMPLATE_VERSION}</span><span class="badge">HTTPS / JSON / PDF</span><span class="badge">Logo PNG · JPG · WEBP</span></div></section>
<div class="grid"><section class="card"><h2>Endpoints principales</h2>
<div class="endpoint"><span class="method">POST</span><div><div class="path">/api/facturas</div><div class="desc">Crea una factura a partir de JSON o multipart/form-data con logo.</div></div></div>
<div class="endpoint"><span class="method get">GET</span><div><div class="path">/api/facturas/:id</div><div class="desc">Recupera la factura completa en JSON para consumo de otros servicios.</div></div></div>
<div class="endpoint"><span class="method get">GET</span><div><div class="path">/api/facturas</div><div class="desc">Lista facturas y permite filtros por origen y referencia externa.</div></div></div>
<div class="endpoint"><span class="method get">GET</span><div><div class="path">/api/documentos/facturas/:id?formato=pdf&amp;plantilla=auto</div><div class="desc">Genera el PDF visual de solo lectura.</div></div></div>
<div class="endpoint"><span class="method patch">PATCH</span><div><div class="path">/api/facturas/:id/logo</div><div class="desc">Actualiza el logo mediante JSON data URL o archivo multipart.</div></div></div>
<h3>Flujo de integración</h3><div class="flow"><div class="step">Sistema vendedor</div><div class="arrow">→</div><div class="step">API Factura<br>JSON + PDF</div><div class="arrow">→</div><div class="step">Otro servicio<br>GET JSON</div></div>
</section>
<aside class="card"><h2>Documentación y pruebas</h2><div class="links"><a class="link" href="/api/contrato">Contrato REST en JSON</a><a class="link" href="/health">Estado del servicio</a><a class="link" href="/health/documentos">Estado del generador PDF</a></div><div class="note"><strong>Para integrar otro proyecto:</strong><br>use <code>GET /api/facturas/:id</code>. La respuesta JSON es el contrato estable que otro backend puede consumir directamente.</div><div class="note"><strong>Factura al cliente:</strong><br>el PDF es una representación visual de solo lectura. El servicio no requiere acceso directo a la base de datos del sistema consumidor.</div></aside></div>
<div class="foot">API compartida de facturación al cliente · ${API_VERSION}</div>
</div></body></html>`;
}

app.get('/', (req, res) => res.type('html').send(paginaDocs()));
app.get('/docs', (req, res) => res.type('html').send(paginaDocs()));
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
