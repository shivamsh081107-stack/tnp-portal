const twilio = require('twilio');
const env = require('../config/env');
const { ApiError } = require('../utils/apiError');

function isTwilioConfigured() {
  return Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioFrom);
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return digits.slice(2);
  }
  return '';
}

function toE164(phone) {
  const local = normalizePhone(phone);
  if (!local) throw new ApiError(400, 'Enter a valid 10-digit mobile number.');
  return `+91${local}`;
}

function maskPhone(phone) {
  const local = normalizePhone(phone);
  if (!local) return 'your mobile number';
  return `******${local.slice(-4)}`;
}

const TRIAL_TEMPLATES = {
  otp: 'sms_2fa',
  appointment: 'sms_appointment_reminders',
  selection: 'sms_event_notifications',
  alert: 'sms_account_alerts',
};

function explainTwilioError(err) {
  const code = err?.code;
  if (code === 21211 || code === 21614) return new ApiError(400, 'Twilio could not send to this mobile number.');
  if (code === 21608 || code === 21610) {
    return new ApiError(403, 'Verify this mobile number in the Twilio console. A trial account only texts verified numbers.');
  }
  if (code === 21408) return new ApiError(403, 'Twilio is not allowed to text this country yet. Enable it in Geo permissions.');
  return new ApiError(502, 'Twilio could not send the SMS. Try again in a moment.');
}

async function sendSms(phone, body, kind = 'alert') {
  if (!isTwilioConfigured()) {
    throw new ApiError(503, 'SMS is not configured. Add the Twilio account SID, auth token, and sender number.');
  }
  const client = twilio(String(env.twilioAccountSid).trim(), String(env.twilioAuthToken).trim());
  const message = { to: toE164(phone) };
  const from = String(env.twilioFrom).trim();
  if (from.startsWith('MG')) message.messagingServiceSid = from;
  else message.from = from;
  try {
    await client.messages.create({ ...message, body });
    return { sent: true, trial: false };
  } catch (err) {
    if (err?.code !== 572006) throw explainTwilioError(err);
  }
  try {
    await client.messages.create({ ...message, body: TRIAL_TEMPLATES[kind] || TRIAL_TEMPLATES.alert });
    return { sent: true, trial: true };
  } catch (err) {
    throw explainTwilioError(err);
  }
}

async function trySendSms(phone, body, kind) {
  try {
    return await sendSms(phone, body, kind);
  } catch (err) {
    return { sent: false, trial: false, reason: err.message || 'SMS could not be sent.' };
  }
}

module.exports = { isTwilioConfigured, normalizePhone, toE164, maskPhone, sendSms, trySendSms };
