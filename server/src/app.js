const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const morgan = require('morgan');
const env = require('./config/env');
const { isRedisReady } = require('./config/redis');
const { createSessionStore } = require('./config/sessionStore');
const { configurePassport } = require('./config/passport');
const { configureCloudinary } = require('./config/cloudinary');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { generalLimiter } = require('./middleware/rateLimit');
const { ApiError } = require('./utils/apiError');
const { randomToken } = require('./utils/crypto');
const mongoose = require('mongoose');

configurePassport();
configureCloudinary();

function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.trustedOrigins.includes(origin)) return cb(null, true);
        if (!env.isProd) {
          try {
            const host = new URL(origin).hostname;
            if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return cb(null, true);
          } catch {
            /* ignore malformed origin */
          }
        }
        return cb(new ApiError(403, 'This browser address is not allowed to call the API.'));
      },
      credentials: true,
    })
  );
  app.use(compression());
  app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  const sessionOptions = {
    name: env.sessionName,
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.sessionCookieSecure,
      maxAge: env.sessionMaxAgeMs,
    },
  };
  sessionOptions.store = createSessionStore();
  app.use(session(sessionOptions));
  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.user = req.user || null;
    next();
  });

  if (env.isProd) app.use('/api', generalLimiter);

  app.get('/api/csrf-token', (req, res) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomToken();
    }
    req.session.save((err) => {
      if (err) return res.status(500).json({ success: false, message: 'Failed to initialize session' });
      res.json({ success: true, csrfToken: req.session.csrfToken });
    });
  });

  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (env.nodeEnv === 'test') return next();
    const token = req.headers['x-csrf-token'];
    if (!token) {
      return next(new ApiError(403, 'Missing CSRF token.'));
    }
    if (!req.session.csrfToken) {
      req.session.csrfToken = token;
      return req.session.save(() => next());
    }
    if (token !== req.session.csrfToken) {
      return next(new ApiError(403, 'Invalid or missing CSRF token.'));
    }
    return next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      status: 'ok',
      mongo: mongoose.connection.readyState === 1 ? 'up' : 'down',
      redis: isRedisReady() ? 'up' : 'down',
      uptime: process.uptime(),
    });
  });

  app.get('/legacy/flash', (req, res) => {
    res.render('flash', { title: 'TNP notices' });
  });

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { buildApp };
