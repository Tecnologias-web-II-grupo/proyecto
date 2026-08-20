const React = require('react');
const EduControlInvoice = require('../../ui/invoice/educontrol/EduControlInvoice.jsx');
const { dinero, fecha } = require('../../ui/invoice/formatters');
function FacturaDocument({ factura }) { return React.createElement(EduControlInvoice, { factura }); }
module.exports = { FacturaDocument, formatoMoneda: dinero, formatearFecha: fecha };
