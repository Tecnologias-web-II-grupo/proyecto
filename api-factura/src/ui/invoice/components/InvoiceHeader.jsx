const React = require('react');
const Datum = require('./Datum.jsx');
const { texto, fecha, iniciales, codigo, CONDICIONES, PAGOS } = require('../formatters');

function InvoiceHeader({ factura }) {
  const emisor = factura.emisor || {};
  const logoHeader = emisor.logoUrl || emisor.logoUrlBlanco || null;
  const plazo = factura.plazoCreditoDias ?? factura.plazoCredito;

  return React.createElement(React.Fragment, null,
    React.createElement('header', { className: 'hero' },
      React.createElement('div', { className: 'brand' },
        logoHeader
          ? React.createElement('div', { className: 'logo' }, React.createElement('img', { src: logoHeader, alt: 'Logo del emisor' }))
          : React.createElement('div', { className: 'logo fallback' }, iniciales(emisor.nombre)),
        React.createElement('div', { className: 'brand-copy' },
            React.createElement('h1', null, texto(emisor.nombre, 'Emisor')),
          emisor.correo ? React.createElement('p', null, emisor.correo) : null
        )
      ),
      React.createElement('div', { className: 'number' },
        React.createElement('span', null, 'FACTURA'),
        React.createElement('strong', { className: 'mono' }, texto(factura.id, 'Sin número'))
      )
    ),
    React.createElement('section', { className: 'meta' },
      React.createElement(Datum, { label: 'Fecha', value: fecha(factura.fecha) }),
      React.createElement(Datum, { label: 'Moneda', value: factura.moneda }),
      React.createElement(Datum, { label: 'Condición', value: codigo(CONDICIONES, factura.condicionVenta) }),
      React.createElement(Datum, { label: 'Medio de pago', value: codigo(PAGOS, factura.medioPago) }),
      plazo !== undefined && plazo !== null ? React.createElement(Datum, { label: 'Plazo', value: `${plazo} días` }) : null
    )
  );
}
module.exports = InvoiceHeader;
