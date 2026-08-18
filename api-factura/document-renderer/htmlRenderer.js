const fs = require('fs/promises');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { RendererError } = require('./errors');
const { FacturaDocument } = require('../src/factura-plantilla/factura');

const stylesheetPath = path.join(
  __dirname,
  '..',
  'src',
  'factura-plantilla',
  'factura.css'
);

function validarFactura(factura) {
  const definido = (valor) => valor !== undefined && valor !== null && valor !== '';

  const camposValidos =
    factura &&
    factura.id &&
    factura.fecha &&
    factura.moneda &&
    factura.condicionVenta &&
    factura.medioPago &&
    factura.emisor?.nombre &&
    factura.emisor?.identificacion?.tipo &&
    factura.emisor?.identificacion?.numero &&
    factura.emisor?.correo &&
    factura.receptor?.nombre &&
    factura.receptor?.correo &&
    Array.isArray(factura.items) &&
    factura.items.length > 0 &&
    factura.totales &&
    definido(factura.totales.totalGravado) &&
    definido(factura.totales.totalExento) &&
    definido(factura.totales.totalDescuentos) &&
    definido(factura.totales.totalImpuesto) &&
    definido(factura.totales.totalComprobante);

  if (!camposValidos) {
    throw new RendererError(
      'La factura no contiene la estructura requerida',
      502,
      'RESPUESTA_INVALIDA'
    );
  }
}

async function renderizarHtml(factura) {
  validarFactura(factura);

  const stylesheet = await fs.readFile(stylesheetPath, 'utf8');
  const markup = renderToStaticMarkup(
    React.createElement(FacturaDocument, { factura })
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Factura ${String(factura.id)}</title>
  <style>${stylesheet}</style>
</head>
<body>
${markup}
</body>
</html>`;
}

module.exports = { renderizarHtml };
