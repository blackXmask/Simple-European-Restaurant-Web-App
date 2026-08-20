const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ── Menu Listing ─────────────────────────────────────────
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { category } = req.query;

  let items;
  if (category) {
    items = db.prepare(`
      SELECT mi.*, c.name as category_name, c.slug as category_slug
      FROM menu_items mi
      JOIN categories c ON mi.category_id = c.id
      WHERE c.slug = ? AND mi.is_available = 1
      ORDER BY mi.sort_order
    `).all(category);
  } else {
    items = db.prepare(`
      SELECT mi.*, c.name as category_name, c.slug as category_slug
      FROM menu_items mi
      JOIN categories c ON mi.category_id = c.id
      WHERE mi.is_available = 1
      ORDER BY c.sort_order, mi.sort_order
    `).all();
  }

  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();

  // Group items by category
  const grouped = {};
  for (const item of items) {
    const key = item.category_slug;
    if (!grouped[key]) {
      grouped[key] = { name: item.category_name, slug: item.category_slug, items: [] };
    }
    grouped[key].items.push(item);
  }

  res.render('pages/menu', {
    title: 'Our Menu',
    grouped,
    categories,
    activeCategory: category || null,
  });
});

// ── Add to Cart ──────────────────────────────────────────
router.post('/cart/add', (req, res) => {
  const db = req.app.locals.db;
  const { itemId, quantity } = req.body;
  const qty = Math.max(1, parseInt(quantity) || 1);

  const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND is_available = 1').get(itemId);
  if (!item) {
    req.session.flash = { type: 'error', message: 'Item not available.' };
    return res.redirect('back');
  }

  if (!req.session.cart) req.session.cart = [];

  const existing = req.session.cart.find((i) => i.id === item.id);
  if (existing) {
    existing.quantity += qty;
  } else {
    req.session.cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      image_url: item.image_url,
      quantity: qty,
    });
  }

  req.session.flash = { type: 'success', message: `${item.name} added to your order.` };

  if (req.body.redirect === 'cart') {
    return res.redirect('/cart');
  }
  res.redirect('back');
});

// ── Update Cart Quantity ─────────────────────────────────
router.post('/cart/update', (req, res) => {
  const { itemId, quantity } = req.body;
  const qty = parseInt(quantity);

  if (!req.session.cart) return res.redirect('/cart');

  const item = req.session.cart.find((i) => i.id == itemId);
  if (item) {
    if (qty <= 0) {
      req.session.cart = req.session.cart.filter((i) => i.id != itemId);
    } else {
      item.quantity = qty;
    }
  }

  res.redirect('/cart');
});

// ── Remove from Cart ──────────────────────────────────────
router.post('/cart/remove', (req, res) => {
  const { itemId } = req.body;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter((i) => i.id != itemId);
  }
  req.session.flash = { type: 'success', message: 'Item removed from your order.' };
  res.redirect('/cart');
});

module.exports = router;
