const React = require('react');
const Datum = require('./Datum.jsx');
const SectionTitle = require('./SectionTitle.jsx');
const { codigo, IDENTIFICACIONES } = require('../formatters');

function PartyCard({ title, party, side }) {
  const p = party || {};
  const u = p.ubicacion || {};
  const t = p.telefono || {};
  const correos = Array.from(new Set([...(Array.isArray(p.correosAdicionales) ? p.correosAdicionales : []), ...(Array.isArray(p.correos) ? p.correos : [])].filter(Boolean))).join(', ');
  const ubicacion = [u.provincia && `Prov. ${u.provincia}`, u.canton && `Cant. ${u.canton}`, u.distrito && `Dist. ${u.distrito}`, u.barrio && `Barrio ${u.barrio}`].filter(Boolean).join(' · ');
  return React.createElement('section', { className: `person-card ${side}` },
    React.createElement(SectionTitle, { kicker: side === 'issuer' ? 'QUIEN EMITE' : 'QUIEN RECIBE', title }),
    React.createElement('div', { className: 'person-grid' },
      React.createElement(Datum, { label: 'Nombre o razón social', value: p.nombre }),
      React.createElement(Datum, { label: 'Identificación', value: p.identificacion?.numero, mono: true }),
      React.createElement(Datum, { label: 'Tipo de identificación', value: codigo(IDENTIFICACIONES, p.identificacion?.tipo) }),
      React.createElement(Datum, { label: 'Correo electrónico', value: p.correo }),
      React.createElement(Datum, { label: 'Nombre comercial', value: p.nombreComercial }),
      React.createElement(Datum, { label: 'Actividad económica', value: p.actividadEconomica }),
      React.createElement(Datum, { label: 'Registro fiscal bebidas', value: p.registroBebidasAlcoholicas }),
      React.createElement(Datum, { label: 'Teléfono', value: t.numero ? `${t.codigoPais ? `+${t.codigoPais} ` : ''}${t.numero}` : null }),
      React.createElement(Datum, { label: 'Ubicación', value: ubicacion || null }),
      React.createElement(Datum, { label: 'Otras señas', value: u.otrasSenas || u.otrasSenasExtranjero }),
      React.createElement(Datum, { label: 'Correos adicionales', value: correos || null, full: true })
    )
  );
}
module.exports = PartyCard;
