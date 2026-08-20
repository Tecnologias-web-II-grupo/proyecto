const React = require('react');
const EndpointRow = require('./EndpointRow.jsx');
function EndpointList({ endpoints }) {
  return React.createElement('section', { className: 'panel' }, React.createElement('div', { className: 'panel-title' }, 'ENDPOINTS'), ...endpoints.map(([method, path, description]) => React.createElement(EndpointRow, { key: method + path, method, path, description })));
}
module.exports = EndpointList;
