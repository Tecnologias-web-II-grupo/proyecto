const React = require('react');
const { texto, proveedorTexto } = require('../formatters');
function InvoiceFooter({ factura }) {
  const proveedor = proveedorTexto(factura.proveedorSistemas);
  return React.createElement('footer', null,
    React.createElement('span', null, texto(factura.emisor?.nombre, 'Emisor')),
    React.createElement('span', { className: 'mono' }, texto(factura.id, '')),
    proveedor
      ? React.createElement('span', { className: 'provider' }, `Emitido vía ${proveedor}`)
      : React.createElement('span', null, 'Comprobante PDF de solo lectura')
  );
}
module.exports = InvoiceFooter;
