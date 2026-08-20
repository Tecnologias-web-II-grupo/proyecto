const React = require('react');
const { texto } = require('../formatters');

function Datum({ label, value, mono = false, full = false }) {
  if (value === undefined || value === null || value === '') return null;
  return React.createElement('div', { className: `datum${full ? ' full' : ''}` },
    React.createElement('span', { className: 'label' }, label),
    React.createElement('strong', { className: mono ? 'mono' : '' }, texto(value))
  );
}
module.exports = Datum;
