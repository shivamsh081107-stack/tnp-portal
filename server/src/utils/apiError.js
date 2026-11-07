class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = status < 500;
  }
}

function flash(type, text) {
  return { type, text };
}

module.exports = { ApiError, flash };
