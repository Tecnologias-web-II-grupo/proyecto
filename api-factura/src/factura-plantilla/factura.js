const React = require('react');

function texto(v, fallback = '—') {
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return String(v);
}

function fecha(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return texto(v);
  return new Intl.DateTimeFormat('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(d);
}

function dinero(v, moneda = 'CRC') {
  const n = Number(v || 0);
  const c = String(moneda || 'CRC').toUpperCase();
  try {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency', currency: c, minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(n);
  } catch {
    return `${c} ${n.toFixed(2)}`;
  }
}

function ini(nombre) {
  return texto(nombre, 'F')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase();
}

const ID = {
  '01': 'Persona física',
  '02': 'Persona jurídica',
  '03': 'DIMEX',
  '04': 'NITE',
  '05': 'Extranjero no domiciliado',
  '06': 'No contribuyente'
};

const CV = {
  '01': 'Contado', '02': 'Crédito', '03': 'Consignación', '04': 'Apartado',
  '05': 'Arrendamiento con opción de compra', '06': 'Arrendamiento financiero',
  '07': 'Cobro a favor de tercero', '08': 'Servicios al Estado a crédito',
  '09': 'Servicios al Estado de contado', '10': 'Venta a crédito IVA hasta 90 días',
  '11': 'Pago de venta a crédito IVA hasta 90 días', '12': 'Mercancía no nacionalizada',
  '13': 'Bienes usados no contribuyente', '14': 'Arrendamiento operativo',
  '15': 'Arrendamiento financiero', '99': 'Otros'
};

const MP = {
  '01': 'Efectivo', '02': 'Tarjeta', '03': 'Cheque', '04': 'Transferencia/depósito',
  '05': 'Recaudado por terceros', '06': 'SINPE Móvil', '07': 'Plataforma digital', '99': 'Otros'
};

function cod(map, v) {
  const k = texto(v, '');
  return map[k] ? `${map[k]} · ${k}` : texto(v);
}

function primerImpuesto(item) {
  if (Array.isArray(item?.impuestos) && item.impuestos.length) return item.impuestos[0] || {};
  return item?.impuesto || {};
}

function telefonoTexto(p = {}) {
  const t = p.telefono || {};
  if (typeof t === 'string') return texto(t);
  return t.numero ? `${t.codigoPais ? `+${t.codigoPais} ` : ''}${t.numero}` : '—';
}

function direccionTexto(p = {}) {
  const u = p.ubicacion || {};
  if (u.otrasSenas || u.otrasSenasExtranjero) return u.otrasSenas || u.otrasSenasExtranjero;
  const partes = [u.provincia, u.canton, u.distrito, u.barrio].filter(Boolean);
  return partes.length ? partes.join(', ') : '—';
}

function tiene(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function Meta({ label, value }) {
  return React.createElement('div', { className: 'meta-cell' },
    React.createElement('span', null, label),
    React.createElement('strong', null, texto(value))
  );
}

function Header({ f }) {
  const e = f.emisor || {};
  const logo = e.logoUrl || e.logoUrlBlanco;
  const logoPosicion = ['left', 'center', 'right'].includes(String(e.logoPosicion || '').toLowerCase())
    ? String(e.logoPosicion).toLowerCase()
    : 'left';

  return React.createElement(React.Fragment, null,
    React.createElement('header', { className: `invoice-header logo-${logoPosicion}` },
      React.createElement('div', { className: 'issuer-head' },
        React.createElement('div', { className: 'logo-slot' },
          logo
            ? React.createElement('img', { src: logo, alt: 'Logo del emisor' })
            : React.createElement('div', { className: 'logo-fallback' }, ini(e.nombre))
        ),
        React.createElement('div', { className: 'issuer-title' },
          React.createElement('h1', null, texto(e.nombre, 'Emisor')),
          React.createElement('p', null, texto(e.correo))
        )
      ),
      React.createElement('div', { className: 'invoice-number' },
        React.createElement('span', null, 'FACTURA'),
        React.createElement('strong', null, texto(f.id, 'Sin número'))
      )
    ),
    React.createElement('section', { className: 'meta-strip' },
      React.createElement(Meta, { label: 'Fecha', value: fecha(f.fecha) }),
      React.createElement(Meta, { label: 'Moneda', value: f.moneda }),
      React.createElement(Meta, { label: 'Condición', value: cod(CV, f.condicionVenta) }),
      React.createElement(Meta, { label: 'Medio de pago', value: cod(MP, f.medioPago) }),
      React.createElement(Meta, {
        label: 'Plazo',
        value: `${Number(f.plazoCreditoDias ?? f.plazoCredito ?? 0)} días`
      })
    )
  );
}

function Concept({ f }) {
  const items = Array.isArray(f.items) ? f.items : [];
  const detalle = items.length === 1
    ? texto(items[0]?.detalle, 'Concepto facturado')
    : `${items.length} conceptos facturados`;

  return React.createElement('section', { className: 'concept-row' },
    React.createElement('div', null,
      React.createElement('span', null, 'CONCEPTO'),
      React.createElement('strong', null, detalle)
    ),
    React.createElement('div', { className: 'concept-total' },
      React.createElement('span', null, 'TOTAL'),
      React.createElement('strong', null, dinero(f.totales?.totalComprobante, f.moneda))
    )
  );
}

function Items({ f }) {
  const items = Array.isArray(f.items) ? f.items : [];
  return React.createElement('section', { className: 'section block-items' },
    React.createElement('h2', null, 'Conceptos facturados'),
    React.createElement('div', { className: 'table-wrap' },
      React.createElement('table', { className: 'items-table' },
        React.createElement('thead', null,
          React.createElement('tr', null,
            ['#', 'CAByS', 'Descripción', 'Cant.', 'Unidad', 'Precio', 'Desc.', 'IVA', 'Subtotal', 'Total']
              .map((x) => React.createElement('th', { key: x }, x))
          )
        ),
        React.createElement('tbody', null,
          items.map((it, i) => {
            const imp = primerImpuesto(it);
            return React.createElement('tr', { key: `${it.numeroLinea || i}-${i}` },
              React.createElement('td', null, it.numeroLinea ?? i + 1),
              React.createElement('td', null, texto(it.codigoCabys)),
              React.createElement('td', null, texto(it.detalle)),
              React.createElement('td', null, texto(it.cantidad)),
              React.createElement('td', null, texto(it.unidadMedida)),
              React.createElement('td', { className: 'money' }, dinero(it.precioUnitario, f.moneda)),
              React.createElement('td', { className: 'money' }, dinero(it.descuento, f.moneda)),
              React.createElement('td', null, `${Number(imp.tarifa || 0)}%`),
              React.createElement('td', { className: 'money' }, dinero(it.subtotal, f.moneda)),
              React.createElement('td', { className: 'money strong' }, dinero(it.montoTotalLinea, f.moneda))
            );
          })
        )
      )
    )
  );
}

function PartyField({ label, value, wide = false }) {
  if (!tiene(value) || value === '—') return null;
  return React.createElement('div', { className: `party-field${wide ? ' wide' : ''}` },
    React.createElement('span', null, label),
    React.createElement('strong', null, value)
  );
}

function Party({ title, p = {} }) {
  const idTipo = p.identificacion?.tipo;
  return React.createElement('section', { className: 'party' },
    React.createElement('h2', null, title),
    React.createElement('div', { className: 'party-grid' },
      React.createElement(PartyField, { label: 'Nombre / razón social', value: p.nombre }),
      React.createElement(PartyField, { label: 'Identificación', value: p.identificacion?.numero }),
      React.createElement(PartyField, { label: 'Tipo', value: idTipo ? cod(ID, idTipo) : null }),
      React.createElement(PartyField, { label: 'Correo', value: p.correo }),
      React.createElement(PartyField, { label: 'Nombre comercial', value: p.nombreComercial }),
      React.createElement(PartyField, { label: 'Actividad económica', value: p.actividadEconomica }),
      React.createElement(PartyField, { label: 'Teléfono', value: telefonoTexto(p) }),
      React.createElement(PartyField, { label: 'Otras señas', value: direccionTexto(p), wide: true })
    )
  );
}

function Parties({ f }) {
  return React.createElement('section', { className: 'parties' },
    React.createElement(Party, { title: 'Emisor', p: f.emisor || {} }),
    React.createElement(Party, { title: 'Cliente', p: f.receptor || {} })
  );
}

function impuestoResumen(item, moneda) {
  const imp = primerImpuesto(item);
  const partes = [];
  if (tiene(imp.codigo)) partes.push(texto(imp.codigo));
  partes.push(`${Number(imp.tarifa || 0)}%`);
  if (tiene(imp.codigoTarifaIVA)) partes.push(`tarifa ${imp.codigoTarifaIVA}`);
  if (tiene(imp.monto)) partes.push(dinero(imp.monto, moneda));
  return partes.join(' · ');
}

function Fiscal({ f }) {
  const items = Array.isArray(f.items) ? f.items : [];
  return React.createElement('section', { className: 'section fiscal' },
    React.createElement('h2', null, 'Información fiscal por línea'),
    React.createElement('div', { className: 'table-wrap' },
      React.createElement('table', { className: 'fiscal-table' },
        React.createElement('thead', null,
          React.createElement('tr', null,
            ['Línea', 'Unidad comercial', 'Tipo transacción', 'Base imponible', 'Código comercial', 'Impuesto']
              .map((x) => React.createElement('th', { key: x }, x))
          )
        ),
        React.createElement('tbody', null,
          items.map((it, i) => {
            const comerciales = Array.isArray(it.codigosComerciales) ? it.codigosComerciales : [];
            const comercial = comerciales[0] || {};
            return React.createElement('tr', { key: `f-${i}` },
              React.createElement('td', null, it.numeroLinea ?? i + 1),
              React.createElement('td', null, texto(it.unidadMedidaComercial || it.unidadMedida)),
              React.createElement('td', null, texto(it.tipoTransaccion)),
              React.createElement('td', { className: 'money' }, dinero(it.baseImponible ?? it.subtotal, f.moneda)),
              React.createElement('td', null, texto(comercial.codigo)),
              React.createElement('td', null, impuestoResumen(it, f.moneda))
            );
          })
        )
      )
    )
  );
}

function Summary({ f }) {
  const t = f.totales || {};
  const rows = [
    ['Servicios gravados', t.totalServiciosGravados ?? t.totalServGravados],
    ['Servicios exentos', t.totalServiciosExentos ?? t.totalServExentos],
    ['Servicios exonerados', t.totalServiciosExonerados ?? t.totalServExonerados],
    ['Servicios no sujetos', t.totalServiciosNoSujetos ?? t.totalServNoSujetos],
    ['Mercancías gravadas', t.totalMercanciasGravadas],
    ['Mercancías exentas', t.totalMercanciasExentas],
    ['Mercancías exoneradas', t.totalMercanciasExoneradas],
    ['Mercancías no sujetas', t.totalMercanciasNoSujetas],
    ['Total gravado', t.totalGravado],
    ['Total exento', t.totalExento],
    ['Total exonerado', t.totalExonerado],
    ['Total no sujeto', t.totalNoSujeto],
    ['Total venta', t.totalVenta],
    ['Descuentos', t.totalDescuentos],
    ['Venta neta', t.totalVentaNeta],
    ['Impuestos', t.totalImpuesto],
    ['IVA devuelto', t.totalIVADevuelto],
    ['Otros cargos', t.totalOtrosCargos]
  ];

  return React.createElement('section', { className: 'section summary' },
    React.createElement('h2', null, 'Resumen de importes'),
    React.createElement('div', { className: 'summary-grid' },
      ...rows.map(([label, value]) => React.createElement('div', { className: 'summary-row', key: label },
        React.createElement('span', null, label),
        React.createElement('strong', null, dinero(value, f.moneda))
      ))
    ),
    React.createElement('div', { className: 'grand-total' },
      React.createElement('span', null, 'TOTAL'),
      React.createElement('strong', null, dinero(t.totalComprobante, f.moneda))
    )
  );
}

function FacturaDocument({ factura: f }) {
  return React.createElement('main', { className: 'invoice' },
    React.createElement(Header, { f }),
    React.createElement('div', { className: 'content' },
      React.createElement(Concept, { f }),
      React.createElement(Items, { f }),
      React.createElement(Parties, { f }),
      React.createElement(Fiscal, { f }),
      React.createElement(Summary, { f })
    ),
    React.createElement('footer', null,
      React.createElement('span', null, texto(f.emisor?.nombre, 'Emisor')),
      React.createElement('span', null, texto(f.id))
    )
  );
}

module.exports = { FacturaDocument, formatoMoneda: dinero, formatearFecha: fecha };
