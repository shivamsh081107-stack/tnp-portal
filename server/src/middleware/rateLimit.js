const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis, isRedisReady } = require('../config/redis');

const instances = new Map();

function redisDown(res) {
  return res.status(503).json({
    success: false,
    message: 'Rate limiting is unavailable because Redis is down.',
  });
}

const specs = [];

function buildLimiter({ windowMs, max, prefix }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { creationStack: false },
    store: new RedisStore({
      sendCommand: (...args) => getRedis().call(...args),
      prefix,
    }),
    handler: (_req, response) => {
      response.status(429).json({
        success: false,
        message: 'Too many requests. Please wait and try again.',
        flash: { type: 'warning', text: 'Too many requests. Please wait and try again.' },
      });
    },
  });
}

function limiter({ windowMs, max, prefix, allowRead }) {
  specs.push({ windowMs, max, prefix });
  return (req, res, next) => {
    if (!isRedisReady()) {
      if (allowRead && ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
      return redisDown(res);
    }
    if (!instances.has(prefix)) instances.set(prefix, buildLimiter({ windowMs, max, prefix }));
    return instances.get(prefix)(req, res, next);
  };
}

function initLimiters() {
  if (!isRedisReady()) return;
  for (const spec of specs) {
    if (!instances.has(spec.prefix)) instances.set(spec.prefix, buildLimiter(spec));
  }
}

module.exports = {
  initLimiters,
  generalLimiter: limiter({ windowMs: 15 * 60 * 1000, max: 500, prefix: 'rl:gen:', allowRead: true }),
  authLimiter: limiter({ windowMs: 15 * 60 * 1000, max: 30, prefix: 'rl:auth:' }),
  otpLimiter: limiter({ windowMs: 15 * 60 * 1000, max: 20, prefix: 'rl:otp:' }),
  uploadLimiter: limiter({ windowMs: 15 * 60 * 1000, max: 20, prefix: 'rl:up:' }),
  aiLimiter: limiter({ windowMs: 15 * 60 * 1000, max: 30, prefix: 'rl:ai:' }),
  resetLimiter: limiter({ windowMs: 15 * 60 * 1000, max: 15, prefix: 'rl:rst:' }),
};
