const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sha256, randomDigits, hashPassword, comparePassword } = require('../src/utils/crypto');

describe('crypto helpers', () => {
  it('hashes consistently and never returns plaintext OTP helpers of wrong length', () => {
    assert.equal(sha256('a'), sha256('a'));
    assert.notEqual(sha256('a'), sha256('b'));
    assert.equal(randomDigits(6).length, 6);
  });

  it('bcrypt roundtrip', async () => {
    const hash = await hashPassword('StrongPass#1');
    assert.equal(await comparePassword('StrongPass#1', hash), true);
    assert.equal(await comparePassword('nope', hash), false);
  });
});
