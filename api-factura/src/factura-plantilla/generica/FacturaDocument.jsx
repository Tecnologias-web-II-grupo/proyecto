const React = require('react');
const GenericInvoice = require('../../ui/invoice/generic/GenericInvoice.jsx');
const { dinero, fecha } = require('../../ui/invoice/formatters');
function FacturaDocument({ factura }) { return React.createElement(GenericInvoice, { factura }); }
module.exports = { FacturaDocument, formatoMoneda: dinero, formatearFecha: fecha };
