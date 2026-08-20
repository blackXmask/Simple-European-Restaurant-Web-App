const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');

// ── Admin Dashboard ──────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const db = req.app.locals.db;

  const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c;
  const totalRevenue = db.prepare("SELECT SUM(total) as s FROM orders WHERE status != 'cancelled'").get().s || 0;
  const totalMenuItems = db.prepare('SELECT COUNT(*) as c FROM menu_items').get().c;
  const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get().c;
  const pendingReviews = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE status = 'pending'").get().c;
  const unreadMessages = db.prepare('SELECT COUNT(*) as c FROM contact_messages').get().c;

  const recentOrders = db.prepare(`
    SELECT * FROM orders ORDER BY created_at DESC LIMIT 5
  `).all();

  // Revenue last 7 days (simple chart data)
  const revenueData = db.prepare(`
    SELECT DATE(created_at) as date, SUM(total) as revenue
    FROM orders WHERE status != 'cancelled' AND created_at >= date('now', '-7 days')
    GROUP BY DATE(created_at) ORDER BY date
  `).all();

  res.render('pages/admin/dashboard', {
    title: 'Admin Dashboard',
    totalOrders,
    pendingOrders,
    totalRevenue: totalRevenue.toFixed(2),
    totalMenuItems,
    totalUsers,
    pendingReviews,
    unreadMessages,
    recentOrders,
    revenueData,
  });
});

// ── Menu Management ──────────────────────────────────────
router.get('/menu', requireAdmin, (req, res) => {
  const db = req.app.locals.db;

  const items = db.prepare(`
    SELECT mi.*, c.name as category_name
    FROM menu_items mi
    JOIN categories c ON mi.category_id = c.id
    ORDER BY c.sort_order, mi.sort_order
  `).all();

  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();

  res.render('pages/admin/menu', { title: 'Menu Management', items, categories });
});

// ── New Menu Item ───────────────────────────────────────
router.get('/menu/new', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();

  res.render('pages/admin/menu-form', { title: 'Add Menu Item', item: null, categories });
});

router.post('/menu', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { name, description, price, categoryId, imageUrl, isAvailable, isFeatured, sortOrder } = req.body;

  if (!name || !price || !categoryId) {
    req.session.flash = { type: 'error', message: 'Name, price and category are required.' };
    return res.redirect('/admin/menu/new');
  }

  db.prepare(`
    INSERT INTO menu_items (category_id, name, description, price, image_url, is_available, is_featured, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    categoryId, name.trim(), description || null, parseFloat(price),
    imageUrl || null, isAvailable ? 1 : 0, isFeatured ? 1 : 0, parseInt(sortOrder) || 0
  );

  req.session.flash = { type: 'success', message: `"${name}" added to the menu.` };
  res.redirect('/admin/menu');
});

// ── Edit Menu Item ──────────────────────────────────────
router.get('/menu/:id/edit', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);

  if (!item) {
    req.session.flash = { type: 'error', message: 'Item not found.' };
    return res.redirect('/admin/menu');
  }

  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('pages/admin/menu-form', { title: 'Edit Menu Item', item, categories });
});

router.put('/menu/:id', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { name, description, price, categoryId, imageUrl, isAvailable, isFeatured, sortOrder } = req.body;

  if (!name || !price || !categoryId) {
    req.session.flash = { type: 'error', message: 'Name, price and category are required.' };
    return res.redirect(`/admin/menu/${req.params.id}/edit`);
  }

  db.prepare(`
    UPDATE menu_items SET
      category_id = ?, name = ?, description = ?, price = ?,
      image_url = ?, is_available = ?, is_featured = ?, sort_order = ?
    WHERE id = ?
  `).run(
    categoryId, name.trim(), description || null, parseFloat(price),
    imageUrl || null, isAvailable ? 1 : 0, isFeatured ? 1 : 0,
    parseInt(sortOrder) || 0, req.params.id
  );

  req.session.flash = { type: 'success', message: `"${name}" updated successfully.` };
  res.redirect('/admin/menu');
});

// ── Delete Menu Item ─────────────────────────────────────
router.delete('/menu/:id', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const item = db.prepare('SELECT name FROM menu_items WHERE id = ?').get(req.params.id);

  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);

  req.session.flash = { type: 'success', message: `"${item ? item.name : 'Item'}" removed from menu.` };
  res.redirect('/admin/menu');
});

// ── Order Management ────────────────────────────────────
router.get('/orders', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { status } = req.query;

  let orders;
  if (status && status !== 'all') {
    orders = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  }

  const statusCounts = {
    pending: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c,
    preparing: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'preparing'").get().c,
    ready: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'ready'").get().c,
    delivered: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'").get().c,
    cancelled: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'").get().c,
  };

  res.render('pages/admin/orders', { title: 'Order Management', orders, statusCounts, activeStatus: status || 'all' });
});

// ── Order Detail (Admin) ─────────────────────────────────
router.get('/orders/:id', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

  if (!order) {
    req.session.flash = { type: 'error', message: 'Order not found.' };
    return res.redirect('/admin/orders');
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  res.render('pages/admin/order-detail', { title: `Order ${order.order_number}`, order, items });
});

// ── Update Order Status ─────────────────────────────────
router.put('/orders/:id/status', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { status } = req.body;

  const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    req.session.flash = { type: 'error', message: 'Invalid status.' };
    return res.redirect('back');
  }

  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);

  req.session.flash = { type: 'success', message: `Order status updated to "${status}".` };
  res.redirect('back');
});

// ── Review Moderation ────────────────────────────────────
router.get('/reviews', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { status } = req.query;

  let reviews;
  if (status && status !== 'all') {
    reviews = db.prepare('SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    reviews = db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all();
  }

  const statusCounts = {
    pending: db.prepare("SELECT COUNT(*) as c FROM reviews WHERE status = 'pending'").get().c,
    approved: db.prepare("SELECT COUNT(*) as c FROM reviews WHERE status = 'approved'").get().c,
    rejected: db.prepare("SELECT COUNT(*) as c FROM reviews WHERE status = 'rejected'").get().c,
  };

  res.render('pages/admin/reviews', { title: 'Review Moderation', reviews, statusCounts, activeStatus: status || 'all' });
});

router.put('/reviews/:id/status', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const { status } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    req.session.flash = { type: 'error', message: 'Invalid status.' };
    return res.redirect('back');
  }

  db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, req.params.id);

  req.session.flash = { type: 'success', message: `Review ${status}.` };
  res.redirect('back');
});

// ── Contact Messages ────────────────────────────────────
router.get('/messages', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const messages = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();

  res.render('pages/admin/messages', { title: 'Messages', messages });
});

// ── User Management ──────────────────────────────────────
router.get('/users', requireAdmin, (req, res) => {
  const db = req.app.locals.db;
  const users = db.prepare("SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC").all();

  res.render('pages/admin/users', { title: 'User Management', users });
});

module.exports = router;
