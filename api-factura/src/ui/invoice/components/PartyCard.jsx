const React = require('react');
const { codigo, IDENTIFICACIONES } = require('../formatters');

function Field({ label, value, full = false }) {
  if (value === undefined || value === null || value === '') return null;
  return React.createElement('div', { className: `party-field${full ? ' full' : ''}` },
    React.createElement('span', null, label),
    React.createElement('strong', null, value)
  );
}

function PartyCard({ title, party, side }) {
  const p = party || {};
  const u = p.ubicacion || {};
  const t = p.telefono || {};
  const correos = Array.from(new Set([...(Array.isArray(p.correosAdicionales) ? p.correosAdicionales : []), ...(Array.isArray(p.correos) ? p.correos : [])].filter(Boolean))).join(', ');
  const ubicacion = [u.provincia && `Prov. ${u.provincia}`, u.canton && `Cant. ${u.canton}`, u.distrito && `Dist. ${u.distrito}`, u.barrio && `Barrio ${u.barrio}`].filter(Boolean).join(' · ');
  const telefono = t.numero ? `${t.codigoPais ? `+${t.codigoPais} ` : ''}${t.numero}` : null;

  return React.createElement('section', { className: `person-card ${side}` },
    React.createElement('h3', null, title),
    React.createElement('div', { className: 'person-grid' },
      React.createElement(Field, { label: 'Nombre / razón social', value: p.nombre, full: true }),
      React.createElement(Field, { label: 'Identificación', value: p.identificacion?.numero }),
      React.createElement(Field, { label: 'Tipo', value: codigo(IDENTIFICACIONES, p.identificacion?.tipo) }),
      React.createElement(Field, { label: 'Correo', value: p.correo, full: true }),
      React.createElement(Field, { label: 'Nombre comercial', value: p.nombreComercial }),
      React.createElement(Field, { label: 'Actividad económica', value: p.actividadEconomica }),
      React.createElement(Field, { label: 'Teléfono', value: telefono }),
      React.createElement(Field, { label: 'Ubicación', value: ubicacion || null }),
      React.createElement(Field, { label: 'Otras señas', value: u.otrasSenas || u.otrasSenasExtranjero, full: true }),
      React.createElement(Field, { label: 'Correos adicionales', value: correos || null, full: true })
    )
  );
}
module.exports = PartyCard;
