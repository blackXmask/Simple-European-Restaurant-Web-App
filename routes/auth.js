const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ── Signup ────────────────────────────────────────────────
router.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('pages/signup', { title: 'Sign Up', errors: [], old: {} });
});

router.post('/signup', (req, res) => {
  const db = req.app.locals.db;
  const { name, email, password, confirmPassword, phone } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('A valid email address is required.');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
  if (password !== confirmPassword) errors.push('Passwords do not match.');

  if (errors.length > 0) {
    return res.render('pages/signup', { title: 'Sign Up', errors, old: req.body });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.render('pages/signup', { title: 'Sign Up', errors: ['An account with this email already exists.'], old: req.body });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)').run(
    name.trim(), email.toLowerCase(), hash, phone || null
  );

  req.session.user = {
    id: result.lastInsertRowid,
    name: name.trim(),
    email: email.toLowerCase(),
    role: 'customer',
    phone: phone || null,
  };

  req.session.flash = { type: 'success', message: `Welcome to La Maison Dorée, ${name.trim()}!` };
  res.redirect('/');
});

// ── Login ─────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('pages/login', { title: 'Sign In', errors: [], old: {} });
});

router.post('/login', (req, res) => {
  const db = req.app.locals.db;
  const { email, password } = req.body;
  const errors = [];

  if (!email || !password) errors.push('Email and password are required.');

  if (errors.length > 0) {
    return res.render('pages/login', { title: 'Sign In', errors, old: req.body });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('pages/login', { title: 'Sign In', errors: ['Invalid email or password.'], old: req.body });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
  };

  req.session.flash = { type: 'success', message: `Welcome back, ${user.name}!` };
  res.redirect(user.role === 'admin' ? '/admin' : '/');
});

// ── Logout ────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ── User Dashboard ────────────────────────────────────────
router.get('/dashboard', requireAuth, (req, res) => {
  const db = req.app.locals.db;

  const orders = db.prepare(`
    SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.session.user.id);

  const reviews = db.prepare(`
    SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.session.user.id);

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

  res.render('pages/dashboard', {
    title: 'My Account',
    orders,
    reviews,
    totalOrders,
    totalSpent: totalSpent.toFixed(2),
  });
});

module.exports = router;
