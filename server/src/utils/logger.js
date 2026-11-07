const SENSITIVE = /password|secret|token|authorization|cookie|otp|authkey|api[_-]?key|resume/i;

function redact(value) {
  if (value == null) return value;
  if (typeof value === 'string') return SENSITIVE.test(value) ? '[redacted]' : value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE.test(key) ? '[redacted]' : redact(val);
    }
    return out;
  }
  return value;
}

function log(level, message, meta) {
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const method = level === 'error' ? 'error' : 'log';
  console[method](JSON.stringify(line));
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  redact,
};
