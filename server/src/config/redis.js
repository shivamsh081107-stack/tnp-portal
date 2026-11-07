const dns = require('dns').promises;
const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let client = null;
let ready = false;

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function createClient(url) {
  const redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    enableAutoPipelining: true,
    lazyConnect: true,
    connectTimeout: 2500,
    keepAlive: 10000,
    retryStrategy(times) {
      if (times > 2) return null;
      return 300;
    },
  });
  redis.on('error', (err) => logger.error('Redis error', { message: err.message }));
  redis.on('end', () => {
    if (client === redis) ready = false;
  });
  redis.on('ready', () => {
    if (client === redis) ready = true;
  });
  return redis;
}

async function tryUrl(url) {
  const host = hostnameOf(url);
  if (!host) return null;
  try {
    await dns.lookup(host);
  } catch (err) {
    logger.error('Redis host does not resolve', { host, message: err.message });
    return null;
  }
  const redis = createClient(url);
  try {
    await Promise.race([
      redis.connect().then(() => redis.ping()),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis ping timed out')), 3000);
      }),
    ]);
    logger.info('Redis ready', { host });
    return redis;
  } catch (err) {
    logger.error('Redis connection failed', { host, message: err.message });
    redis.disconnect();
    return null;
  }
}

async function connectRedis() {
  const configured = env.redisUrl;
  const local = 'redis://127.0.0.1:6379';
  const urls = [configured];
  if (hostnameOf(configured) !== '127.0.0.1' && hostnameOf(configured) !== 'localhost') urls.push(local);

  for (const url of urls) {
    const redis = await tryUrl(url);
    if (redis) {
      client = redis;
      ready = true;
      return client;
    }
  }

  throw new Error('Redis is required. Start Redis and check REDIS_URL.');
}

function getRedis() {
  if (!client) throw new Error('Redis is not connected.');
  return client;
}

function isRedisReady() {
  return ready && client && client.status === 'ready';
}

async function get(key) {
  return getRedis().get(key);
}

async function set(key, value, ttlSeconds) {
  const redis = getRedis();
  if (ttlSeconds) return redis.set(key, String(value), 'EX', Number(ttlSeconds));
  return redis.set(key, String(value));
}

async function expire(key, seconds) {
  return getRedis().expire(key, Number(seconds));
}

async function ttl(key) {
  return getRedis().ttl(key);
}

async function del(...keys) {
  return getRedis().del(...keys);
}

async function incr(key) {
  return getRedis().incr(key);
}

async function decr(key) {
  return getRedis().decr(key);
}

module.exports = { connectRedis, getRedis, isRedisReady, get, set, expire, ttl, del, incr, decr };
