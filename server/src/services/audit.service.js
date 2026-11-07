const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

async function audit(req, action, resource, resourceId, metadata) {
  try {
    await AuditLog.create({
      actor: req.user?._id,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : undefined,
      metadata: logger.redact(metadata || {}),
      ip: req.ip,
    });
  } catch (err) {
    logger.error('Audit write failed', { message: err.message });
  }
}

module.exports = { audit };
