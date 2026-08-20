// ── Authentication Middleware ─────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'error', message: 'Please sign in to continue.' };
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.flash = { type: 'error', message: 'Admin access required.' };
    return res.redirect('/');
  }
  next();
}

function optionalAuth(req, res, next) {
  // Sets req.user but does not block
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
