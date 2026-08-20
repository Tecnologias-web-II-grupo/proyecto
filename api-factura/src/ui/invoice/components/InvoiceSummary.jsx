const React = require('react');
const { dinero, fecha, otrosTexto } = require('../formatters');

function existe(v) {
  return v !== undefined && v !== null && v !== '';
}
function positivo(v) {
  return existe(v) && Number(v) !== 0;
}

function InvoiceSummary({ factura }) {
  const t = factura.totales || {};

  // El PDF prioriza lectura rápida. Los datos técnicos de integración
  // (origen, perfil, formato, proveedor, etc.) permanecen en el JSON,
  // pero no se repiten visualmente en la factura del cliente.
  const rows = [
    existe(t.totalServGravados) ? ['Servicios gravados', t.totalServGravados] : null,
    existe(t.totalServExentos) ? ['Servicios exentos', t.totalServExentos] : null,
    existe(t.totalServExonerados) ? ['Servicios exonerados', t.totalServExonerados] : null,
    existe(t.totalServNoSujetos) ? ['Servicios no sujetos', t.totalServNoSujetos] : null,
    existe(t.totalMercanciasGravadas) ? ['Mercancías gravadas', t.totalMercanciasGravadas] : null,
    existe(t.totalMercanciasExentas) ? ['Mercancías exentas', t.totalMercanciasExentas] : null,
    existe(t.totalMercanciasExoneradas) ? ['Mercancías exoneradas', t.totalMercanciasExoneradas] : null,
    existe(t.totalMercanciasNoSujetas) ? ['Mercancías no sujetas', t.totalMercanciasNoSujetas] : null,
    existe(t.totalGravado) ? ['Total gravado', t.totalGravado] : null,
    existe(t.totalExento) ? ['Total exento', t.totalExento] : null,
    existe(t.totalExonerado) ? ['Total exonerado', t.totalExonerado] : null,
    existe(t.totalNoSujeto) ? ['Total no sujeto', t.totalNoSujeto] : null,
    existe(t.totalVenta) ? ['Total venta', t.totalVenta] : null,
    existe(t.totalDescuentos) ? ['Descuentos', t.totalDescuentos] : null,
    existe(t.totalVentaNeta) ? ['Venta neta', t.totalVentaNeta] : null,
    existe(t.totalImpuesto) ? ['Impuestos', t.totalImpuesto] : null,
    existe(t.totalIVADevuelto) ? ['IVA devuelto', t.totalIVADevuelto] : null,
    existe(t.totalOtrosCargos) ? ['Otros cargos', t.totalOtrosCargos] : null
  ].filter(Boolean);

  const refs = Array.isArray(factura.referencias) ? factura.referencias : [];
  const cargos = Array.isArray(factura.otrosCargos) ? factura.otrosCargos : [];
  const otros = otrosTexto(factura);
  const notas = [
    ...otros,
    ...cargos.map((c) => `Cargo adicional: ${c.detalle || c.tipoDocumento || 'Cargo'} · ${dinero(c.monto, factura.moneda)}`),
    ...refs.map((r) => `Referencia: ${r.tipoDocumento || '—'} · ${r.numero || r.numeroDocumento || '—'} · ${fecha(r.fechaEmision)}${r.razon ? ` · ${r.razon}` : ''}`)
  ];

  return React.createElement('section', { className: 'closing closing-clean' },
    React.createElement('div', { className: 'totals totals-prominent' },
      React.createElement('h3', null, 'Resumen de importes'),
      React.createElement('div', { className: 'totals-grid' },
        ...rows.map(([label, value]) => React.createElement('div', { className: 'total-row', key: label },
          React.createElement('span', null, label),
          React.createElement('strong', null, dinero(value, factura.moneda))
        ))
      ),
      React.createElement('div', { className: 'grand' },
        React.createElement('span', null, 'TOTAL'),
        React.createElement('strong', null, dinero(t.totalComprobante, factura.moneda))
      )
    ),
    notas.length ? React.createElement('div', { className: 'invoice-notes' },
      ...notas.map((nota, i) => React.createElement('p', { key: `n${i}` }, nota))
    ) : null
  );
}

module.exports = InvoiceSummary;
