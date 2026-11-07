const passport = require('passport');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const { randomToken, sha256 } = require('../utils/crypto');
const { sendOtp, verifyOtp, consumeTicket } = require('../services/otp.service');
const { sendMail, isMailConfigured } = require('../services/mail.service');
const { ApiError, flash } = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { ROLES } = require('../utils/constants');
const { set, isRedisReady } = require('../config/redis');

const sendOtpHandler = asyncHandler(async (req, res) => {
  const { email, purpose } = req.body;
  const result = await sendOtp(email, purpose, req.ip);
  const message = result.devOtp
    ? `OTP generated! For demo/testing, code is: ${result.devOtp}`
    : 'OTP sent to the provided email address.';
  res.json({
    success: true,
    message,
    challengeId: result.challengeId,
    expiresIn: result.expiresIn,
    ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    flash: flash('info', message),
  });
});

const verifyOtpHandler = asyncHandler(async (req, res) => {
  const { email, purpose, otp } = req.body;
  const result = await verifyOtp(email, purpose, otp);
  res.json({
    success: true,
    otpChallengeId: result.ticket,
    message: 'Email address verified.',
    flash: flash('success', 'Email address verified.'),
  });
});

const signup = asyncHandler(async (req, res) => {
  const body = req.body;
  const used = await consumeTicket(body.otpChallengeId, body.email, 'signup');
  if (!used) throw new ApiError(400, 'Complete email OTP verification before signing up.');

  const existing = await User.findOne({ $or: [{ email: body.email }, { phone: body.phone }] });
  if (existing) throw new ApiError(409, 'An account with this email or phone already exists.');
  const enrollment = await StudentProfile.findOne({ enrollmentNumber: body.enrollmentNumber.toUpperCase() });
  if (enrollment) throw new ApiError(409, 'This enrollment number is already registered.');

  const user = await User.register(
    {
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: ROLES.STUDENT,
      phoneVerified: true,
    },
    body.password
  );
  await StudentProfile.create({
    user: user._id,
    enrollmentNumber: body.enrollmentNumber.toUpperCase(),
    branch: body.branch,
    batch: body.batch,
  });

  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.login(user, (loginErr) => {
        if (loginErr) return reject(loginErr);
        req.session.csrfToken = randomToken();
        req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
      });
    });
  });
  if (req.flash) req.flash('success', 'Account created successfully!');
  res.status(201).json({
    success: true,
    user: user.safeJSON(),
    csrfToken: req.session.csrfToken,
    flash: flash('success', 'Account created successfully!'),
  });
});

function portalLabel(portal) {
  if (portal === ROLES.ADMIN) return 'admin';
  if (portal === ROLES.TNP_TEAM) return 'TNP member';
  return 'student';
}

function assertPortal(user, portal) {
  const ok =
    (portal === ROLES.ADMIN && user.role === ROLES.ADMIN) ||
    (portal === ROLES.TNP_TEAM && (user.role === ROLES.TNP_TEAM || user.tnpTeam)) ||
    (portal === ROLES.STUDENT && user.role === ROLES.STUDENT);
  if (!ok) {
    throw new ApiError(403, `This account cannot sign in as ${portalLabel(portal)}. Choose the portal that matches this account.`);
  }
}

const login = asyncHandler(async (req, res, next) => {
  passport.authenticate('local', (err, user) => {
    if (err) return next(err);
    if (!user || user.isActive === false) {
      return next(new ApiError(401, 'Invalid email or password.', { flash: flash('danger', 'Invalid email or password.') }));
    }
    try {
      assertPortal(user, req.body.portal);
    } catch (portalErr) {
      return next(portalErr);
    }
    req.session.regenerate((regenErr) => {
      if (regenErr) return next(regenErr);
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        user.lastLoginAt = new Date();
        await user.save();
        req.session.csrfToken = randomToken();
        await new Promise((resolve) => req.session.save(resolve));
        if (req.flash) req.flash('success', 'Logged in successfully!');
        return res.json({
          success: true,
          user: user.safeJSON(),
          csrfToken: req.session.csrfToken,
          flash: flash('success', 'Logged in successfully!'),
        });
      });
    });
  })(req, res, next);
});

const loginOtp = asyncHandler(async (req, res) => {
  const { email, otpChallengeId } = req.body;
  if (!email || !otpChallengeId) throw new ApiError(400, 'Email and OTP verification are required.');
  const used = await consumeTicket(otpChallengeId, email, 'login');
  if (!used) throw new ApiError(400, 'Complete email OTP verification before logging in.');
  const user = await User.findOne({ email: String(email).toLowerCase(), isActive: true });
  if (!user) throw new ApiError(401, 'Invalid email or OTP.');
  assertPortal(user, req.body.portal);
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.login(user, (loginErr) => {
        if (loginErr) return reject(loginErr);
        req.session.csrfToken = randomToken();
        req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
      });
    });
  });
  res.json({
    success: true,
    user: user.safeJSON(),
    csrfToken: req.session.csrfToken,
    flash: flash('success', 'Logged in successfully!'),
  });
});

const logout = asyncHandler(async (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie(env.sessionName);
      res.json({ success: true, flash: flash('success', 'Logged out successfully!') });
    });
  });
});

const me = asyncHandler(async (req, res) => {
  if (!req.user) return res.json({ success: true, user: null });
  const profile = req.user.role === ROLES.STUDENT ? await StudentProfile.findOne({ user: req.user._id }) : null;
  res.json({ success: true, user: req.user.safeJSON(), profile });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const generic = {
    success: true,
    message: 'If an account exists for that email, password reset instructions will be sent when email is configured.',
    flash: flash('info', 'If an account exists for that email, password reset instructions will be sent when email is configured.'),
  };
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  if (!user) return res.json(generic);
  const token = randomToken();
  user.passwordReset = { tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000), usedAt: undefined };
  await user.save();
  if (isMailConfigured()) {
    const link = `${env.clientOrigin}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'IIIT Bhopal TNP password reset',
      text: `Reset your password using this single-use link (30 minutes): ${link}`,
    });
  }
  if (isRedisReady()) {
    await set(`reset:${sha256(token)}`, String(user._id), 1800);
  }
  return res.json({
    ...generic,
    emailConfigured: isMailConfigured(),
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const tokenHash = sha256(req.body.token);
  const user = await User.findOne({ 'passwordReset.tokenHash': tokenHash }).select('+hash +salt');
  if (!user || !user.passwordReset?.expiresAt || user.passwordReset.usedAt || user.passwordReset.expiresAt < new Date()) {
    throw new ApiError(400, 'This reset link is invalid or has expired.');
  }
  await user.setPassword(req.body.password);
  user.passwordReset.usedAt = new Date();
  user.passwordReset.tokenHash = undefined;
  await user.save();
  res.json({ success: true, flash: flash('success', 'Password updated. You can log in with your new password.') });
});

const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+hash +salt');
  try {
    await user.changePassword(req.body.currentPassword || '', req.body.password);
  } catch {
    throw new ApiError(400, 'Current password is incorrect.');
  }
  res.json({ success: true, flash: flash('success', 'Password changed.') });
});

module.exports = {
  sendOtpHandler,
  verifyOtpHandler,
  signup,
  login,
  loginOtp,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
};
