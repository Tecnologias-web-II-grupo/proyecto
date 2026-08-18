const React = require('react');

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

function formatMoney(value, currency) {
  const locale = currency === 'USD' ? 'en-US' : 'es-CR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Detail({ label, children }) {
  return React.createElement(
    'div',
    { className: 'dato' },
    React.createElement('strong', null, `${label}:`),
    React.createElement('span', null, children)
  );
}

function PersonCard({ title, person }) {
  return React.createElement(
    'div',
    { className: 'tarjeta' },
    React.createElement('h3', null, title),
    React.createElement(Detail, { label: 'Nombre' }, person?.nombre || ''),
    React.createElement(Detail, { label: 'Tipo de identificación' }, person?.identificacion?.tipo || 'No indicada'),
    React.createElement(Detail, { label: 'Identificación' }, person?.identificacion?.numero || 'No indicada'),
    React.createElement(Detail, { label: 'Correo' }, person?.correo || '')
  );
}

function FacturaDocument({ factura, logoUrl }) {
  const items = Array.isArray(factura.items) ? factura.items : [];
  const currency = factura.moneda || 'CRC';
  const totals = factura.totales || {};

  return React.createElement(
    'main',
    { className: 'factura', 'aria-label': `Factura ${factura.id}` },
    React.createElement(
      'header',
      { className: 'encabezado' },
      React.createElement(
        'div',
        { className: 'datos-emisor' },
        logoUrl
          ? React.createElement('img', {
              className: 'logo-emisor',
              src: logoUrl,
              alt: `Logo de ${factura.emisor?.nombre || 'emisor'}`,
            })
          : null,
        React.createElement('h1', null, 'FACTURA'),
        React.createElement('h2', null, factura.emisor?.nombre || ''),
        React.createElement(
          'p',
          null,
          React.createElement('strong', null, 'Identificación: '),
          factura.emisor?.identificacion?.numero || ''
        ),
        React.createElement('p', null, factura.emisor?.correo || '')
      ),
      React.createElement(
        'div',
        { className: 'datos-factura' },
        React.createElement(
          'div',
          { className: 'numero-factura' },
          React.createElement('span', null, 'FACTURA N.º'),
          React.createElement('strong', null, factura.id)
        ),
        React.createElement('p', null, React.createElement('strong', null, 'Fecha: '), formatDate(factura.fecha)),
        React.createElement('p', null, React.createElement('strong', null, 'Moneda: '), currency)
      )
    ),
    React.createElement(
      'section',
      { className: 'personas' },
      React.createElement(PersonCard, { title: 'EMISOR', person: factura.emisor }),
      React.createElement(PersonCard, { title: 'RECEPTOR', person: factura.receptor })
    ),
    React.createElement(
      'section',
      { className: 'condiciones' },
      React.createElement('div', null, React.createElement('strong', null, 'Condición de venta: '), factura.condicionVenta),
      React.createElement('div', null, React.createElement('strong', null, 'Medio de pago: '), factura.medioPago)
    ),
    React.createElement(
      'section',
      { className: 'detalle' },
      React.createElement('h3', null, 'DETALLE DE LA FACTURA'),
      React.createElement(
        'table',
        null,
        React.createElement(
          'thead',
          null,
          React.createElement(
            'tr',
            null,
            ['Línea', 'Descripción', 'Cantidad', 'Precio unitario', 'Descuento', 'Impuesto', 'Subtotal', 'Total'].map((text) =>
              React.createElement('th', { key: text }, text)
            )
          )
        ),
        React.createElement(
          'tbody',
          null,
          items.map((item, index) =>
            React.createElement(
              'tr',
              { key: `${item.numeroLinea ?? index}-${item.detalle ?? ''}` },
              React.createElement('td', null, item.numeroLinea ?? ''),
              React.createElement('td', null, item.detalle || ''),
              React.createElement('td', null, item.cantidad ?? ''),
              React.createElement('td', null, formatMoney(item.precioUnitario, currency)),
              React.createElement('td', null, formatMoney(item.descuento, currency)),
              React.createElement('td', null, `${item.impuesto?.tarifa ?? 0}%`),
              React.createElement('td', null, formatMoney(item.subtotal, currency)),
              React.createElement('td', null, formatMoney(item.montoTotalLinea, currency))
            )
          )
        )
      )
    ),
    React.createElement(
      'section',
      { className: 'totales' },
      React.createElement('div', { className: 'fila-total' }, React.createElement('span', null, 'Total gravado'), React.createElement('strong', null, formatMoney(totals.totalGravado, currency))),
      React.createElement('div', { className: 'fila-total' }, React.createElement('span', null, 'Total exento'), React.createElement('strong', null, formatMoney(totals.totalExento, currency))),
      React.createElement('div', { className: 'fila-total' }, React.createElement('span', null, 'Descuentos'), React.createElement('strong', null, formatMoney(totals.totalDescuentos, currency))),
      React.createElement('div', { className: 'fila-total' }, React.createElement('span', null, 'Impuestos'), React.createElement('strong', null, formatMoney(totals.totalImpuesto, currency))),
      React.createElement('div', { className: 'fila-total total-final' }, React.createElement('span', null, 'TOTAL'), React.createElement('strong', null, formatMoney(totals.totalComprobante, currency)))
    ),
    React.createElement(
      'footer',
      { className: 'pie-factura' },
      React.createElement('p', null, 'Comprobante generado por Factura Bonita. Documento de solo lectura.'),
      React.createElement('p', null, `Referencia: ${factura.id}`)
    )
  );
}

module.exports = { FacturaDocument };
