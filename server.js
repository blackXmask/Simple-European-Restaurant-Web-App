const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const methodOverride = require('method-override');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database (async init) ─────────────────────────────────
let dbReady = false;
initDatabase().then(() => { dbReady = true; }).catch(err => {
  console.error('[DB] Init failed:', err.message);
});

// ── View Engine ────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ─────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session (memory store — works on Vercel serverless)
app.use(session({
  store: new MemoryStore({ checkPeriod: 86400000 }),
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// ── Global Locals ──────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cart = req.session.cart || [];
  res.locals.cartCount = (req.session.cart || []).reduce((s, i) => s + i.quantity, 0);
  res.locals.cartTotal = (req.session.cart || []).reduce((s, i) => s + i.price * i.quantity, 0);
  res.locals.restaurant = {
    name: process.env.RESTAURANT_NAME || 'La Maison Dorée',
    phone: process.env.RESTAURANT_PHONE || '+33 1 42 36 87 09',
    email: process.env.RESTAURANT_EMAIL || 'contact@lamaisondoree.com',
    address: process.env.RESTAURANT_ADDRESS || '24 Rue du Faubourg Saint-Honoré, 75008 Paris, France',
  };
  res.locals.flash = req.session.flash || null;
  req.session.flash = null;
  next();
});

// ── DB readiness guard ────────────────────────────────────
app.use((req, res, next) => {
  if (!dbReady) {
    return res.status(503).send('Database is initializing, please try again in a moment.');
  }
  next();
});

// ── Routes ────────────────────────────────────────────────
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/menu', menuRoutes);
app.use('/reviews', reviewRoutes);
app.use('/admin', adminRoutes);

// ── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    statusCode: 404,
    message: 'The page you are looking for does not exist or has been moved.',
  });
});

// ── Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).render('error', {
    title: 'Something Went Wrong',
    statusCode: err.status || 500,
    message: process.env.NODE_ENV === 'production' ? 'An internal server error occurred.' : err.message,
  });
});

// ── Export for Vercel ─────────────────────────────────────
module.exports = app;

// ── Start server (local only) ────────────────────────────
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  La Maison Dorée — running on http://localhost:${PORT}`);
    console.log(`  Admin login: ${process.env.ADMIN_EMAIL || 'admin@lamaisondoree.com'} / ${process.env.ADMIN_PASSWORD || 'admin123'}\n`);
  });
}
