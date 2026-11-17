const { createHash } = require('node:crypto');
// Strip only the exact reviewed addition; all other Admin source remains protected.
module.exports = function stripElections(source) {
  return source.replace(/      <!-- ELECCIONES ESCOLARES:[\s\S]*?<\/section>\n/, block =>
    createHash('sha256').update(block).digest('hex') ===
      'e932bc300619523de2cb50780942412c159d2515cdc4757e57c17897e1f63e68' ? '' : block);
};
