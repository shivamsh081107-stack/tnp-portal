const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parsePagination, paginated } = require('../src/utils/pagination');

describe('pagination', () => {
  it('clamps page size', () => {
    const result = parsePagination({ page: 0, limit: 500 });
    assert.equal(result.page, 1);
    assert.equal(result.limit, 50);
    assert.equal(result.skip, 0);
  });

  it('builds metadata', () => {
    const result = paginated([1], 21, 3, 10);
    assert.equal(result.pagination.pages, 3);
    assert.equal(result.pagination.total, 21);
  });

  it('defaults a 3000-row collection to one page of 20', () => {
    const paging = parsePagination({});
    assert.equal(paging.limit, 20);
    const page = paginated(Array.from({ length: paging.limit }, (_, index) => index), 3000, 1, paging.limit);
    assert.equal(page.items.length, 20);
    assert.equal(page.pagination.total, 3000);
    assert.equal(page.pagination.pages, 150);
  });
});
