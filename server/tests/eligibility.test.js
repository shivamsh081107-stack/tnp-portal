const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isEligibleForDrive, cardReason } = require('../src/utils/eligibility');

describe('eligibility', () => {
  const profile = { branch: 'CSE', batch: 2027, cgpa: 8.2, backlogs: 0 };
  const now = new Date('2026-10-23T00:00:00Z');

  it('accepts an open matching drive', () => {
    const result = isEligibleForDrive(
      profile,
      {
        status: 'open',
        eligibleBranches: ['CSE', 'IT'],
        eligibleBatches: [2027],
        minCgpa: 7,
        maxBacklogs: 0,
        applicationOpenAt: new Date('2026-10-01'),
        applicationDeadline: new Date('2026-11-01'),
      },
      now
    );
    assert.equal(result.eligible, true);
  });

  it('labels the drive card before apply', () => {
    const drive = {
      status: 'open',
      eligibleBranches: ['CSE'],
      eligibleBatches: [2027],
      minCgpa: 7,
      applicationDeadline: new Date('2026-11-01'),
    };
    assert.equal(cardReason({ ...profile, resume: {} }, drive, now).code, 'resume missing');
    assert.equal(cardReason({ ...profile, resume: { publicId: 'resume' }, cgpa: 6 }, drive, now).code, 'CGPA short');
    assert.equal(cardReason({ ...profile, branch: 'ECE', resume: { publicId: 'resume' } }, drive, now).code, 'branch not allowed');
    assert.equal(
      cardReason({ ...profile, resume: { publicId: 'resume' } }, { ...drive, applicationDeadline: new Date('2026-10-01') }, now).code,
      'deadline passed'
    );
    const ready = cardReason({ ...profile, resume: { publicId: 'resume' } }, drive, now);
    assert.equal(ready.code, 'eligible');
    assert.equal(ready.canApply, true);
  });

  it('rejects a CGPA above the drive maximum', () => {
    const high = isEligibleForDrive(profile, { status: 'open', minCgpa: 7, maxCgpa: 8 }, now);
    assert.equal(high.eligible, false);
    const inside = isEligibleForDrive(profile, { status: 'open', minCgpa: 7, maxCgpa: 9 }, now);
    assert.equal(inside.eligible, true);
    const lowBacklog = isEligibleForDrive(
      { ...profile, backlogs: 0 },
      { status: 'open', minBacklogs: 1, maxBacklogs: 2 },
      now
    );
    assert.equal(lowBacklog.eligible, false);
    const closed = isEligibleForDrive(profile, { status: 'closed' }, now);
    assert.equal(closed.eligible, false);
    const cgpa = isEligibleForDrive(profile, { status: 'open', minCgpa: 9 }, now);
    assert.equal(cgpa.eligible, false);
    assert.equal(cardReason({ ...profile, resume: { publicId: 'resume' }, cgpa: 9.4 }, { status: 'open', minCgpa: 7, maxCgpa: 9 }, now).canApply, false);
  });
});
