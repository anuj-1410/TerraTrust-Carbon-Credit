const React = require('react');
const {Text} = require('react-native');

function MaterialCommunityIcons({name = 'icon', ...props}) {
  return React.createElement(Text, props, name);
}

module.exports = MaterialCommunityIcons;
module.exports.default = MaterialCommunityIcons;