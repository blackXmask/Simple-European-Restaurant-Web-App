const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

// ── Admin Dashboard ──────────────────────────────────────
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const totalOrdersRow = await queryOne('SELECT COUNT(*) as c FROM orders');
    const pendingOrdersRow = await queryOne("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'");
    const totalRevenueRow = await queryOne("SELECT SUM(total) as s FROM orders WHERE status != 'cancelled'");
    const totalMenuItemsRow = await queryOne('SELECT COUNT(*) as c FROM menu_items');
    const totalUsersRow = await queryOne("SELECT COUNT(*) as c FROM users WHERE role = 'customer'");
    const pendingReviewsRow = await queryOne("SELECT COUNT(*) as c FROM reviews WHERE status = 'pending'");
    const unreadMessagesRow = await queryOne('SELECT COUNT(*) as c FROM contact_messages');

    const recentOrders = await query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
    const revenueData = await query(`SELECT DATE(created_at) as date, SUM(total) as revenue FROM orders WHERE status != 'cancelled' AND created_at >= date('now', '-7 days') GROUP BY DATE(created_at) ORDER BY date`);

    res.render('pages/admin/dashboard', {
      title: 'Admin Dashboard',
      totalOrders: Number(totalOrdersRow.c),
      pendingOrders: Number(pendingOrdersRow.c),
      totalRevenue: (Number(totalRevenueRow.s) || 0).toFixed(2),
      totalMenuItems: Number(totalMenuItemsRow.c),
      totalUsers: Number(totalUsersRow.c),
      pendingReviews: Number(pendingReviewsRow.c),
      unreadMessages: Number(unreadMessagesRow.c),
      recentOrders,
      revenueData,
    });
  } catch (err) { next(err); }
});

// ── Menu Management ──────────────────────────────────────
router.get('/menu', requireAdmin, async (req, res, next) => {
  try {
    const items = await query(`
      SELECT mi.*, c.name as category_name FROM menu_items mi
      JOIN categories c ON mi.category_id = c.id
      ORDER BY c.sort_order, mi.sort_order
    `);
    const categories = await query('SELECT * FROM categories ORDER BY sort_order');
    res.render('pages/admin/menu', { title: 'Menu Management', items, categories });
  } catch (err) { next(err); }
});

// ── New Menu Item ───────────────────────────────────────
router.get('/menu/new', requireAdmin, async (req, res, next) => {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY sort_order');
    res.render('pages/admin/menu-form', { title: 'Add Menu Item', item: null, categories });
  } catch (err) { next(err); }
});

router.post('/menu', requireAdmin, async (req, res, next) => {
  try {
    const { name, description, price, categoryId, imageUrl, isAvailable, isFeatured, sortOrder } = req.body;
    if (!name || !price || !categoryId) {
      req.session.flash = { type: 'error', message: 'Name, price and category are required.' };
      return res.redirect('/admin/menu/new');
    }
    await execute(
      `INSERT INTO menu_items (category_id, name, description, price, image_url, is_available, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [categoryId, name.trim(), description || null, parseFloat(price), imageUrl || null, isAvailable ? 1 : 0, isFeatured ? 1 : 0, parseInt(sortOrder) || 0]
    );
    req.session.flash = { type: 'success', message: `"${name}" added to the menu.` };
    res.redirect('/admin/menu');
  } catch (err) { next(err); }
});

// ── Edit Menu Item ──────────────────────────────────────
router.get('/menu/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const item = await queryOne('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (!item) {
      req.session.flash = { type: 'error', message: 'Item not found.' };
      return res.redirect('/admin/menu');
    }
    const categories = await query('SELECT * FROM categories ORDER BY sort_order');
    res.render('pages/admin/menu-form', { title: 'Edit Menu Item', item, categories });
  } catch (err) { next(err); }
});

router.put('/menu/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, description, price, categoryId, imageUrl, isAvailable, isFeatured, sortOrder } = req.body;
    if (!name || !price || !categoryId) {
      req.session.flash = { type: 'error', message: 'Name, price and category are required.' };
      return res.redirect(`/admin/menu/${req.params.id}/edit`);
    }
    await execute(
      `UPDATE menu_items SET category_id = ?, name = ?, description = ?, price = ?, image_url = ?, is_available = ?, is_featured = ?, sort_order = ? WHERE id = ?`,
      [categoryId, name.trim(), description || null, parseFloat(price), imageUrl || null, isAvailable ? 1 : 0, isFeatured ? 1 : 0, parseInt(sortOrder) || 0, req.params.id]
    );
    req.session.flash = { type: 'success', message: `"${name}" updated successfully.` };
    res.redirect('/admin/menu');
  } catch (err) { next(err); }
});

// ── Delete Menu Item ─────────────────────────────────────
router.delete('/menu/:id', requireAdmin, async (req, res, next) => {
  try {
    const item = await queryOne('SELECT name FROM menu_items WHERE id = ?', [req.params.id]);
    await execute('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', message: `"${item ? item.name : 'Item'}" removed from menu.` };
    res.redirect('/admin/menu');
  } catch (err) { next(err); }
});

// ── Order Management ────────────────────────────────────
router.get('/orders', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    let orders;
    if (status && status !== 'all') {
      orders = await query('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC', [status]);
    } else {
      orders = await query('SELECT * FROM orders ORDER BY created_at DESC');
    }

    const counts = {};
    for (const s of ['pending', 'preparing', 'ready', 'delivered', 'cancelled']) {
      const row = await queryOne(`SELECT COUNT(*) as c FROM orders WHERE status = ?`, [s]);
      counts[s] = Number(row.c);
    }

    res.render('pages/admin/orders', { title: 'Order Management', orders, statusCounts: counts, activeStatus: status || 'all' });
  } catch (err) { next(err); }
});

// ── Order Detail (Admin) ─────────────────────────────────
router.get('/orders/:id', requireAdmin, async (req, res, next) => {
  try {
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      req.session.flash = { type: 'error', message: 'Order not found.' };
      return res.redirect('/admin/orders');
    }
    const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.render('pages/admin/order-detail', { title: `Order ${order.order_number}`, order, items });
  } catch (err) { next(err); }
});

// ── Update Order Status ─────────────────────────────────
router.put('/orders/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      req.session.flash = { type: 'error', message: 'Invalid status.' };
      return res.redirect('back');
    }
    await execute("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, req.params.id]);
    req.session.flash = { type: 'success', message: `Order status updated to "${status}".` };
    res.redirect('back');
  } catch (err) { next(err); }
});

// ── Review Moderation ────────────────────────────────────
router.get('/reviews', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    let reviews;
    if (status && status !== 'all') {
      reviews = await query('SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC', [status]);
    } else {
      reviews = await query('SELECT * FROM reviews ORDER BY created_at DESC');
    }

    const counts = {};
    for (const s of ['pending', 'approved', 'rejected']) {
      const row = await queryOne(`SELECT COUNT(*) as c FROM reviews WHERE status = ?`, [s]);
      counts[s] = Number(row.c);
    }

    res.render('pages/admin/reviews', { title: 'Review Moderation', reviews, statusCounts: counts, activeStatus: status || 'all' });
  } catch (err) { next(err); }
});

router.put('/reviews/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      req.session.flash = { type: 'error', message: 'Invalid status.' };
      return res.redirect('back');
    }
    await execute('UPDATE reviews SET status = ? WHERE id = ?', [status, req.params.id]);
    req.session.flash = { type: 'success', message: `Review ${status}.` };
    res.redirect('back');
  } catch (err) { next(err); }
});

// ── Contact Messages ────────────────────────────────────
router.get('/messages', requireAdmin, async (req, res, next) => {
  try {
    const messages = await query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.render('pages/admin/messages', { title: 'Messages', messages });
  } catch (err) { next(err); }
});

// ── User Management ──────────────────────────────────────
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const users = await query("SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC");
    res.render('pages/admin/users', { title: 'User Management', users });
  } catch (err) { next(err); }
});

module.exports = router;
