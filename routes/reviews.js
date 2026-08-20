const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// ── List Reviews ─────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const reviews = await query(`SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC`);
    const avg = await queryOne(`SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE status = 'approved'`);
    const distribution = await query(`SELECT rating, COUNT(*) as count FROM reviews WHERE status = 'approved' GROUP BY rating ORDER BY rating DESC`);

    res.render('pages/reviews', {
      title: 'Guest Reviews', reviews,
      avgRating: avg && avg.avg ? Number(avg.avg).toFixed(1) : null,
      reviewCount: avg ? Number(avg.count) : 0,
      distribution,
    });
  } catch (err) { next(err); }
});

// ── Create Review ────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { rating, title, comment } = req.body;
    const r = parseInt(rating);

    if (!r || r < 1 || r > 5) {
      req.session.flash = { type: 'error', message: 'Please select a rating between 1 and 5 stars.' };
      return res.redirect('/reviews#write-review');
    }
    if (!comment || comment.trim().length < 10) {
      req.session.flash = { type: 'error', message: 'Please write at least 10 characters.' };
      return res.redirect('/reviews#write-review');
    }

    await execute(
      'INSERT INTO reviews (user_id, user_name, rating, title, comment) VALUES (?, ?, ?, ?, ?)',
      [req.session.user.id, req.session.user.name, r, title || null, comment.trim()]
    );

    req.session.flash = { type: 'success', message: 'Thank you! Your review has been submitted and will appear after moderation.' };
    res.redirect('/reviews');
  } catch (err) { next(err); }
});

module.exports = router;
