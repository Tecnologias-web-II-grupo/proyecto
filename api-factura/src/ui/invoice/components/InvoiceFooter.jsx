const React = require('react');
const { texto } = require('../formatters');
function InvoiceFooter({ factura }) {
  return React.createElement('footer', null,
    React.createElement('span', null, texto(factura.emisor?.nombre, 'Emisor')),
    React.createElement('span', { className: 'mono' }, texto(factura.id, ''))
  );
}
module.exports = InvoiceFooter;
