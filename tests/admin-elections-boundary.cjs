const { createHash } = require('node:crypto');
// Strip only the exact reviewed addition; all other Admin source remains protected.
module.exports = function stripElections(source) {
  return source.replace(/      <!-- ELECCIONES ESCOLARES:[\s\S]*?<\/section>\n/, block =>
    createHash('sha256').update(block).digest('hex') ===
      '7daaf4662b2ba7c9e72550c20693b858b64c6942b0e5f7649d42ae74fe046b0d' ? '' : block);
};
