const env = require('../config/env');
const logger = require('../utils/logger');

function isMailConfigured() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.mailFrom);
}

async function sendMail({ to, subject, text }) {
  if (!isMailConfigured()) {
    logger.warn('Email provider is not configured; message was not sent', { subject });
    return { sent: false, reason: 'Email provider is not configured.' };
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: { user: env.smtpUser, pass: env.smtpPass },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
    });
    await transporter.sendMail({ from: env.mailFrom, to, subject, text });
    return { sent: true };
  } catch (err) {
    logger.error('Email send failed', { message: err.message });
    const rejected = /invalid sender|sender address|not verified/i.test(err.message || '');
    return {
      sent: false,
      reason: rejected
        ? 'Mailercloud rejected the sender address. Verify a sending domain in the Mailercloud transactional account, then use an address on that domain as the From address.'
        : 'Email provider timed out or connection failed.',
    };
  }
}

module.exports = { isMailConfigured, sendMail };
