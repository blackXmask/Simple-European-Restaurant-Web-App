const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// ── Home ──────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const featured = await query(`
      SELECT mi.*, c.name as category_name, c.slug as category_slug
      FROM menu_items mi
      JOIN categories c ON mi.category_id = c.id
      WHERE mi.is_featured = 1 AND mi.is_available = 1
      ORDER BY mi.sort_order
    `);

    const categories = await query('SELECT * FROM categories ORDER BY sort_order');

    const reviews = await query(`SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 3`);

    const avgRating = await queryOne(`SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE status = 'approved'`);

    res.render('pages/home', {
      title: 'Home',
      featured,
      categories,
      reviews,
      avgRating: avgRating && avgRating.avg ? Number(avgRating.avg).toFixed(1) : null,
      reviewCount: avgRating ? Number(avgRating.count) : 0,
    });
  } catch (err) { next(err); }
});

// ── About ─────────────────────────────────────────────────
router.get('/about', (req, res) => {
  res.render('pages/about', { title: 'About Us' });
});

// ── Contact ───────────────────────────────────────────────
router.get('/contact', (req, res) => {
  res.render('pages/contact', { title: 'Contact' });
});

router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      req.session.flash = { type: 'error', message: 'Name, email and message are required.' };
      return res.redirect('/contact');
    }
    await execute('INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject || 'General Inquiry', message]);
    req.session.flash = { type: 'success', message: 'Thank you for reaching out! We will respond within 24 hours.' };
    res.redirect('/contact');
  } catch (err) { next(err); }
});

// ── Cart ──────────────────────────────────────────────────
router.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = subtotal > 0 ? 3.50 : 0;
  const total = subtotal + deliveryFee;
  res.render('pages/cart', {
    title: 'Your Order', cart,
    subtotal: subtotal.toFixed(2), deliveryFee: deliveryFee.toFixed(2), total: total.toFixed(2),
  });
});

// ── Checkout ──────────────────────────────────────────────
router.get('/checkout', requireAuth, (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) {
    req.session.flash = { type: 'error', message: 'Your order is empty.' };
    return res.redirect('/menu');
  }
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = 3.50;
  res.render('pages/checkout', {
    title: 'Checkout', cart,
    subtotal: subtotal.toFixed(2), deliveryFee: deliveryFee.toFixed(2), total: (subtotal + deliveryFee).toFixed(2),
  });
});

router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) {
      req.session.flash = { type: 'error', message: 'Your order is empty.' };
      return res.redirect('/menu');
    }
    const { name, phone, email, address, deliveryType, notes } = req.body;
    if (!name || !phone || !email) {
      req.session.flash = { type: 'error', message: 'Name, phone and email are required.' };
      return res.redirect('/checkout');
    }
    if (deliveryType === 'delivery' && !address) {
      req.session.flash = { type: 'error', message: 'Delivery address is required for delivery orders.' };
      return res.redirect('/checkout');
    }

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const deliveryFee = deliveryType === 'delivery' ? 3.50 : 0;
    const total = (subtotal + deliveryFee).toFixed(2);
    const orderNumber = 'LD-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    const orderResult = await execute(
      `INSERT INTO orders (user_id, order_number, status, total, customer_name, customer_phone, customer_email, delivery_address, delivery_type, notes) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
      [req.session.user.id, orderNumber, total, name, phone, email, address || null, deliveryType || 'delivery', notes || null]
    );
    const orderId = orderResult.lastInsertRowid;

    for (const item of cart) {
      await execute(
        `INSERT INTO order_items (order_id, menu_item_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    }

    req.session.cart = [];
    req.session.flash = { type: 'success', message: `Order ${orderNumber} placed successfully!` };
    res.redirect(`/orders/${orderId}`);
  } catch (err) { next(err); }
});

// ── Order History ────────────────────────────────────────
router.get('/orders', requireAuth, async (req, res, next) => {
  try {
    const orders = await query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
    res.render('pages/orders', { title: 'Order History', orders });
  } catch (err) { next(err); }
});

// ── Order Detail ─────────────────────────────────────────
router.get('/orders/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await queryOne('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
    if (!order) {
      req.session.flash = { type: 'error', message: 'Order not found.' };
      return res.redirect('/orders');
    }
    const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.render('pages/order-detail', { title: `Order ${order.order_number}`, order, items });
  } catch (err) { next(err); }
});

module.exports = router;
