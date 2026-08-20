const React = require('react');
const SectionTitle = require('./SectionTitle.jsx');
const { texto, dinero } = require('../formatters');

function ItemsTable({ factura }) {
  const items = Array.isArray(factura.items) ? factura.items : [];
  return React.createElement('section', { className: 'detail-block' },
    React.createElement(SectionTitle, { kicker: 'DETALLE DEL COMPROBANTE', title: 'Conceptos facturados' }),
    React.createElement('div', { className: 'table-wrap' },
      React.createElement('table', { className: 'items-table' },
        React.createElement('thead', null, React.createElement('tr', null,
          ['#','CAByS','Descripción','Cant.','Unidad','Precio','Desc.','IVA','Subtotal','Total'].map((x) => React.createElement('th', { key: x }, x))
        )),
        React.createElement('tbody', null, ...items.map((it, i) => React.createElement('tr', { key: i },
          React.createElement('td', { className: 'center' }, it.numeroLinea ?? i + 1),
          React.createElement('td', { className: 'mono' }, texto(it.codigoCabys, '—')),
          React.createElement('td', null, texto(it.detalle)),
          React.createElement('td', { className: 'center' }, texto(it.cantidad)),
          React.createElement('td', { className: 'center' }, texto(it.unidadMedida, '—')),
          React.createElement('td', { className: 'money' }, dinero(it.precioUnitario, factura.moneda)),
          React.createElement('td', { className: 'money' }, dinero(it.descuento, factura.moneda)),
          React.createElement('td', { className: 'center' }, `${Number((it.impuestos?.[0]?.tarifa ?? it.impuesto?.tarifa ?? it.impuestoTarifa) || 0)}%`),
          React.createElement('td', { className: 'money' }, dinero(it.subtotal, factura.moneda)),
          React.createElement('td', { className: 'money strong' }, dinero(it.montoTotalLinea, factura.moneda))
        )))
      )
    )
  );
}
module.exports = ItemsTable;
