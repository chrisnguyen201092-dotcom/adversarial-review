const crypto = require('crypto');

function generateResetToken() {
  return crypto.randomBytes(20).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('md5').update(token).digest('hex');
}

module.exports = { generateResetToken, hashToken };
