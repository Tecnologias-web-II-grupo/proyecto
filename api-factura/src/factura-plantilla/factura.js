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
  return parsed.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatoMoneda(valor, moneda) {
  const numero = Number(valor || 0);
  const codigo = moneda === 'USD' ? 'USD' : 'CRC';
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: codigo, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(numero);
}

function Dato({ etiqueta, children, mono = false }) {
  return React.createElement('div', { className: 'dato' },
    React.createElement('span', { className: 'dato-etiqueta' }, etiqueta),
    React.createElement('span', { className: mono ? 'dato-valor mono' : 'dato-valor' }, children)
  );
}

function TarjetaPersona({ titulo, persona, variante }) {
  const identificacion = persona?.identificacion;
  return React.createElement('section', { className: `tarjeta ${variante || ''}`.trim() },
    React.createElement('div', { className: 'tarjeta-titulo' },
      React.createElement('span', { className: 'tarjeta-icono', 'aria-hidden': 'true' }, titulo === 'EMISOR' ? 'E' : 'R'),
      React.createElement('h3', null, titulo)
    ),
    React.createElement(Dato, { etiqueta: 'Nombre' }, texto(persona?.nombre, 'No indicado')),
    React.createElement(Dato, { etiqueta: 'Tipo de identificación' }, texto(identificacion?.tipo, 'No indicada')),
    React.createElement(Dato, { etiqueta: 'Identificación', mono: true }, texto(identificacion?.numero, 'No indicada')),
    React.createElement(Dato, { etiqueta: 'Correo' }, texto(persona?.correo, 'No indicado'))
  );
}

function Encabezado({ factura }) {
  const logoUrl = factura?.emisor?.logoUrl || factura?.emisor?.logo_url || null;
  return React.createElement('header', { className: 'encabezado' },
    React.createElement('div', { className: 'accent-bar' }),
    React.createElement('div', { className: 'encabezado-contenido' },
      React.createElement('div', { className: 'marca' },
        logoUrl
          ? React.createElement('div', { className: 'logo-wrap' }, React.createElement('img', {
              src: logoUrl, alt: 'Logo de EduControl', className: 'logo-emisor',
            }))
          : React.createElement('div', { className: 'logo-placeholder', 'aria-hidden': 'true' }, 'EC'),
        React.createElement('div', null,
          React.createElement('div', { className: 'marca-nombre' }, 'EduControl'),
          React.createElement('div', { className: 'marca-subtitulo' }, 'Comprobante de ingreso')
        )
      ),
      React.createElement('div', { className: 'datos-factura' },
        React.createElement('span', { className: 'factura-kicker' }, 'FACTURA'),
        React.createElement('strong', { className: 'factura-numero mono' }, texto(factura.id)),
        React.createElement('div', { className: 'factura-meta' },
          React.createElement('span', null, `Fecha: ${formatearFecha(factura.fecha)}`),
          React.createElement('span', null, `Moneda: ${texto(factura.moneda)}`)
        )
      )
    )
  );
}

function TablaDetalle({ factura }) {
  const filas = factura.items.map((item, index) => React.createElement('tr', { key: `${item.numeroLinea ?? index}-${index}` },
    React.createElement('td', { className: 'center mono' }, texto(item.numeroLinea ?? index + 1)),
    React.createElement('td', { className: 'descripcion' }, texto(item.detalle)),
    React.createElement('td', { className: 'center' }, texto(item.cantidad)),
    React.createElement('td', { className: 'numero' }, formatoMoneda(item.precioUnitario, factura.moneda)),
    React.createElement('td', { className: 'numero' }, formatoMoneda(item.descuento, factura.moneda)),
    React.createElement('td', { className: 'center' }, `${Number(item.impuesto?.tarifa || 0)}%`),
    React.createElement('td', { className: 'numero' }, formatoMoneda(item.subtotal, factura.moneda)),
    React.createElement('td', { className: 'numero total-linea' }, formatoMoneda(item.montoTotalLinea, factura.moneda))
  ));
  return React.createElement('section', { className: 'detalle' },
    React.createElement('div', { className: 'section-heading' },
      React.createElement('h3', null, 'Detalle de la factura'),
      React.createElement('span', null, `${factura.items.length} ${factura.items.length === 1 ? 'línea' : 'líneas'}`)
    ),
    React.createElement('div', { className: 'tabla-wrap' },
      React.createElement('table', null,
        React.createElement('thead', null, React.createElement('tr', null,
          ['Línea', 'Descripción', 'Cant.', 'Precio unit.', 'Descuento', 'Imp.', 'Subtotal', 'Total']
            .map((titulo) => React.createElement('th', { key: titulo }, titulo))
        )),
        React.createElement('tbody', null, filas)
      )
    )
  );
}

function Totales({ factura }) {
  const totales = factura.totales;
  const filas = [
    ['Total gravado', totales.totalGravado], ['Total exento', totales.totalExento],
    ['Descuentos', totales.totalDescuentos], ['Impuesto', totales.totalImpuesto],
  ];
  return React.createElement('section', { className: 'resumen-final' },
    React.createElement('div', { className: 'nota-comprobante' },
      React.createElement('strong', null, 'Información del comprobante'),
      React.createElement('p', null, 'Documento generado por EduControl en formato PDF de solo lectura.'),
      React.createElement('div', { className: 'chips' },
        React.createElement('span', null, `Condición: ${texto(factura.condicionVenta)}`),
        React.createElement('span', null, `Medio de pago: ${texto(factura.medioPago)}`)
      )
    ),
    React.createElement('div', { className: 'totales' },
      filas.map(([etiqueta, valor]) => React.createElement('div', { className: 'fila-total', key: etiqueta },
        React.createElement('span', null, etiqueta),
        React.createElement('strong', null, formatoMoneda(valor, factura.moneda))
      )),
      React.createElement('div', { className: 'fila-total total-final' },
        React.createElement('span', null, 'Total comprobante'),
        React.createElement('strong', null, formatoMoneda(totales.totalComprobante, factura.moneda))
      )
    )
  );
}

function FacturaDocument({ factura }) {
  return React.createElement('main', { className: 'factura' },
    React.createElement(Encabezado, { factura }),
    React.createElement('div', { className: 'personas' },
      React.createElement(TarjetaPersona, { titulo: 'EMISOR', persona: factura.emisor, variante: 'tarjeta-emisor' }),
      React.createElement(TarjetaPersona, { titulo: 'RECEPTOR', persona: factura.receptor, variante: 'tarjeta-receptor' })
    ),
    React.createElement(TablaDetalle, { factura }),
    React.createElement(Totales, { factura }),
    React.createElement('footer', { className: 'pie' },
      React.createElement('span', null, 'EduControl'),
      React.createElement('span', null, `Factura ${texto(factura.id)}`),
      React.createElement('span', null, 'Solo lectura')
    )
  );
}

module.exports = { FacturaDocument, formatoMoneda, formatearFecha };
