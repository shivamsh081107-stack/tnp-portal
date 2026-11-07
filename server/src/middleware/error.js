const logger = require('../utils/logger');
const { ApiError } = require('../utils/apiError');

function notFound(req, res, next) {
  next(new ApiError(404, 'Resource not found'));
}

function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  if (status >= 500) logger.error('Unhandled error', { message: err.message, path: req.path });
  const known = err instanceof ApiError || Boolean(err.status || err.statusCode);
  const payload = {
    success: false,
    message: known ? err.message : 'Something went wrong. Please try again later.',
  };
  if (err.details) payload.details = err.details;
  if (err.flash) payload.flash = err.flash;
  if (req.flash && status === 401) {
    /* connect-flash already populated for EJS views */
  }
  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
