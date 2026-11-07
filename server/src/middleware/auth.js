const { ROLES } = require('../utils/constants');
const { ApiError, flash } = require('../utils/apiError');

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    if (req.user.isActive === false) {
      const done = () => next(new ApiError(401, 'This account is suspended.'));
      if (typeof req.logout !== 'function') return done();
      return req.logout(() => {
        if (!req.session) return done();
        return req.session.destroy(() => done());
      });
    }
    return next();
  }
  if (req.flash) req.flash('error', 'Please sign up or log in to continue.');
  return next(new ApiError(401, 'Please sign up or log in to continue.', { flash: flash('warning', 'Please sign up or log in to continue.') }));
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Please sign up or log in to continue.'));
    if (!roles.includes(req.user.role) && !(roles.includes(ROLES.TNP_TEAM) && req.user.tnpTeam)) {
      return next(new ApiError(403, 'You do not have permission to access this page.', { flash: flash('danger', 'You do not have permission to access this page.') }));
    }
    return next();
  };
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

function requirePermission(...perms) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Please sign up or log in to continue.'));
    if (req.user.role === ROLES.ADMIN) return next();
    const ok = perms.some((p) => hasPermission(req.user, p));
    if (!ok) {
      return next(new ApiError(403, 'You do not have permission to access this page.', { flash: flash('danger', 'You do not have permission to access this page.') }));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, requirePermission, hasPermission };
