const React = require('react');
function ContractPanel({ contrato }) {
  return React.createElement('aside', { className: 'panel' },
    React.createElement('div', { className: 'panel-title' }, 'CONTRATO'),
    React.createElement('dl', { className: 'kv' },
      React.createElement('dt', null, 'servicio'), React.createElement('dd', null, contrato.servicio),
      React.createElement('dt', null, 'version'), React.createElement('dd', null, contrato.version),
      React.createElement('dt', null, 'templateVersion'), React.createElement('dd', null, contrato.templateVersion),
      React.createElement('dt', null, 'formato'), React.createElement('dd', null, 'JSON + PDF'),
      React.createElement('dt', null, 'transporte'), React.createElement('dd', null, 'HTTPS / REST')
    ),
    React.createElement('div', { className: 'panel-title second' }, 'INTEROPERABILIDAD'),
    React.createElement('p', { className: 'help' }, 'Otro backend consume GET /api/facturas/:id y recibe la misma estructura JSON almacenada por esta API.'),
    React.createElement('div', { className: 'actions' },
      React.createElement('a', { href: '/api/contrato' }, 'Ver contrato JSON'), React.createElement('a', { href: '/health' }, 'Health'), React.createElement('a', { href: '/health/documentos' }, 'Health PDF')
    )
  );
}
module.exports = ContractPanel;
