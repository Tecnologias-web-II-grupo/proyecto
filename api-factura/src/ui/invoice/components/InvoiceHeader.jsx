const React = require('react');
const Datum = require('./Datum.jsx');
const { texto, fecha, iniciales, codigo, CONDICIONES, PAGOS, proveedorTexto } = require('../formatters');

function InvoiceHeader({ factura }) {
  const emisor = factura.emisor || {};
  return React.createElement(React.Fragment, null,
    React.createElement('header', { className: 'hero' },
      React.createElement('div', { className: 'brand' },
        emisor.logoUrl
          ? React.createElement('div', { className: 'logo' }, React.createElement('img', { src: emisor.logoUrl, alt: 'Logo del emisor' }))
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
        React.createElement('em', null, 'PDF · SOLO LECTURA')
      )
    ),
    React.createElement('section', { className: 'meta' },
      React.createElement(Datum, { label: 'Fecha de emisión', value: fecha(factura.fecha) }),
      React.createElement(Datum, { label: 'Moneda', value: factura.moneda }),
      React.createElement(Datum, { label: 'Condición de venta', value: codigo(CONDICIONES, factura.condicionVenta) }),
      React.createElement(Datum, { label: 'Medio de pago', value: codigo(PAGOS, factura.medioPago) }),
      (factura.plazoCreditoDias ?? factura.plazoCredito) !== undefined && (factura.plazoCreditoDias ?? factura.plazoCredito) !== null
        ? React.createElement(Datum, { label: 'Plazo de crédito', value: `${factura.plazoCreditoDias ?? factura.plazoCredito} días` }) : null,
      factura.proveedorSistemas ? React.createElement(Datum, { label: 'Proveedor de sistemas', value: proveedorTexto(factura.proveedorSistemas) }) : null,
      factura.totales?.tipoCambio !== undefined ? React.createElement(Datum, { label: 'Tipo de cambio', value: factura.totales.tipoCambio }) : null
    )
  );
}
module.exports = InvoiceHeader;
