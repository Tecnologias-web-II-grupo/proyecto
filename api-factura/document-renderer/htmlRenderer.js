require('../src/react/registerJsx');
const fs = require('fs/promises');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { RendererError } = require('./errors');
const { FacturaDocument: FacturaCompleta } = require('../src/factura-plantilla/factura.js');

const plantillas = {
  generica: {
    component: FacturaCompleta,
    stylesheetPath: path.join(__dirname, '..', 'src', 'factura-plantilla', 'factura.css'),
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
  let valor = String(solicitada || 'auto').trim().toLowerCase();

  // Compatibilidad con integraciones anteriores: EduControl llegó a enviar
  // plantilla=educontrol. Ya no existe una plantilla exclusiva para la escuela;
  // cualquier alias histórico se resuelve a la plantilla genérica completa.
  if (['educontrol', 'default', 'factura', 'completa'].includes(valor)) valor = 'generica';

  if (!['auto', 'generica'].includes(valor)) {
    throw new RendererError('Plantilla inválida. Usa auto o generica', 400, 'PLANTILLA_INVALIDA');
  }

  return 'generica';
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
