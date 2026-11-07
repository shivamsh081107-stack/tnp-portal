const session = require('express-session');
const redis = require('./redis');
const logger = require('../utils/logger');

const hot = new Map();
const HOT_MS = 20000;

class RedisSessionStore extends session.Store {
  constructor() {
    super();
    this.prefix = 'sess:';
  }

  ttlSeconds(sess) {
    const maxAge = sess && sess.cookie && sess.cookie.maxAge;
    return Math.max(1, Math.ceil((Number(maxAge) || 86400000) / 1000));
  }

  remember(sid, raw) {
    if (!raw) {
      hot.delete(sid);
      return;
    }
    hot.set(sid, { raw, at: Date.now() });
  }

  get(sid, callback) {
    const hit = hot.get(sid);
    if (hit && Date.now() - hit.at < HOT_MS) {
      try {
        return callback(null, JSON.parse(hit.raw));
      } catch {
        hot.delete(sid);
      }
    }
    redis
      .get(this.prefix + sid)
      .then((raw) => {
        if (!raw) {
          this.remember(sid, null);
          return callback(null, null);
        }
        try {
          this.remember(sid, raw);
          return callback(null, JSON.parse(raw));
        } catch (err) {
          logger.error('Session payload was unreadable', { message: err.message });
          return callback(null, null);
        }
      })
      .catch((err) => {
        logger.error('Session read failed', { message: err.message });
        callback(err);
      });
  }

  set(sid, sess, callback) {
    const raw = JSON.stringify(sess);
    this.remember(sid, raw);
    redis
      .set(this.prefix + sid, raw, this.ttlSeconds(sess))
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  destroy(sid, callback) {
    this.remember(sid, null);
    redis
      .del(this.prefix + sid)
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  touch(sid, sess, callback) {
    const hit = hot.get(sid);
    if (hit) hit.at = Date.now();
    redis
      .expire(this.prefix + sid, this.ttlSeconds(sess))
      .then(() => callback(null))
      .catch((err) => callback(err));
  }
}

function createSessionStore() {
  return new RedisSessionStore();
}

module.exports = { createSessionStore };
