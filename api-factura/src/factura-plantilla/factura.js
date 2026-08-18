const React = require('react');

function texto(valor, fallback = '') {
  if (valor === null || valor === undefined || valor === '') return fallback;
  return String(valor);
}

function formatearFecha(fecha) {
  const match = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return texto(fecha);
  return parsed.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatoMoneda(valor, moneda) {
  const numero = Number(valor || 0);
  const codigo = moneda === 'USD' ? 'USD' : 'CRC';

  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: codigo,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

function Dato({ etiqueta, children }) {
  return React.createElement(
    'div',
    { className: 'dato' },
    React.createElement('strong', null, `${etiqueta}:`),
    React.createElement('span', null, children)
  );
}

function TarjetaPersona({ titulo, persona }) {
  const identificacion = persona?.identificacion;

  return React.createElement(
    'section',
    { className: 'tarjeta' },
    React.createElement('h3', null, titulo),
    React.createElement(Dato, { etiqueta: 'Nombre' }, texto(persona?.nombre, 'No indicado')),
    React.createElement(
      Dato,
      { etiqueta: 'Tipo de identificación' },
      texto(identificacion?.tipo, 'No indicada')
    ),
    React.createElement(
      Dato,
      { etiqueta: 'Identificación' },
      texto(identificacion?.numero, 'No indicada')
    ),
    React.createElement(Dato, { etiqueta: 'Correo' }, texto(persona?.correo, 'No indicado'))
  );
}

function Encabezado({ factura }) {
  const logoUrl = factura?.emisor?.logoUrl || factura?.emisor?.logo_url || null;

  return React.createElement(
    'header',
    { className: 'encabezado' },
    React.createElement(
      'div',
      { className: 'datos-emisor' },
      logoUrl
        ? React.createElement('img', {
            src: logoUrl,
            alt: `Logo de ${texto(factura.emisor.nombre, 'emisor')}`,
            className: 'logo-emisor',
          })
        : null,
      React.createElement('h1', null, 'FACTURA'),
      React.createElement('h2', null, texto(factura.emisor.nombre)),
      React.createElement(
        'p',
        null,
        React.createElement('strong', null, 'Identificación: '),
        texto(factura.emisor.identificacion?.numero, 'No indicada')
      ),
      React.createElement('p', null, texto(factura.emisor.correo))
    ),
    React.createElement(
      'div',
      { className: 'datos-factura' },
      React.createElement(
        'div',
        { className: 'numero-factura' },
        React.createElement('span', null, 'FACTURA N.º'),
        React.createElement('strong', null, texto(factura.id))
      ),
      React.createElement(
        'p',
        null,
        React.createElement('strong', null, 'Fecha: '),
        formatearFecha(factura.fecha)
      ),
      React.createElement(
        'p',
        null,
        React.createElement('strong', null, 'Moneda: '),
        texto(factura.moneda)
      )
    )
  );
}

function TablaDetalle({ factura }) {
  const filas = factura.items.map((item, index) =>
    React.createElement(
      'tr',
      { key: `${item.numeroLinea ?? index}-${index}` },
      React.createElement('td', null, texto(item.numeroLinea ?? index + 1)),
      React.createElement('td', null, texto(item.detalle)),
      React.createElement('td', null, texto(item.cantidad)),
      React.createElement('td', null, formatoMoneda(item.precioUnitario, factura.moneda)),
      React.createElement('td', null, formatoMoneda(item.descuento, factura.moneda)),
      React.createElement('td', null, `${Number(item.impuesto?.tarifa || 0)}%`),
      React.createElement('td', null, formatoMoneda(item.subtotal, factura.moneda)),
      React.createElement('td', null, formatoMoneda(item.montoTotalLinea, factura.moneda))
    )
  );

  return React.createElement(
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
          ['Línea', 'Descripción', 'Cantidad', 'Precio unitario', 'Descuento', 'Impuesto', 'Subtotal', 'Total']
            .map((titulo) => React.createElement('th', { key: titulo }, titulo))
        )
      ),
      React.createElement('tbody', null, filas)
    )
  );
}

function Totales({ factura }) {
  const totales = factura.totales;
  const filas = [
    ['Total gravado', totales.totalGravado],
    ['Total exento', totales.totalExento],
    ['Descuentos', totales.totalDescuentos],
    ['Impuesto', totales.totalImpuesto],
  ];

  return React.createElement(
    'section',
    { className: 'seccion-totales' },
    React.createElement('div', { className: 'espacio' }),
    React.createElement(
      'div',
      { className: 'totales' },
      filas.map(([etiqueta, valor]) =>
        React.createElement(
          'div',
          { className: 'fila-total', key: etiqueta },
          React.createElement('span', null, `${etiqueta}:`),
          React.createElement('strong', null, formatoMoneda(valor, factura.moneda))
        )
      ),
      React.createElement(
        'div',
        { className: 'fila-total total-final' },
        React.createElement('span', null, 'TOTAL:'),
        React.createElement('strong', null, formatoMoneda(totales.totalComprobante, factura.moneda))
      )
    )
  );
}

function FacturaDocument({ factura }) {
  return React.createElement(
    'main',
    { className: 'factura' },
    React.createElement(Encabezado, { factura }),
    React.createElement(
      'div',
      { className: 'personas' },
      React.createElement(TarjetaPersona, { titulo: 'EMISOR', persona: factura.emisor }),
      React.createElement(TarjetaPersona, { titulo: 'RECEPTOR', persona: factura.receptor })
    ),
    React.createElement(
      'section',
      { className: 'condiciones' },
      React.createElement(
        'div',
        null,
        React.createElement('strong', null, 'Condición de venta: '),
        texto(factura.condicionVenta)
      ),
      React.createElement(
        'div',
        null,
        React.createElement('strong', null, 'Medio de pago: '),
        texto(factura.medioPago)
      )
    ),
    React.createElement(TablaDetalle, { factura }),
    React.createElement(Totales, { factura }),
    React.createElement(
      'footer',
      { className: 'pie' },
      React.createElement('p', null, 'Comprobante generado por Factura Bonita.'),
      React.createElement('p', null, 'Documento de solo lectura.')
    )
  );
}

module.exports = {
  FacturaDocument,
  formatoMoneda,
  formatearFecha,
};
