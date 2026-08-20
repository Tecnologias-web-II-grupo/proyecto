const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const EndpointRow = require('./components/EndpointRow.jsx');

function ApiConsole({ contrato }) {
  const endpoints = [
    ['POST', '/api/facturas', 'Registra una factura desde JSON o multipart/form-data.'],
    ['GET', '/api/facturas/:id', 'Devuelve la factura completa en JSON para otros servicios.'],
    ['GET', '/api/facturas', 'Lista facturas y permite filtrar por origen o referencia.'],
    ['GET', '/api/documentos/facturas/:id?formato=pdf&plantilla=auto', 'Genera el comprobante PDF de solo lectura.'],
    ['PATCH', '/api/facturas/:id/logo', 'Carga o reemplaza el logo del emisor.'],
    ['GET', '/api/contrato', 'Contrato técnico del servicio en JSON.'],
    ['GET', '/health', 'Estado general de la API.'],
    ['GET', '/health/documentos', 'Estado del generador PDF y Chromium.'],
  ];

  return React.createElement('main', { className: 'console-shell' },
    React.createElement('header', { className: 'console-head' },
      React.createElement('div', null,
        React.createElement('div', { className: 'prompt' }, '> API_FACTURA'),
        React.createElement('h1', null, 'API compartida de facturación al cliente'),
        React.createElement('p', null, contrato.descripcion)
      ),
      React.createElement('div', { className: 'status' },
        React.createElement('span', { className: 'dot' }),
        React.createElement('strong', null, 'ACTIVO'),
        React.createElement('small', null, `v${contrato.version}`)
      )
    ),
    React.createElement('section', { className: 'console-grid' },
      React.createElement('div', { className: 'panel' },
        React.createElement('div', { className: 'panel-title' }, 'ENDPOINTS'),
        ...endpoints.map(([method, path, description]) => React.createElement(EndpointRow, { key: method + path, method, path, description }))
      ),
      React.createElement('aside', { className: 'panel' },
        React.createElement('div', { className: 'panel-title' }, 'CONTRATO'),
        React.createElement('dl', { className: 'kv' },
          React.createElement('dt', null, 'servicio'), React.createElement('dd', null, contrato.servicio),
          React.createElement('dt', null, 'version'), React.createElement('dd', null, contrato.version),
          React.createElement('dt', null, 'templateVersion'), React.createElement('dd', null, contrato.templateVersion),
          React.createElement('dt', null, 'formato'), React.createElement('dd', null, 'JSON + PDF'),
          React.createElement('dt', null, 'transporte'), React.createElement('dd', null, 'HTTPS / REST')
        ),
        React.createElement('div', { className: 'panel-title second' }, 'INTEROPERABILIDAD'),
        React.createElement('p', { className: 'help' }, 'Otro backend consume GET /api/facturas/:id y recibe la misma estructura JSON almacenada por esta API.'),
        React.createElement('div', { className: 'actions' },
          React.createElement('a', { href: '/api/contrato' }, 'Ver contrato JSON'),
          React.createElement('a', { href: '/health' }, 'Health'),
          React.createElement('a', { href: '/health/documentos' }, 'Health PDF')
        )
      )
    ),
    React.createElement('footer', null, 'React SSR · Express · Puppeteer · MySQL')
  );
}

const style = `
:root{color-scheme:dark;--bg:#050708;--panel:#0b0f12;--line:#26323a;--ink:#f1f5f7;--muted:#8da1ad;--cyan:#4dd8d0;--blue:#4ca8ff;--green:#61d987;--amber:#ffc857}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#000;color:var(--ink);font-family:Consolas,'Cascadia Code','Courier New',monospace}body{padding:28px}.console-shell{max-width:1180px;margin:0 auto;border:1px solid #1e2a31;background:var(--bg);box-shadow:0 0 0 1px #000,0 20px 60px rgba(0,0,0,.45)}.console-head{display:flex;justify-content:space-between;gap:30px;padding:26px 28px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#0b0e10,#060809)}.prompt{color:var(--cyan);font-size:13px;font-weight:700;letter-spacing:.8px}.console-head h1{font-size:24px;margin:8px 0 7px}.console-head p{margin:0;max-width:760px;color:var(--muted);font:13px/1.55 'Segoe UI',Arial,sans-serif}.status{min-width:115px;align-self:flex-start;border:1px solid #244134;padding:10px 12px;display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center}.status .dot{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 10px rgba(97,217,135,.5)}.status strong{color:var(--green);font-size:12px}.status small{grid-column:2;color:var(--muted)}.console-grid{display:grid;grid-template-columns:1.45fr .8fr;gap:0}.panel{padding:24px 28px;border-right:1px solid var(--line)}.panel:last-child{border-right:0}.panel-title{color:var(--cyan);font-size:11px;font-weight:800;letter-spacing:1.5px;margin-bottom:11px}.panel-title.second{margin-top:25px}.endpoint{display:grid;grid-template-columns:66px minmax(0,1fr);gap:13px;padding:11px 0;border-bottom:1px dashed #1e2a30}.method{font-size:11px;font-weight:800;padding:4px 6px;text-align:center;border:1px solid currentColor;height:max-content}.method.get{color:var(--green)}.method.post{color:var(--blue)}.method.patch{color:var(--amber)}.endpoint-main{min-width:0}.endpoint-main code{display:block;color:#fff;white-space:normal;overflow-wrap:anywhere;font-size:12px}.endpoint-main span{display:block;color:var(--muted);margin-top:4px;font:12px/1.4 'Segoe UI',Arial,sans-serif}.kv{display:grid;grid-template-columns:130px 1fr;gap:7px 12px;margin:0;font-size:12px}.kv dt{color:var(--blue)}.kv dd{margin:0;color:#e6eef2;overflow-wrap:anywhere}.help{color:var(--muted);font:12px/1.55 'Segoe UI',Arial,sans-serif}.actions{display:grid;gap:8px;margin-top:13px}.actions a{border:1px solid #28404d;padding:9px 11px;color:#d9f4f2;text-decoration:none;font-size:11px;background:#0b1115}.actions a:hover{border-color:var(--cyan);color:var(--cyan)}footer{padding:12px 28px;border-top:1px solid var(--line);color:#61727c;font-size:10px;text-align:right}@media(max-width:820px){body{padding:0}.console-grid{grid-template-columns:1fr}.panel{border-right:0;border-bottom:1px solid var(--line)}.console-head{flex-direction:column}.status{align-self:stretch}.kv{grid-template-columns:1fr}.kv dd{padding-bottom:5px}}
`;

function renderApiConsole(contrato) {
  const markup = renderToStaticMarkup(React.createElement(ApiConsole, { contrato }));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>API Factura</title><style>${style}</style></head><body>${markup}</body></html>`;
}

module.exports = { ApiConsole, renderApiConsole };
