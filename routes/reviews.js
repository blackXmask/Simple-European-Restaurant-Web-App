const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ── List Reviews ─────────────────────────────────────────
router.get('/', (req, res) => {
  const db = req.app.locals.db;

  const reviews = db.prepare(`
    SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC
  `).all();

  const avg = db.prepare(`
    SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE status = 'approved'
  `).get();

  // Rating distribution
  const distribution = db.prepare(`
    SELECT rating, COUNT(*) as count FROM reviews WHERE status = 'approved'
    GROUP BY rating ORDER BY rating DESC
  `).all();

  res.render('pages/reviews', {
    title: 'Guest Reviews',
    reviews,
    avgRating: avg.avg ? parseFloat(avg.avg).toFixed(1) : null,
    reviewCount: avg.count || 0,
    distribution,
  });
});

// ── Create Review ────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { rating, title, comment } = req.body;

  const errors = [];
  const r = parseInt(rating);
  if (!r || r < 1 || r > 5) errors.push('Please select a rating between 1 and 5 stars.');
  if (!comment || comment.trim().length < 10) errors.push('Please write at least 10 characters.');

  if (errors.length > 0) {
    req.session.flash = { type: 'error', message: errors[0] };
    return res.redirect('/reviews#write-review');
  }

  db.prepare(`
    INSERT INTO reviews (user_id, user_name, rating, title, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.user.id, req.session.user.name, r, title || null, comment.trim());

  req.session.flash = { type: 'success', message: 'Thank you! Your review has been submitted and will appear after moderation.' };
  res.redirect('/reviews');
});

module.exports = router;
