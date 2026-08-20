const React = require('react');
function SectionTitle({ kicker, title }) {
  return React.createElement('div', { className: 'section-title' },
    React.createElement('span', null, kicker),
    React.createElement('h2', null, title)
  );
}
module.exports = SectionTitle;
