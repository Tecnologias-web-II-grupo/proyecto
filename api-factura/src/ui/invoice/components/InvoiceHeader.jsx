const React = require('react');
const Datum = require('./Datum.jsx');
const { texto, fecha, iniciales, codigo, CONDICIONES, PAGOS, proveedorTexto } = require('../formatters');

function InvoiceHeader({ factura }) {
  const emisor = factura.emisor || {};
  // El PDF final usa encabezado claro para admitir logos claros, oscuros,
  // transparentes o con fondo blanco sin encerrarlos artificialmente.
  const logoHeader = emisor.logoUrl || emisor.logoUrlBlanco || null;

  return React.createElement(React.Fragment, null,
    React.createElement('header', { className: 'hero' },
      React.createElement('div', { className: 'brand' },
        logoHeader
          ? React.createElement('div', { className: 'logo' }, React.createElement('img', { src: logoHeader, alt: 'Logo del emisor' }))
          : React.createElement('div', { className: 'logo fallback' }, iniciales(emisor.nombre)),
        React.createElement('div', { className: 'brand-copy' },
          React.createElement('span', { className: 'overline' }, 'COMPROBANTE DE INGRESO'),
          React.createElement('h1', null, texto(emisor.nombre, 'Emisor')),
          React.createElement('p', null, texto(emisor.correo, ''))
        )
      ),
      React.createElement('div', { className: 'number' },
        React.createElement('span', null, 'FACTURA'),
        React.createElement('strong', { className: 'mono' }, texto(factura.id, 'Sin número')),
        React.createElement('small', null, 'PDF de solo lectura')
      )
    ),
    React.createElement('section', { className: 'meta' },
      React.createElement(Datum, { label: 'Fecha', value: fecha(factura.fecha) }),
      React.createElement(Datum, { label: 'Moneda', value: factura.moneda }),
      React.createElement(Datum, { label: 'Condición', value: codigo(CONDICIONES, factura.condicionVenta) }),
      React.createElement(Datum, { label: 'Pago', value: codigo(PAGOS, factura.medioPago) }),
      (factura.plazoCreditoDias ?? factura.plazoCredito) !== undefined && (factura.plazoCreditoDias ?? factura.plazoCredito) !== null
        ? React.createElement(Datum, { label: 'Plazo', value: `${factura.plazoCreditoDias ?? factura.plazoCredito} días` }) : null,
      factura.proveedorSistemas ? React.createElement(Datum, { label: 'Proveedor del sistema', value: proveedorTexto(factura.proveedorSistemas) }) : null
    )
  );
}
module.exports = InvoiceHeader;
