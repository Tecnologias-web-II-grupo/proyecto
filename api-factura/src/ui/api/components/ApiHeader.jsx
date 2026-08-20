const React = require('react');
function ApiHeader({ contrato }) {
  return React.createElement('header', { className: 'console-head' },
    React.createElement('div', null,
      React.createElement('div', { className: 'prompt' }, '> API_FACTURA'),
      React.createElement('h1', null, 'API compartida de facturación al cliente'),
      React.createElement('p', null, contrato.descripcion)
    ),
    React.createElement('div', { className: 'status' }, React.createElement('span', { className: 'dot' }), React.createElement('strong', null, 'ACTIVO'), React.createElement('small', null, `v${contrato.version}`))
  );
}
module.exports = ApiHeader;
