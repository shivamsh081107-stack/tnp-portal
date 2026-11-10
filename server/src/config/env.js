const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRedisUrl(value) {
  const raw = value || 'redis://127.0.0.1:6379';
  try {
    const parsed = new URL(raw);
    const gluedPort = parsed.hostname.match(/^(.*\.redis\.io)\.(\d+)$/);
    if (gluedPort && !parsed.port) {
      parsed.hostname = gluedPort[1];
      parsed.port = gluedPort[2];
      return parsed.toString();
    }
  } catch {
    return raw;
  }
  return raw;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  trustedOrigins: csv(process.env.TRUSTED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/iiitbhopal_tnp',
  redisUrl: normalizeRedisUrl(process.env.REDIS_URL),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-me',
  sessionName: process.env.SESSION_NAME || 'tnp.sid',
  sessionCookieSecure: String(process.env.SESSION_COOKIE_SECURE) === 'true',
  sessionMaxAgeMs: Number(process.env.SESSION_MAX_AGE_MS) || 86400000,
  csrfSecret: process.env.CSRF_SECRET || 'dev-csrf-change-me',
  collegeEmailDomain: process.env.COLLEGE_EMAIL_DOMAIN || 'iiitbhopal.ac.in',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@iiitbhopal.ac.in',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'AdminPass#123',
  seedAdminPhone: process.env.SEED_ADMIN_PHONE || '9999999999',
  otpLength: Number(process.env.OTP_LENGTH) || 6,
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS) || 300,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFrom: process.env.TWILIO_FROM || '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  resumeAccessMode: process.env.CLOUDINARY_RESUME_ACCESS_MODE || 'authenticated',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 25000,
  flashAutoDismissMs: Number(process.env.FLASH_AUTO_DISMISS_MS) || 6000,
  logLevel: process.env.LOG_LEVEL || 'info',
};

env.isProd = env.nodeEnv === 'production';
module.exports = env;
