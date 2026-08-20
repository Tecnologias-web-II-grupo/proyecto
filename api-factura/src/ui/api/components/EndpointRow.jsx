const React = require('react');
function EndpointRow({ method, path, description }) {
  return React.createElement('div', { className: 'endpoint' },
    React.createElement('span', { className: `method ${method.toLowerCase()}` }, method),
    React.createElement('div', { className: 'endpoint-main' }, React.createElement('code', null, path), React.createElement('span', null, description))
  );
}
module.exports = EndpointRow;
