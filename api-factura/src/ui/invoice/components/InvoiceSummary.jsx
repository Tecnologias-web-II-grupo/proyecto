const React = require('react');
const { dinero, codigo, PAGOS, otrosTexto, fecha, texto } = require('../formatters');

function existe(v) {
  return v !== undefined && v !== null && v !== '';
}

function InvoiceSummary({ factura }) {
  const t = factura.totales || {};

  const rows = [
    ['Servicios gravados', t.totalServGravados],
    ['Servicios exentos', t.totalServExentos],
    ['Servicios exonerados', t.totalServExonerados],
    ['Servicios no sujetos', t.totalServNoSujetos],
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
  ].filter(([, value]) => existe(value));

  const medios = Array.isArray(t.mediosPago) ? t.mediosPago : [];
  const refs = Array.isArray(factura.referencias) ? factura.referencias : [];
  const cargos = Array.isArray(factura.otrosCargos) ? factura.otrosCargos : [];
  const otros = otrosTexto(factura);
  const condicion = factura.detalleCondicionVenta || factura.detalleCondicionVentaOtro;

  // Nota: los campos puramente internos (perfil de renderizado, sistema de
  // origen, número de factura ya visible en el sello del encabezado, o el
  // aviso de "solo lectura" ya indicado arriba) se omiten aquí a propósito
  // para no duplicar información que el cliente ya vio. Siguen existiendo
  // en el registro/XML del comprobante, solo no se repiten en el impreso.
  const meta = [
    medios.length ? ['Pago', medios.map((m) => `${codigo(PAGOS, m.tipo)} · ${dinero(m.total ?? m.monto, factura.moneda)}`).join(' | ')] : null,
    condicion ? ['Condición', condicion] : null,
    factura.referenciaExterna ? ['Referencia', factura.referenciaExterna] : null
  ].filter(Boolean);

  const hayExtra = otros.length || cargos.length || refs.length;

  return React.createElement('section', { className: 'closing' },
    React.createElement('div', { className: 'closing-notes' },
      React.createElement('h3', null, 'Información del comprobante'),
      meta.length ? React.createElement('dl', { className: 'closing-meta' },
        ...meta.flatMap(([label, value]) => [
          React.createElement('dt', { key: `${label}-dt` }, label),
          React.createElement('dd', { key: `${label}-dd` }, texto(value))
        ])
      ) : (!hayExtra ? React.createElement('p', { className: 'closing-help' }, 'Sin notas adicionales para este comprobante.') : null),
      hayExtra ? React.createElement('div', { className: 'closing-extra' },
        ...otros.map((o, i) => React.createElement('p', { key: `o${i}` }, o)),
        ...cargos.map((c, i) => React.createElement('p', { key: `c${i}` }, `Cargo adicional: ${c.detalle || c.tipoDocumento || 'Cargo'} · ${dinero(c.monto, factura.moneda)}`)),
        ...refs.map((r, i) => React.createElement('p', { key: `r${i}` }, `Referencia: ${r.tipoDocumento || '—'} · ${r.numero || r.numeroDocumento || '—'} · ${fecha(r.fechaEmision)}${r.razon ? ` · ${r.razon}` : ''}`))
      ) : null
    ),
    React.createElement('div', { className: 'totals' },
      React.createElement('h3', null, 'Resumen de importes'),
      React.createElement('div', { className: 'totals-grid' },
        ...rows.map(([label, value]) => React.createElement('div', { className: 'total-row', key: label },
          React.createElement('span', null, label),
          React.createElement('strong', null, dinero(value, factura.moneda))
        ))
      ),
      React.createElement('div', { className: 'grand' },
        React.createElement('span', null, 'TOTAL COMPROBANTE'),
        React.createElement('strong', null, dinero(t.totalComprobante, factura.moneda))
      )
    )
  );
}

module.exports = InvoiceSummary;
