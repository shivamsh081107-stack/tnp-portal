const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

function randomDigits(length) {
  const n = crypto.randomInt(0, 10 ** length);
  return String(n).padStart(length, '0');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { hashPassword, comparePassword, randomDigits, sha256, randomToken };
