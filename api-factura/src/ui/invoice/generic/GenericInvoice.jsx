const React = require('react');
const InvoiceHeader = require('../components/InvoiceHeader.jsx');
const PartyCard = require('../components/PartyCard.jsx');
const ItemsTable = require('../components/ItemsTable.jsx');
const FiscalDetails = require('../components/FiscalDetails.jsx');
const InvoiceSummary = require('../components/InvoiceSummary.jsx');
const InvoiceFooter = require('../components/InvoiceFooter.jsx');

function GenericInvoice({ factura }) {
  return React.createElement('main', { className: 'invoice' },
    React.createElement(InvoiceHeader, { factura }),
    React.createElement('div', { className: 'content' },
      React.createElement('div', { className: 'people' },
        React.createElement(PartyCard, { title: 'Datos del emisor', party: factura.emisor, side: 'issuer' }),
        React.createElement(PartyCard, { title: 'Datos del cliente', party: factura.receptor, side: 'client' })
      ),
      React.createElement(ItemsTable, { factura }),
      React.createElement(FiscalDetails, { factura }),
      React.createElement(InvoiceSummary, { factura })
    ),
    React.createElement(InvoiceFooter, { factura })
  );
}
module.exports = GenericInvoice;
