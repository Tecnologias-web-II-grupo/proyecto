const fs = require('fs/promises');
const path = require('path');
const cheerio = require('cheerio');
const { RendererError } = require('./errors');

const templateDir = path.join(__dirname, '..', 'src', 'factura-plantilla');
const templatePath = path.join(templateDir, 'factura.html');
const stylesheetPath = path.join(templateDir, 'factura.css');

function validarFactura(factura) {
  const definido = (valor) => valor !== undefined && valor !== null && valor !== '';
  const camposValidos = factura && factura.id && factura.fecha && factura.moneda
    && factura.condicionVenta && factura.medioPago
    && factura.emisor?.nombre && factura.emisor?.identificacion?.tipo
    && factura.emisor?.identificacion?.numero && factura.emisor?.correo
    && factura.receptor?.nombre && factura.receptor?.correo
    && Array.isArray(factura.items) && factura.items.length > 0 && factura.totales
    && definido(factura.totales.totalGravado) && definido(factura.totales.totalExento)
    && definido(factura.totales.totalDescuentos) && definido(factura.totales.totalImpuesto)
    && definido(factura.totales.totalComprobante);

  if (!camposValidos) {
    throw new RendererError('La factura no contiene la estructura requerida', 502, 'RESPUESTA_INVALIDA');
  }
}

function formatearFecha(fecha) {
  const match = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(fecha);
}

function formatoMoneda(valor, moneda) {
  const simbolo = moneda === 'USD' ? '$' : '₡';
  return simbolo + Number(valor).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function asignarTexto($, selector, valor) {
  $(selector).text(valor === null || valor === undefined ? '' : String(valor));
}

async function renderizarHtml(factura) {
  validarFactura(factura);
  const [template, stylesheet] = await Promise.all([
    fs.readFile(templatePath, 'utf8'),
    fs.readFile(stylesheetPath, 'utf8'),
  ]);
  const $ = cheerio.load(template, { decodeEntities: false });

  $('link[href="factura.css"]').replaceWith(`<style>${stylesheet}</style>`);
  $('script[src="factura.js"]').remove();

  const textos = {
    '#facturaId': factura.id,
    '#fechaFactura': formatearFecha(factura.fecha),
    '#moneda': factura.moneda,
    '#condicionVenta': factura.condicionVenta,
    '#medioPago': factura.medioPago,
    '#emisorNombre': factura.emisor.nombre,
    '#emisorNombreDetalle': factura.emisor.nombre,
    '#emisorTipo': factura.emisor.identificacion.tipo,
    '#emisorNumero': factura.emisor.identificacion.numero,
    '#emisorNumeroDetalle': factura.emisor.identificacion.numero,
    '#emisorCorreo': factura.emisor.correo,
    '#emisorCorreoDetalle': factura.emisor.correo,
    '#receptorNombre': factura.receptor.nombre,
    '#receptorTipo': factura.receptor.identificacion?.tipo || 'No indicada',
    '#receptorNumero': factura.receptor.identificacion?.numero || 'No indicada',
    '#receptorCorreo': factura.receptor.correo,
    '#totalGravado': formatoMoneda(factura.totales.totalGravado, factura.moneda),
    '#totalExento': formatoMoneda(factura.totales.totalExento, factura.moneda),
    '#totalDescuentos': formatoMoneda(factura.totales.totalDescuentos, factura.moneda),
    '#totalImpuesto': formatoMoneda(factura.totales.totalImpuesto, factura.moneda),
    '#totalComprobante': formatoMoneda(factura.totales.totalComprobante, factura.moneda),
  };
  Object.entries(textos).forEach(([selector, valor]) => asignarTexto($, selector, valor));

  const tbody = $('#itemsFactura').empty();
  for (const item of factura.items) {
    if (!item || !item.impuesto) {
      throw new RendererError('La factura contiene una línea con estructura inválida', 502, 'RESPUESTA_INVALIDA');
    }
    const row = $('<tr></tr>');
    [
      item.numeroLinea ?? '', item.detalle, item.cantidad,
      formatoMoneda(item.precioUnitario, factura.moneda),
      formatoMoneda(item.descuento, factura.moneda), `${item.impuesto.tarifa}%`,
      formatoMoneda(item.subtotal, factura.moneda),
      formatoMoneda(item.montoTotalLinea, factura.moneda),
    ].forEach((valor) => row.append($('<td></td>').text(String(valor ?? ''))));
    tbody.append(row);
  }

  return $.html();
}

module.exports = { renderizarHtml };
