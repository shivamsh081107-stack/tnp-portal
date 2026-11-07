const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { localResumeMatch } = require('../src/utils/resumeMatch');

describe('resume match', () => {
  it('scores overlap against required skills and lists gaps', () => {
    const result = localResumeMatch({
      resumeText: 'CSE student. Built a library system with Java and SQL. Coursework in data structures. Uses Git.',
      jobDescription: 'SDE intern. Java, SQL, REST APIs, and React.',
      requiredSkills: ['Java', 'SQL', 'REST APIs', 'React'],
    });
    assert.equal(result.matchScore, 50);
    assert.deepEqual(result.matched.map((item) => item.toLowerCase()).sort(), ['java', 'sql']);
    assert.ok(result.missing.some((item) => item.toLowerCase() === 'react'));
    assert.ok(result.suggestions.length >= 1);
  });

  it('returns zero when the description has no comparable terms', () => {
    const result = localResumeMatch({ resumeText: 'Java', jobDescription: 'and the of', requiredSkills: [] });
    assert.equal(result.matchScore, 0);
  });
});
