const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const fs = require('fs');
const path = require('path');
const ApiHeader = require('./components/ApiHeader.jsx');
const EndpointList = require('./components/EndpointList.jsx');
const ContractPanel = require('./components/ContractPanel.jsx');
const ConsoleFooter = require('./components/ConsoleFooter.jsx');

const ENDPOINTS = [
  ['POST', '/api/facturas', 'Registra una factura desde JSON o multipart/form-data.'],
  ['GET', '/api/facturas/:id', 'Devuelve la factura completa en JSON para otros servicios.'],
  ['GET', '/api/facturas', 'Lista facturas y permite filtrar por origen o referencia.'],
  ['GET', '/api/documentos/facturas/:id?formato=pdf&plantilla=auto', 'Genera el comprobante PDF de solo lectura.'],
  ['PATCH', '/api/facturas/:id/logo', 'Carga logo principal y/o variante blanca para encabezados oscuros.'],
  ['GET', '/api/contrato', 'Contrato técnico del servicio en JSON.'],
  ['GET', '/health', 'Estado general de la API.'],
  ['GET', '/health/documentos', 'Estado del generador PDF y Chromium.'],
];

function ApiConsole({ contrato }) {
  return React.createElement('main', { className: 'console-shell' },
    React.createElement(ApiHeader, { contrato }),
    React.createElement('section', { className: 'console-grid' }, React.createElement(EndpointList, { endpoints: ENDPOINTS }), React.createElement(ContractPanel, { contrato })),
    React.createElement(ConsoleFooter)
  );
}

function renderApiConsole(contrato) {
  const style = fs.readFileSync(path.join(__dirname, 'apiConsole.css'), 'utf8');
  const markup = renderToStaticMarkup(React.createElement(ApiConsole, { contrato }));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>API Factura</title><style>${style}</style></head><body>${markup}</body></html>`;
}
module.exports = { ApiConsole, renderApiConsole };
