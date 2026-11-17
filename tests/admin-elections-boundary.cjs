const { createHash } = require('node:crypto');
// Strip only the exact reviewed addition; all other Admin source remains protected.
module.exports = function stripElections(source) {
  return source.replace(/      <!-- ELECCIONES ESCOLARES:[\s\S]*?<\/section>\n/, block =>
    createHash('sha256').update(block).digest('hex') ===
      'a157aea317930ed4de9a52cf01e024fccf4ce3916b7d9a66be344140b6d2e0d7' ? '' : block);
};
