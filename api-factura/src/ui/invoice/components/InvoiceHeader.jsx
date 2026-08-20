const React = require('react');
const Datum = require('./Datum.jsx');
const { texto, fecha, iniciales, codigo, CONDICIONES, PAGOS, proveedorTexto } = require('../formatters');

function InvoiceHeader({ factura }) {
  const emisor = factura.emisor || {};
  // Encabezado con banda oscura: se prioriza el logo claro/blanco
  // (emisor.logoUrlBlanco) pensado para fondos oscuros; si el emisor
  // solo cargó un logo estándar, se usa igual sobre un lienzo blanco
  // para que nunca se recorte ni se pierda contraste.
  const logoOscuro = emisor.logoUrlBlanco || null;
  const logoClaro = !logoOscuro ? emisor.logoUrl : null;

  return React.createElement(React.Fragment, null,
    React.createElement('header', { className: 'hero' },
      React.createElement('div', { className: 'brand' },
        logoOscuro
          ? React.createElement('div', { className: 'logo' }, React.createElement('img', { src: logoOscuro, alt: 'Logo del emisor' }))
          : logoClaro
            ? React.createElement('div', { className: 'logo logo-lienzo' }, React.createElement('img', { src: logoClaro, alt: 'Logo del emisor' }))
            : React.createElement('div', { className: 'logo fallback' }, iniciales(emisor.nombre)),
        React.createElement('div', { className: 'brand-copy' },
          React.createElement('span', { className: 'overline' }, 'Comprobante de ingreso'),
          React.createElement('h1', null, texto(emisor.nombre, 'Emisor')),
          React.createElement('p', null, texto(emisor.correo, ''))
        )
      ),
      React.createElement('div', { className: 'number' },
        React.createElement('span', null, 'Factura'),
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
        ? React.createElement(Datum, { label: 'Plazo', value: `${factura.plazoCreditoDias ?? factura.plazoCredito} días` }) : null
    )
  );
}
module.exports = InvoiceHeader;
