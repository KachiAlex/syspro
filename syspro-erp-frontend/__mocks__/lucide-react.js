const React = require('react');

function Icon(props) {
  return React.createElement('svg', Object.assign({ 'data-testid': 'icon' }, props));
}

module.exports = new Proxy(Icon, {
  get(target, prop) {
    if (prop === 'default') return Icon;
    return Icon;
  },
});