const React = require('react');
const { dinero, codigo, PAGOS, otrosTexto, fecha, texto } = require('../formatters');

function InvoiceSummary({ factura }) {
  const t = factura.totales || {};
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
  ].filter(([, value]) => value !== undefined && value !== null);

  const medios = Array.isArray(t.mediosPago) ? t.mediosPago : [];
  const refs = Array.isArray(factura.referencias) ? factura.referencias : [];
  const cargos = Array.isArray(factura.otrosCargos) ? factura.otrosCargos : [];
  const otros = otrosTexto(factura);
  const condicion = factura.detalleCondicionVenta || factura.detalleCondicionVentaOtro;

  const meta = [
    factura.perfilValidacion ? ['Perfil', factura.perfilValidacion] : null,
    ['Factura', factura.id || '—'],
    condicion ? ['Detalle condición', condicion] : null,
    medios.length ? ['Pago', medios.map((m) => `${codigo(PAGOS, m.tipo)} · ${dinero(m.total ?? m.monto, factura.moneda)}`).join(' | ')] : null,
    factura.origen ? ['Sistema de origen', factura.origen] : null,
    factura.referenciaExterna ? ['Referencia', factura.referenciaExterna] : null,
    ['Formato', 'PDF de solo lectura']
  ].filter(Boolean);

  return React.createElement('section', { className: 'closing' },
    React.createElement('div', { className: 'closing-notes' },
      React.createElement('div', { className: 'closing-kicker' }, 'DATOS DEL COMPROBANTE'),
      React.createElement('div', { className: 'closing-meta' },
        ...meta.map(([label, value]) => React.createElement('span', { key: label },
          React.createElement('b', null, label),
          texto(value)
        ))
      ),
      (otros.length || cargos.length || refs.length) ? React.createElement('div', { className: 'closing-extra' },
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
