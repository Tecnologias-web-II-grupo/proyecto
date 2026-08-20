const React = require('react');
const { texto, dinero } = require('../formatters');

function OperationOverview({ factura }) {
  const items = Array.isArray(factura.items) ? factura.items : [];
  const primero = items[0];
  const adicionales = Math.max(items.length - 1, 0);
  const descripcion = primero ? texto(primero.detalle, 'Operación facturada') : 'Operación facturada';
  const total = factura.totales?.totalComprobante;

  return React.createElement('section', { className: 'operation-overview' },
    React.createElement('div', { className: 'operation-copy' },
      React.createElement('span', { className: 'operation-label' }, 'Concepto'),
      React.createElement('strong', null, descripcion),
      adicionales ? React.createElement('small', null, `${adicionales} concepto${adicionales === 1 ? '' : 's'} adicional${adicionales === 1 ? '' : 'es'}`) : null
    ),
    React.createElement('div', { className: 'operation-total' },
      React.createElement('span', null, 'Total'),
      React.createElement('strong', null, dinero(total, factura.moneda))
    )
  );
}
module.exports = OperationOverview;
