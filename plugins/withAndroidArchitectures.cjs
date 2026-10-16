const { withGradleProperties } = require('@expo/config-plugins');
const { phoneGradleProperties } = require('../scripts/lib/android-abis.cjs');

module.exports = config => withGradleProperties(config, next => {
  next.modResults = phoneGradleProperties(next.modResults);
  return next;
});
