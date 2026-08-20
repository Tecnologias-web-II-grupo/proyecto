const React = require('react');
const { dinero, codigo, PAGOS, otrosTexto, fecha, texto } = require('../formatters');

function positivo(value) {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) > 0.000001;
}

function InvoiceSummary({ factura }) {
  const t = factura.totales || {};
  const subtotal = t.totalVentaNeta ?? t.totalVenta ?? t.totalGravado ?? t.totalExento;
  const rows = [
    ['Subtotal / venta neta', subtotal, true],
    ['Descuentos', t.totalDescuentos, positivo(t.totalDescuentos)],
    ['Impuestos', t.totalImpuesto, positivo(t.totalImpuesto)],
    ['IVA devuelto', t.totalIVADevuelto, positivo(t.totalIVADevuelto)],
    ['Otros cargos', t.totalOtrosCargos, positivo(t.totalOtrosCargos)],
    ['Total exento', t.totalExento, positivo(t.totalExento)],
    ['Total exonerado', t.totalExonerado, positivo(t.totalExonerado)],
    ['Total no sujeto', t.totalNoSujeto, positivo(t.totalNoSujeto)]
  ].filter(([, value, visible]) => visible && value !== undefined && value !== null);

  const medios = Array.isArray(t.mediosPago) ? t.mediosPago : [];
  const refs = Array.isArray(factura.referencias) ? factura.referencias : [];
  const cargos = Array.isArray(factura.otrosCargos) ? factura.otrosCargos : [];
  const otros = otrosTexto(factura);
  const condicion = factura.detalleCondicionVenta || factura.detalleCondicionVentaOtro;

  const meta = [
    medios.length ? ['Pago', medios.map((m) => `${codigo(PAGOS, m.tipo)} · ${dinero(m.total ?? m.monto, factura.moneda)}`).join(' | ')] : null,
    condicion ? ['Condición', condicion] : null,
    factura.origen ? ['Origen', factura.origen] : null,
    factura.referenciaExterna ? ['Referencia', factura.referenciaExterna] : null
  ].filter(Boolean);

  return React.createElement('section', { className: 'closing' },
    React.createElement('div', { className: 'closing-notes' },
      React.createElement('h3', null, 'Información del comprobante'),
      meta.length ? React.createElement('dl', { className: 'closing-meta' },
        ...meta.flatMap(([label, value]) => [
          React.createElement('dt', { key: `${label}-dt` }, label),
          React.createElement('dd', { key: `${label}-dd` }, texto(value))
        ])
      ) : null,
      (otros.length || cargos.length || refs.length) ? React.createElement('div', { className: 'closing-extra' },
        ...otros.map((o, i) => React.createElement('p', { key: `o${i}` }, o)),
        ...cargos.map((c, i) => React.createElement('p', { key: `c${i}` }, `Cargo adicional: ${c.detalle || c.tipoDocumento || 'Cargo'} · ${dinero(c.monto, factura.moneda)}`)),
        ...refs.map((r, i) => React.createElement('p', { key: `r${i}` }, `Referencia: ${r.tipoDocumento || '—'} · ${r.numero || r.numeroDocumento || '—'} · ${fecha(r.fechaEmision)}${r.razon ? ` · ${r.razon}` : ''}`))
      ) : null
    ),
    React.createElement('div', { className: 'totals' },
      React.createElement('h3', null, 'Totales'),
      ...rows.map(([label, value]) => React.createElement('div', { className: 'total-row', key: label },
        React.createElement('span', null, label),
        React.createElement('strong', null, dinero(value, factura.moneda))
      )),
      React.createElement('div', { className: 'grand' },
        React.createElement('span', null, 'TOTAL'),
        React.createElement('strong', null, dinero(t.totalComprobante, factura.moneda))
      )
    )
  );
}

module.exports = InvoiceSummary;
