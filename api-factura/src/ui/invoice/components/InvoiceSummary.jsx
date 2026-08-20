const React = require('react');
const { dinero, codigo, PAGOS, otrosTexto, fecha, texto, proveedorTexto } = require('../formatters');

function existe(v) {
  return v !== undefined && v !== null && v !== '';
}
function positivo(v) {
  return existe(v) && Number(v) !== 0;
}

function InvoiceSummary({ factura }) {
  const t = factura.totales || {};

  // Para lectura rápida: los subtotales por categoría solo se muestran si tienen valor.
  // Los totales principales se mantienen visibles aun cuando sean cero para no perder
  // información relevante del comprobante.
  const rows = [
    positivo(t.totalServGravados) ? ['Servicios gravados', t.totalServGravados] : null,
    positivo(t.totalServExentos) ? ['Servicios exentos', t.totalServExentos] : null,
    positivo(t.totalServExonerados) ? ['Servicios exonerados', t.totalServExonerados] : null,
    positivo(t.totalServNoSujetos) ? ['Servicios no sujetos', t.totalServNoSujetos] : null,
    positivo(t.totalMercanciasGravadas) ? ['Mercancías gravadas', t.totalMercanciasGravadas] : null,
    positivo(t.totalMercanciasExentas) ? ['Mercancías exentas', t.totalMercanciasExentas] : null,
    positivo(t.totalMercanciasExoneradas) ? ['Mercancías exoneradas', t.totalMercanciasExoneradas] : null,
    positivo(t.totalMercanciasNoSujetas) ? ['Mercancías no sujetas', t.totalMercanciasNoSujetas] : null,
    ['Total gravado', t.totalGravado],
    ['Total exento', t.totalExento],
    ['Total exonerado', t.totalExonerado],
    ['Total no sujeto', t.totalNoSujeto],
    ['Total venta', t.totalVenta],
    ['Descuentos', t.totalDescuentos],
    ['Venta neta', t.totalVentaNeta],
    ['Impuestos', t.totalImpuesto],
    positivo(t.totalIVADevuelto) ? ['IVA devuelto', t.totalIVADevuelto] : null,
    positivo(t.totalOtrosCargos) ? ['Otros cargos', t.totalOtrosCargos] : null
  ].filter((row) => row && existe(row[1]));

  const medios = Array.isArray(t.mediosPago) ? t.mediosPago : [];
  const refs = Array.isArray(factura.referencias) ? factura.referencias : [];
  const cargos = Array.isArray(factura.otrosCargos) ? factura.otrosCargos : [];
  const otros = otrosTexto(factura);
  const condicion = factura.detalleCondicionVenta || factura.detalleCondicionVentaOtro;

  const meta = [
    medios.length ? ['Pago', medios.map((m) => `${codigo(PAGOS, m.tipo)} · ${dinero(m.total ?? m.monto, factura.moneda)}`).join(' | ')] : null,
    condicion ? ['Condición', condicion] : null,
    factura.proveedorSistemas ? ['Proveedor del sistema', proveedorTexto(factura.proveedorSistemas)] : null,
    factura.referenciaExterna ? ['Referencia', factura.referenciaExterna] : null
  ].filter(Boolean);

  const control = factura.origen ? `Origen: ${factura.origen}` : null;

  return React.createElement('section', { className: 'closing' },
    React.createElement('div', { className: 'closing-notes' },
      React.createElement('h3', null, 'Información del comprobante'),
      React.createElement('dl', { className: 'closing-meta' },
        ...meta.flatMap(([label, value]) => [
          React.createElement('dt', { key: `${label}-dt` }, label),
          React.createElement('dd', { key: `${label}-dd` }, texto(value))
        ])
      ),
      control ? React.createElement('p', { className: 'internal-reference' }, control) : null,
      (otros.length || cargos.length || refs.length) ? React.createElement('div', { className: 'closing-extra' },
        ...otros.map((o, i) => React.createElement('p', { key: `o${i}` }, o)),
        ...cargos.map((c, i) => React.createElement('p', { key: `c${i}` }, `Cargo adicional: ${c.detalle || c.tipoDocumento || 'Cargo'} · ${dinero(c.monto, factura.moneda)}`)),
        ...refs.map((r, i) => React.createElement('p', { key: `r${i}` }, `Referencia documental: ${r.tipoDocumento || '—'} · ${r.numero || r.numeroDocumento || '—'} · ${fecha(r.fechaEmision)}${r.razon ? ` · ${r.razon}` : ''}`))
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
        React.createElement('span', null, 'TOTAL'),
        React.createElement('strong', null, dinero(t.totalComprobante, factura.moneda))
      )
    )
  );
}

module.exports = InvoiceSummary;
