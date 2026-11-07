const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const schemas = require('../src/validators');

describe('Joi schemas', () => {
  it('rejects weak passwords and mismatched confirmation', () => {
    const { error } = schemas.signup.validate({
      name: 'A Student',
      email: 'a.student@iiitbhopal.ac.in',
      phone: '9876543210',
      password: 'weak',
      confirmPassword: 'other',
      branch: 'CSE',
      batch: 2027,
      enrollmentNumber: 'ENR1',
      termsAccepted: true,
      otpChallengeId: 'abc',
    });
    assert.ok(error);
  });

  it('accepts a complete signup payload shape', () => {
    const { error } = schemas.signup.validate({
      name: 'A Student',
      email: 'a.student@iiitbhopal.ac.in',
      phone: '9876543210',
      password: 'StrongPass#1',
      confirmPassword: 'StrongPass#1',
      branch: 'CSE',
      batch: 2027,
      enrollmentNumber: 'ENR1',
      termsAccepted: true,
      otpChallengeId: 'ticket',
    });
    assert.equal(error, undefined);
  });

  it('limits pagination', () => {
    const { value } = schemas.pagination.validate({ page: 2, limit: 999, q: 'tcs' });
    assert.equal(value.limit, 50);
  });
});
