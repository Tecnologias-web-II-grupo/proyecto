const React = require('react');

function texto(valor, fallback = '') {
  if (valor === null || valor === undefined || valor === '') return fallback;
  return String(valor);
}

function formatearFecha(fecha) {
  const match = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return texto(fecha, 'No indicada');
  return parsed.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatoMoneda(valor, moneda) {
  const numero = Number(valor || 0);
  const codigo = String(moneda || 'CRC').toUpperCase() === 'USD' ? 'USD' : 'CRC';
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: codigo, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(numero);
}

const TIPOS_IDENTIFICACION = {
  '01': 'Persona física', '02': 'Persona jurídica', '03': 'DIMEX', '04': 'NITE',
};
const CONDICIONES_VENTA = {
  '01': 'Contado', '02': 'Crédito', '03': 'Consignación', '04': 'Apartado',
  '05': 'Arrendamiento con opción de compra', '06': 'Arrendamiento financiero',
  '07': 'Cobro a favor de tercero', '08': 'Servicios al Estado a crédito',
  '09': 'Servicios al Estado de contado', '10': 'Pago de venta a crédito', '11': 'Pago de venta de contado',
};
const MEDIOS_PAGO = {
  '01': 'Efectivo', '02': 'Tarjeta', '03': 'Cheque', '04': 'Transferencia / depósito',
  '05': 'Recaudado por terceros', '06': 'SINPE Móvil', '07': 'Plataforma digital', '99': 'Otro',
};

function descripcionCodigo(mapa, codigo) {
  const valor = texto(codigo, 'No indicado');
  return mapa[valor] ? `${mapa[valor]} · ${valor}` : valor;
}

function iniciales(nombre) {
  const partes = texto(nombre, 'F').trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'F';
}

function Dato({ etiqueta, valor, mono = false }) {
  return React.createElement('div', { className: 'dato' },
    React.createElement('span', { className: 'dato-label' }, etiqueta),
    React.createElement('strong', { className: mono ? 'dato-value mono' : 'dato-value' }, texto(valor, 'No indicado'))
  );
}

function TarjetaPersona({ titulo, persona, tipo = 'cliente' }) {
  const identificacion = persona?.identificacion || {};
  return React.createElement('section', { className: `persona-card ${tipo}` },
    React.createElement('div', { className: 'persona-title' },
      React.createElement('span', { className: 'persona-kicker' }, tipo === 'emisor' ? 'QUIEN EMITE' : 'QUIEN RECIBE'),
      React.createElement('h2', null, titulo)
    ),
    React.createElement('div', { className: 'persona-grid' },
      React.createElement(Dato, { etiqueta: 'Nombre o razón social', valor: persona?.nombre }),
      React.createElement(Dato, { etiqueta: 'Identificación', valor: identificacion.numero, mono: true }),
      React.createElement(Dato, { etiqueta: 'Tipo de identificación', valor: identificacion.tipo ? descripcionCodigo(TIPOS_IDENTIFICACION, identificacion.tipo) : 'No indicado' }),
      React.createElement(Dato, { etiqueta: 'Correo electrónico', valor: persona?.correo })
    )
  );
}

function Encabezado({ factura }) {
  const emisor = factura.emisor || {};
  const logoUrl = emisor.logoUrl || emisor.logo_url || null;
  return React.createElement(React.Fragment, null,
    React.createElement('header', { className: 'hero' },
      React.createElement('div', { className: 'hero-brand' },
        logoUrl
          ? React.createElement('div', { className: 'logo-box' }, React.createElement('img', { src: logoUrl, alt: 'Logo', className: 'logo-img' }))
          : React.createElement('div', { className: 'logo-fallback' }, iniciales(emisor.nombre)),
        React.createElement('div', { className: 'brand-copy' },
          React.createElement('span', { className: 'brand-overline' }, 'COMPROBANTE DE INGRESO · EDUCONTROL'),
          React.createElement('h1', null, texto(emisor.nombre, 'Emisor')),
          React.createElement('span', { className: 'brand-email' }, texto(emisor.correo, ''))
        )
      ),
      React.createElement('div', { className: 'invoice-id' },
        React.createElement('span', { className: 'invoice-word' }, 'FACTURA'),
        React.createElement('strong', { className: 'invoice-number mono' }, texto(factura.id, 'Sin número')),
        React.createElement('span', { className: 'readonly-pill' }, 'PDF · SOLO LECTURA')
      )
    ),
    React.createElement('section', { className: 'meta-strip' },
      React.createElement(Dato, { etiqueta: 'Fecha de emisión', valor: formatearFecha(factura.fecha) }),
      React.createElement(Dato, { etiqueta: 'Moneda', valor: texto(factura.moneda, 'CRC') }),
      React.createElement(Dato, { etiqueta: 'Condición de venta', valor: descripcionCodigo(CONDICIONES_VENTA, factura.condicionVenta) }),
      React.createElement(Dato, { etiqueta: 'Medio de pago', valor: descripcionCodigo(MEDIOS_PAGO, factura.medioPago) })
    )
  );
}

function TablaDetalle({ factura }) {
  const items = Array.isArray(factura.items) ? factura.items : [];
  return React.createElement('section', { className: 'detalle-section' },
    React.createElement('div', { className: 'section-heading' },
      React.createElement('div', null,
        React.createElement('span', { className: 'section-kicker' }, 'DETALLE DEL COMPROBANTE'),
        React.createElement('h2', null, 'Conceptos facturados')
      ),
      React.createElement('span', { className: 'count-pill' }, `${items.length} ${items.length === 1 ? 'línea' : 'líneas'}`)
    ),
    React.createElement('div', { className: 'table-shell' },
      React.createElement('table', null,
        React.createElement('thead', null,
          React.createElement('tr', null,
            ['#', 'Descripción', 'Cant.', 'Precio unit.', 'Descuento', 'Imp.', 'Subtotal', 'Total']
              .map((t) => React.createElement('th', { key: t }, t))
          )
        ),
        React.createElement('tbody', null,
          items.map((item, index) => React.createElement('tr', { key: `${item.numeroLinea ?? index}-${index}` },
            React.createElement('td', { className: 'center mono' }, texto(item.numeroLinea ?? index + 1)),
            React.createElement('td', { className: 'desc' }, texto(item.detalle, 'Sin descripción')),
            React.createElement('td', { className: 'center' }, texto(item.cantidad, '0')),
            React.createElement('td', { className: 'money' }, formatoMoneda(item.precioUnitario, factura.moneda)),
            React.createElement('td', { className: 'money' }, formatoMoneda(item.descuento, factura.moneda)),
            React.createElement('td', { className: 'center' }, `${Number(item.impuesto?.tarifa || 0)}%`),
            React.createElement('td', { className: 'money' }, formatoMoneda(item.subtotal, factura.moneda)),
            React.createElement('td', { className: 'money strong-money' }, formatoMoneda(item.montoTotalLinea, factura.moneda))
          ))
        )
      )
    )
  );
}

function Cierre({ factura }) {
  const t = factura.totales || {};
  const filas = [
    ['Subtotal gravado', t.totalGravado], ['Subtotal exento', t.totalExento],
    ['Descuentos', t.totalDescuentos], ['Impuestos', t.totalImpuesto],
  ];
  return React.createElement('section', { className: 'closing-grid' },
    React.createElement('div', { className: 'document-note' },
      React.createElement('span', { className: 'section-kicker' }, 'INFORMACIÓN DEL DOCUMENTO'),
      React.createElement('h3', null, 'Comprobante para el cliente de EduControl'),
      React.createElement('p', null, 'Documento generado por EduControl mediante el servicio compartido de facturación. PDF de solo lectura con los datos registrados por el sistema.'),
      React.createElement('div', { className: 'security-row' },
        React.createElement('span', null, 'Solo lectura'),
        React.createElement('span', null, `Factura ${texto(factura.id, '')}`)
      )
    ),
    React.createElement('div', { className: 'summary-card' },
      React.createElement('div', { className: 'summary-title' }, 'Resumen de importes'),
      filas.map(([label, value]) => React.createElement('div', { className: 'summary-row', key: label },
        React.createElement('span', null, label), React.createElement('strong', null, formatoMoneda(value, factura.moneda))
      )),
      React.createElement('div', { className: 'grand-total' },
        React.createElement('span', null, 'TOTAL'),
        React.createElement('strong', null, formatoMoneda(t.totalComprobante, factura.moneda))
      )
    )
  );
}

function FacturaDocument({ factura }) {
  const emisor = factura.emisor || {};
  const receptor = factura.receptor || {};
  return React.createElement('main', { className: 'factura' },
    React.createElement(Encabezado, { factura }),
    React.createElement('div', { className: 'content' },
      React.createElement('div', { className: 'people-grid' },
        React.createElement(TarjetaPersona, { titulo: 'Datos del emisor', persona: emisor, tipo: 'emisor' }),
        React.createElement(TarjetaPersona, { titulo: 'Datos del cliente', persona: receptor, tipo: 'cliente' })
      ),
      React.createElement(TablaDetalle, { factura }),
      React.createElement(Cierre, { factura })
    ),
    React.createElement('footer', { className: 'footer' },
      React.createElement('span', null, texto(emisor.nombre, 'Emisor')),
      React.createElement('span', { className: 'mono' }, texto(factura.id, '')),
      React.createElement('span', null, 'Comprobante PDF de solo lectura')
    )
  );
}

module.exports = { FacturaDocument, formatoMoneda, formatearFecha };
