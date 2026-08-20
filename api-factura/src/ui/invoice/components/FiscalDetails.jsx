const React = require('react');
const { dinero } = require('../formatters');

function FiscalDetails({ factura }) {
  const items = Array.isArray(factura.items) ? factura.items : [];
  const rows = items.map((it, i) => {
    const comerciales = Array.isArray(it.codigosComerciales) ? it.codigosComerciales : [];
    const impuestos = Array.isArray(it.impuestos) && it.impuestos.length ? it.impuestos : (it.impuesto ? [it.impuesto] : []);
    const codigoComercial = comerciales.map((c) => `${c.tipo || '—'}:${c.codigo || '—'}`).join(' · ') || '—';
    const impuesto = impuestos.map((x) => `${x.codigo || '—'} · ${x.tarifa ?? it.impuestoTarifa ?? 0}% · ${dinero(x.monto ?? it.impuestoNeto ?? 0, factura.moneda)}`).join(' | ') || '—';
    const tiene = it.unidadMedidaComercial || it.tipoTransaccion || it.baseImponible !== undefined || comerciales.length || impuestos.length;
    if (!tiene) return null;
    return {
      linea: it.numeroLinea ?? i + 1,
      base: dinero(it.baseImponible ?? it.subtotal ?? 0, factura.moneda),
      codigo: codigoComercial,
      impuesto,
    };
  }).filter(Boolean);

  if (!rows.length) return null;
  return React.createElement('section', { className: 'fiscal-details' },
    React.createElement('h3', null, 'Información fiscal por línea'),
    React.createElement('table', { className: 'fiscal-table' },
      React.createElement('thead', null, React.createElement('tr', null,
        ['Línea', 'Base imponible', 'Código comercial', 'Impuesto'].map((x) => React.createElement('th', { key: x }, x))
      )),
      React.createElement('tbody', null, ...rows.map((r) => React.createElement('tr', { key: r.linea },
        React.createElement('td', null, r.linea),
        React.createElement('td', { className: 'money' }, r.base),
        React.createElement('td', null, r.codigo),
        React.createElement('td', null, r.impuesto)
      )))
    )
  );
}
module.exports = FiscalDetails;
