const React = require('react');
const GenericInvoice = require('../generic/GenericInvoice.jsx');

function EduControlInvoice({ factura }) {
  return React.createElement(GenericInvoice, { factura });
}
module.exports = EduControlInvoice;
