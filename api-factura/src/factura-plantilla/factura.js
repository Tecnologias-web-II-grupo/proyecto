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
    style: 'currency',
    currency: codigo,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

const TIPOS_IDENTIFICACION = {
  '01': 'Física',
  '02': 'Jurídica',
  '03': 'DIMEX',
  '04': 'NITE',
};

const CONDICIONES_VENTA = {
  '01': 'Contado',
  '02': 'Crédito',
  '03': 'Consignación',
  '04': 'Apartado',
  '05': 'Arrendamiento con opción de compra',
  '06': 'Arrendamiento en función financiera',
  '07': 'Cobro a favor de un tercero',
  '08': 'Servicios prestados al Estado a crédito',
  '09': 'Servicios prestados al Estado de contado',
  '10': 'Pago de venta a crédito',
  '11': 'Pago de venta de contado',
};

const MEDIOS_PAGO = {
  '01': 'Efectivo',
  '02': 'Tarjeta',
  '03': 'Cheque',
  '04': 'Transferencia o depósito bancario',
  '05': 'Recaudado por terceros',
  '06': 'SINPE Móvil',
  '07': 'Plataforma digital',
  '99': 'Otros',
};

function descripcionCodigo(mapa, codigo) {
  const valor = texto(codigo, 'No indicado');
  return mapa[valor] ? `${mapa[valor]} (${valor})` : valor;
}

function iniciales(nombre) {
  const partes = texto(nombre, 'F').trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'F';
}

function Campo({ etiqueta, valor, mono = false }) {
  return React.createElement('div', { className: 'campo' },
    React.createElement('span', { className: 'campo-etiqueta' }, etiqueta),
    React.createElement('span', { className: mono ? 'campo-valor mono' : 'campo-valor' }, valor)
  );
}

function Encabezado({ factura }) {
  const emisor = factura.emisor || {};
  const logoUrl = emisor.logoUrl || emisor.logo_url || null;
  const tipoId = texto(emisor.identificacion?.tipo, '');

  return React.createElement('header', { className: 'cabecera' },
    React.createElement('div', { className: 'cabecera-acento' }),
    React.createElement('div', { className: 'cabecera-principal' },
      React.createElement('div', { className: 'identidad' },
        logoUrl
          ? React.createElement('div', { className: 'logo-caja' },
              React.createElement('img', { src: logoUrl, alt: 'Logo del emisor', className: 'logo' }))
          : React.createElement('div', { className: 'logo-iniciales', 'aria-hidden': 'true' }, iniciales(emisor.nombre)),
        React.createElement('div', { className: 'identidad-texto' },
          React.createElement('h1', null, texto(emisor.nombre, 'Emisor')),
          React.createElement('div', { className: 'emisor-datos' },
            React.createElement('span', null,
              `Identificación: ${texto(emisor.identificacion?.numero, 'No indicada')}`),
            React.createElement('span', null,
              `Tipo: ${TIPOS_IDENTIFICACION[tipoId] ? `${TIPOS_IDENTIFICACION[tipoId]} (${tipoId})` : texto(tipoId, 'No indicado')}`),
            React.createElement('span', null, texto(emisor.correo, ''))
          )
        )
      ),
      React.createElement('div', { className: 'documento' },
        React.createElement('span', { className: 'documento-tipo' }, 'FACTURA'),
        React.createElement('strong', { className: 'documento-numero mono' }, texto(factura.id)),
        React.createElement('div', { className: 'documento-meta' },
          React.createElement('span', null, 'Fecha de emisión'),
          React.createElement('strong', null, formatearFecha(factura.fecha)),
          React.createElement('span', null, 'Moneda'),
          React.createElement('strong', null, texto(factura.moneda))
        )
      )
    )
  );
}

function Receptor({ factura }) {
  const receptor = factura.receptor || {};
  const identificacion = receptor.identificacion || {};
  const tipo = texto(identificacion.tipo, '');

  return React.createElement('section', { className: 'bloque receptor' },
    React.createElement('div', { className: 'bloque-titulo' },
      React.createElement('div', null,
        React.createElement('span', { className: 'eyebrow' }, 'DATOS DEL CLIENTE'),
        React.createElement('h2', null, 'Receptor')
      )
    ),
    React.createElement('div', { className: 'receptor-grid' },
      React.createElement(Campo, { etiqueta: 'Nombre', valor: texto(receptor.nombre, 'No indicado') }),
      React.createElement(Campo, {
        etiqueta: 'Identificación',
        valor: texto(identificacion.numero, 'No indicada'),
        mono: true,
      }),
      React.createElement(Campo, {
        etiqueta: 'Tipo de identificación',
        valor: tipo ? descripcionCodigo(TIPOS_IDENTIFICACION, tipo) : 'No indicado',
      }),
      React.createElement(Campo, { etiqueta: 'Correo', valor: texto(receptor.correo, 'No indicado') })
    )
  );
}

function Condiciones({ factura }) {
  return React.createElement('section', { className: 'condiciones' },
    React.createElement('div', { className: 'condicion' },
      React.createElement('span', null, 'Condición de venta'),
      React.createElement('strong', null, descripcionCodigo(CONDICIONES_VENTA, factura.condicionVenta))
    ),
    React.createElement('div', { className: 'condicion' },
      React.createElement('span', null, 'Medio de pago'),
      React.createElement('strong', null, descripcionCodigo(MEDIOS_PAGO, factura.medioPago))
    )
  );
}

function TablaDetalle({ factura }) {
  const filas = factura.items.map((item, index) => React.createElement('tr', { key: `${item.numeroLinea ?? index}-${index}` },
    React.createElement('td', { className: 'centro mono' }, texto(item.numeroLinea ?? index + 1)),
    React.createElement('td', { className: 'descripcion' }, texto(item.detalle)),
    React.createElement('td', { className: 'centro' }, texto(item.cantidad)),
    React.createElement('td', { className: 'derecha' }, formatoMoneda(item.precioUnitario, factura.moneda)),
    React.createElement('td', { className: 'derecha' }, formatoMoneda(item.descuento, factura.moneda)),
    React.createElement('td', { className: 'centro' }, `${Number(item.impuesto?.tarifa || 0)}%`),
    React.createElement('td', { className: 'derecha' }, formatoMoneda(item.subtotal, factura.moneda)),
    React.createElement('td', { className: 'derecha importe' }, formatoMoneda(item.montoTotalLinea, factura.moneda))
  ));

  return React.createElement('section', { className: 'detalle' },
    React.createElement('div', { className: 'seccion-titulo' },
      React.createElement('div', null,
        React.createElement('span', { className: 'eyebrow' }, 'CONCEPTOS FACTURADOS'),
        React.createElement('h2', null, 'Detalle')
      ),
      React.createElement('span', { className: 'lineas' }, `${factura.items.length} ${factura.items.length === 1 ? 'línea' : 'líneas'}`)
    ),
    React.createElement('div', { className: 'tabla-contenedor' },
      React.createElement('table', null,
        React.createElement('thead', null,
          React.createElement('tr', null,
            ['#', 'Descripción', 'Cantidad', 'Precio unitario', 'Descuento', 'Impuesto', 'Subtotal', 'Total']
              .map((titulo) => React.createElement('th', { key: titulo }, titulo))
          )
        ),
        React.createElement('tbody', null, filas)
      )
    )
  );
}

function Totales({ factura }) {
  const totales = factura.totales || {};
  const filas = [
    ['Total gravado', totales.totalGravado],
    ['Total exento', totales.totalExento],
    ['Descuentos', totales.totalDescuentos],
    ['Impuestos', totales.totalImpuesto],
  ];

  return React.createElement('section', { className: 'cierre' },
    React.createElement('div', { className: 'nota' },
      React.createElement('strong', null, 'Comprobante para el cliente'),
      React.createElement('p', null,
        'Este documento fue generado en formato PDF de solo lectura. Los datos corresponden al registro almacenado por el servicio de facturación.'
      )
    ),
    React.createElement('div', { className: 'totales' },
      filas.map(([etiqueta, valor]) => React.createElement('div', { className: 'total-fila', key: etiqueta },
        React.createElement('span', null, etiqueta),
        React.createElement('strong', null, formatoMoneda(valor, factura.moneda))
      )),
      React.createElement('div', { className: 'total-fila total-principal' },
        React.createElement('span', null, 'Total comprobante'),
        React.createElement('strong', null, formatoMoneda(totales.totalComprobante, factura.moneda))
      )
    )
  );
}

function FacturaDocument({ factura }) {
  return React.createElement('main', { className: 'factura' },
    React.createElement(Encabezado, { factura }),
    React.createElement('div', { className: 'contenido' },
      React.createElement(Receptor, { factura }),
      React.createElement(Condiciones, { factura }),
      React.createElement(TablaDetalle, { factura }),
      React.createElement(Totales, { factura })
    ),
    React.createElement('footer', { className: 'pie' },
      React.createElement('span', null, texto(factura.emisor?.nombre, 'Emisor')),
      React.createElement('span', { className: 'mono' }, texto(factura.id)),
      React.createElement('span', null, 'PDF de solo lectura')
    )
  );
}

module.exports = { FacturaDocument, formatoMoneda, formatearFecha };
