const fs = require('fs/promises');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { RendererError } = require('./errors');
const { FacturaDocument: FacturaGenerica } = require('../src/factura-plantilla/generica/factura');
const { FacturaDocument: FacturaEduControl } = require('../src/factura-plantilla/educontrol/factura');

const plantillas = {
  generica: {
    component: FacturaGenerica,
    stylesheetPath: path.join(__dirname, '..', 'src', 'factura-plantilla', 'generica', 'factura.css'),
  },
  educontrol: {
    component: FacturaEduControl,
    stylesheetPath: path.join(__dirname, '..', 'src', 'factura-plantilla', 'educontrol', 'factura.css'),
  },
};

function validarFactura(factura) {
  const definido = (valor) => valor !== undefined && valor !== null && valor !== '';
  const camposValidos =
    factura && factura.id && factura.fecha && factura.moneda && factura.condicionVenta && factura.medioPago &&
    factura.emisor?.nombre && factura.emisor?.identificacion?.tipo && factura.emisor?.identificacion?.numero && factura.emisor?.correo &&
    factura.receptor?.nombre && factura.receptor?.correo && Array.isArray(factura.items) && factura.items.length > 0 && factura.totales &&
    definido(factura.totales.totalGravado) && definido(factura.totales.totalExento) && definido(factura.totales.totalDescuentos) &&
    definido(factura.totales.totalImpuesto) && definido(factura.totales.totalComprobante);

  if (!camposValidos) {
    throw new RendererError('La factura no contiene la estructura requerida', 502, 'RESPUESTA_INVALIDA');
  }
}

function resolverPlantilla(factura, solicitada = 'auto') {
  const valor = String(solicitada || 'auto').trim().toLowerCase();
  if (!['auto', 'educontrol', 'generica'].includes(valor)) {
    throw new RendererError('Plantilla inválida. Usa auto, educontrol o generica', 400, 'PLANTILLA_INVALIDA');
  }
  if (valor !== 'auto') return valor;

  const origen = String(factura?.origen || '').trim().toLowerCase();
  const emisor = String(factura?.emisor?.nombre || '').trim().toLowerCase();
  return origen === 'educontrol' || emisor.includes('educontrol') ? 'educontrol' : 'generica';
}

async function renderizarHtml(factura, opciones = {}) {
  validarFactura(factura);
  const plantilla = resolverPlantilla(factura, opciones.plantilla);
  const config = plantillas[plantilla];
  const stylesheet = await fs.readFile(config.stylesheetPath, 'utf8');
  const markup = renderToStaticMarkup(React.createElement(config.component, { factura }));

  return {
    html: `<!DOCTYPE html>
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
</html>`,
    plantilla,
  };
}

module.exports = { renderizarHtml, resolverPlantilla };
