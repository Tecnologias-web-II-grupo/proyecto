const React = require('react');
const { dinero } = require('../formatters');

function FiscalDetails({ factura }) {
  const items = Array.isArray(factura.items) ? factura.items : [];

  const bloques = items.map((it, i) => {
    const comerciales = Array.isArray(it.codigosComerciales) ? it.codigosComerciales : [];
    const descuentos = Array.isArray(it.descuentos) ? it.descuentos : [];
    const impuestos = Array.isArray(it.impuestos) && it.impuestos.length
      ? it.impuestos
      : (it.impuesto ? [it.impuesto] : []);

    const datos = [];
    if (it.unidadMedidaComercial) datos.push(['Unidad comercial', it.unidadMedidaComercial]);
    if (it.tipoTransaccion) datos.push(['Tipo de transacción', it.tipoTransaccion]);
    if (it.baseImponible !== undefined && it.baseImponible !== null) datos.push(['Base imponible', dinero(it.baseImponible, factura.moneda)]);
    if (it.partidaArancelaria) datos.push(['Partida arancelaria', it.partidaArancelaria]);
    if (it.numeroVinSerie) datos.push(['VIN / Serie', it.numeroVinSerie]);
    if (it.registroMedicamento) datos.push(['Registro medicamento', it.registroMedicamento]);
    if (it.formaFarmaceutica) datos.push(['Forma farmacéutica', it.formaFarmaceutica]);

    const extras = [];
    if (comerciales.length) {
      extras.push(`Códigos comerciales: ${comerciales.map((c) => `${c.tipo || '—'}:${c.codigo || '—'}`).join(' · ')}`);
    }
    if (descuentos.length) {
      extras.push(`Descuentos: ${descuentos.map((d) => `${d.codigo || '—'} ${d.naturaleza || ''} ${dinero(d.monto, factura.moneda)}`).join(' · ')}`);
    }
    if (impuestos.length) {
      extras.push(`Impuestos: ${impuestos.map((x) => `${x.codigo || '—'} · ${x.tarifa ?? it.impuestoTarifa ?? 0}% · tarifa ${x.codigoTarifaIVA || '—'} · ${dinero(x.monto ?? it.impuestoNeto ?? 0, factura.moneda)}`).join(' | ')}`);
    }

    if (!datos.length && !extras.length) return null;

    return React.createElement('article', { className: 'line-extra', key: `fiscal-${i}` },
      React.createElement('h3', null, `Información complementaria · línea ${it.numeroLinea ?? i + 1}`),
      datos.length ? React.createElement('div', { className: 'grid four' },
        ...datos.map(([label, value]) => React.createElement('div', { className: 'datum', key: label },
          React.createElement('span', { className: 'label' }, label),
          React.createElement('strong', null, value)
        ))
      ) : null,
      ...extras.map((text, j) => React.createElement('p', { className: 'small', key: `extra-${j}` }, text))
    );
  }).filter(Boolean);

  if (!bloques.length) return null;
  return React.createElement('section', { className: 'fiscal-details' }, ...bloques);
}

module.exports = FiscalDetails;
