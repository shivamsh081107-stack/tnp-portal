const env = require('../config/env');
const { isRedisReady, get, set, expire, ttl, del, incr, decr } = require('../config/redis');
const { randomDigits, sha256, randomToken } = require('../utils/crypto');
const { ApiError } = require('../utils/apiError');
const { sendMail } = require('./mail.service');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function keyFor(email, purpose) {
  return `otp:${purpose}:${normalizeEmail(email)}`;
}

async function sendOtp(email, purpose, ip) {
  if (!isRedisReady()) throw new ApiError(503, 'OTP service is unavailable because Redis is down.');
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) throw new ApiError(400, 'A valid email is required.');
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
  if (purpose === 'signup' && domain !== 'gmail.com' && domain !== env.collegeEmailDomain) {
    throw new ApiError(400, `Signup OTP is sent only to @gmail.com or @${env.collegeEmailDomain}.`);
  }

  const sendCountKey = `otp:send:${normalized}:${purpose}`;
  const sends = Number((await incr(sendCountKey)) || 0);
  if (sends === 1) await expire(sendCountKey, 3600);
  if (sends > 10) throw new ApiError(429, 'OTP resend limit reached. Try again later.');

  const ipKey = `otp:ip:${ip}`;
  const ipCount = Number((await incr(ipKey)) || 0);
  if (ipCount === 1) await expire(ipKey, 3600);
  if (ipCount > 20) throw new ApiError(429, 'OTP request limit reached for this network.');

  const otp = randomDigits(env.otpLength);
  const challengeId = randomToken();
  const payload = JSON.stringify({
    hash: sha256(`${normalized}:${purpose}:${otp}`),
    purpose,
    email: normalized,
    challengeId,
    attempts: 0,
  });
  await set(keyFor(normalized, purpose), payload, env.otpTtlSeconds);

  console.log(`\n======================================================`);
  console.log(`[IIIT Bhopal TNP] Verification OTP for ${normalized}: >>> ${otp} <<<`);
  console.log(`Purpose: ${purpose} | Valid for: ${env.otpTtlSeconds} seconds`);
  console.log(`======================================================\n`);

  const minutes = Math.max(1, Math.round(env.otpTtlSeconds / 60));
  let mailSent = false;
  try {
    const mail = await sendMail({
      to: normalized,
      subject: 'IIIT Bhopal TNP verification code',
      text: `Your IIIT Bhopal TNP verification code is ${otp}. It expires in ${minutes} minutes. If you did not request this, ignore this email.`,
    });
    mailSent = mail.sent;
  } catch {
    mailSent = false;
  }

  if (!mailSent) {
    await decr(sendCountKey);
  }

  return {
    challengeId,
    expiresIn: env.otpTtlSeconds,
    devOtp: otp,
    mailSent,
  };
}

async function verifyOtp(email, purpose, otp) {
  if (!isRedisReady()) throw new ApiError(503, 'OTP service is unavailable because Redis is down.');
  const normalized = normalizeEmail(email);
  const raw = await get(keyFor(normalized, purpose));
  if (!raw) throw new ApiError(400, 'OTP expired or was not requested.');
  const data = JSON.parse(raw);
  if (data.attempts >= 5) {
    await del(keyFor(normalized, purpose));
    throw new ApiError(429, 'Too many incorrect OTP attempts. Request a new code.');
  }
  const expected = sha256(`${normalized}:${purpose}:${otp}`);
  if (expected !== data.hash) {
    data.attempts += 1;
    const remaining = await ttl(keyFor(normalized, purpose));
    await set(keyFor(normalized, purpose), JSON.stringify(data), Math.max(remaining, 1));
    throw new ApiError(400, 'Invalid OTP.');
  }
  await del(keyFor(normalized, purpose));
  const ticket = randomToken();
  await set(`otp:ok:${ticket}`, JSON.stringify({ email: normalized, purpose }), 600);
  return { ticket, challengeId: data.challengeId };
}

async function consumeTicket(ticket, email, purpose) {
  if (!isRedisReady()) throw new ApiError(503, 'OTP service is unavailable because Redis is down.');
  const raw = await get(`otp:ok:${ticket}`);
  if (!raw) return false;
  const data = JSON.parse(raw);
  if (data.email !== normalizeEmail(email) || data.purpose !== purpose) return false;
  await del(`otp:ok:${ticket}`);
  return true;
}

module.exports = { sendOtp, verifyOtp, consumeTicket };
