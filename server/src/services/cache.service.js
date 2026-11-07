const store = new Map();

function read(key) {
  const row = store.get(key);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return row.value;
}

function cacheGet(key) {
  return Promise.resolve(read(key));
}

function cacheSet(key, value, ttlSeconds = 60) {
  store.set(key, { value, expiresAt: Date.now() + Number(ttlSeconds) * 1000 });
  return Promise.resolve();
}

function cacheDel(pattern) {
  const expression = new RegExp(`^${String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  for (const key of store.keys()) {
    if (expression.test(key)) store.delete(key);
  }
  return Promise.resolve();
}

module.exports = { cacheGet, cacheSet, cacheDel };
