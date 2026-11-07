const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDb, disconnectDb } = require('./config/db');
const { connectRedis, getRedis } = require('./config/redis');
const { buildApp } = require('./app');
const { initLimiters } = require('./middleware/rateLimit');

let httpServer;

async function shutdown(signal, exitCode = 0) {
  logger.info('Graceful shutdown', { signal });
  const close = () =>
    new Promise((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });
  await close();
  await disconnectDb();
  try {
    getRedis().disconnect();
  } catch {
    /* ignore */
  }
  process.exit(exitCode);
}

function listen(app, port, attemptsLeft = 12) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info(`TNP API listening on ${port}`);
      resolve(server);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        logger.error('Port busy, retrying', { port, attemptsLeft });
        setTimeout(() => {
          listen(app, port, attemptsLeft - 1).then(resolve, reject);
        }, 700);
        return;
      }
      reject(err);
    });
  });
}

async function start() {
  if (env.isProd && env.sessionSecret === 'dev-only-change-me') {
    throw new Error('SESSION_SECRET must be set in production');
  }
  await connectDb();
  await connectRedis();
  initLimiters();
  const app = buildApp();
  httpServer = await listen(app, env.port);

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection', { message: err && err.message });
    shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { message: err && err.message });
    shutdown('uncaughtException', 1);
  });
}

start().catch((err) => {
  logger.error('Startup failed', { message: err.message });
  process.exit(1);
});
