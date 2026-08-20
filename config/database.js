const { createClient } = require('@libsql/client');
const bcrypt = require('bcrypt');

let _db = null;

function getDb() {
  if (_db) return _db;

  const url = process.env.TURSO_DATABASE_URL || process.env.DB_PATH || 'file:local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  _db = createClient({ url, authToken });
  return _db;
}

async function initDatabase() {
  const db = getDb();

  // ── Schema ──────────────────────────────────────────────
  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone         TEXT,
      role          TEXT NOT NULL DEFAULT 'customer',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      description TEXT,
      icon        TEXT,
      sort_order  INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS menu_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL,
      image_url   TEXT,
      is_available INTEGER DEFAULT 1,
      is_featured INTEGER DEFAULT 0,
      sort_order  INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      order_number    TEXT NOT NULL UNIQUE,
      status          TEXT NOT NULL DEFAULT 'pending',
      total           REAL NOT NULL,
      customer_name   TEXT NOT NULL,
      customer_phone  TEXT NOT NULL,
      customer_email  TEXT NOT NULL,
      delivery_address TEXT,
      delivery_type   TEXT DEFAULT 'delivery',
      notes           TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER REFERENCES menu_items(id),
      name        TEXT NOT NULL,
      price       REAL NOT NULL,
      quantity    INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      user_name  TEXT NOT NULL,
      rating     INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title      TEXT,
      comment    TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS contact_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      subject    TEXT,
      message    TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  ]);

  // ── Seed Admin ─────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lamaisondoree.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  const adminResult = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [adminEmail] });
  if (adminResult.rows.length === 0) {
    const hash = bcrypt.hashSync(adminPass, 10);
    await db.execute({ sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', args: ['Restaurant Admin', adminEmail, hash, 'admin'] });
    console.log(`[DB] Admin user created: ${adminEmail} / ${adminPass}`);
  }

  // ── Seed Categories ───────────────────────────────────
  const catResult = await db.execute('SELECT COUNT(*) as c FROM categories');
  if (Number(catResult.rows[0].c) === 0) {
    const cats = [
      ['Antipasti', 'antipasti', 'Delightful starters to begin your culinary journey', 'fa-leaf', 1],
      ['Main Courses', 'mains', 'Exquisite main dishes crafted by our master chefs', 'fa-utensils', 2],
      ['Desserts', 'desserts', 'Sweet indulgences to complete your meal', 'fa-ice-cream', 3],
      ['Wine & Beverages', 'beverages', 'Fine wines and refreshing drinks', 'fa-wine-glass', 4],
    ];
    for (const c of cats) {
      await db.execute({ sql: 'INSERT INTO categories (name, slug, description, icon, sort_order) VALUES (?, ?, ?, ?, ?)', args: c });
    }
    console.log('[DB] Categories seeded');
  }

  // ── Seed Menu Items ────────────────────────────────────
  const itemResult = await db.execute('SELECT COUNT(*) as c FROM menu_items');
  if (Number(itemResult.rows[0].c) === 0) {
    const items = [
      [1, 'Bruschetta al Pomodoro', 'Grilled artisan bread topped with fresh diced tomatoes, basil, garlic, and extra virgin olive oil', 8.50, 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800&q=80', 1, 1, 1],
      [1, "Soupe a l'Oignon", 'Classic French onion soup with caramelized onions, beef broth, and melted Gruyere cheese on toasted croutons', 7.00, 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80', 1, 0, 2],
      [1, 'Insalata Caprese', 'Fresh mozzarella di bufala, ripe tomato slices, basil leaves, and extra virgin olive oil', 9.00, 'https://images.unsplash.com/photo-1592417817049-429a092d23b6?w=800&q=80', 1, 1, 3],
      [1, 'Escargots de Bourgogne', 'Tender snails baked in garlic-parsley butter, a timeless French delicacy', 12.00, 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80', 1, 0, 4],
      [1, 'Gazpacho Andaluz', 'Chilled Spanish tomato soup with cucumber, bell pepper, garlic, and sherry vinegar', 7.50, 'https://images.unsplash.com/photo-1600335895828-9e2676f4a975?w=800&q=80', 1, 0, 5],
      [2, 'Coq au Vin', 'Free-range chicken braised in red wine with mushrooms, pearl onions, and smoked bacon', 18.50, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80', 1, 1, 1],
      [2, 'Beef Wellington', 'Tenderloin wrapped in mushroom duxelles, prosciutto, and golden puff pastry', 24.00, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80', 1, 1, 2],
      [2, 'Paella Valenciana', 'Saffron rice with chicken, rabbit, chorizo, mussels, and prawns in a traditional paella pan', 19.00, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80', 1, 1, 3],
      [2, 'Wiener Schnitzel', 'Pan-fried veal cutlet in golden breadcrumbs, served with potato salad and lingonberry jam', 16.50, 'https://images.unsplash.com/photo-1565299508349-8a6f7e9084ad?w=800&q=80', 1, 0, 4],
      [2, 'Spaghetti Carbonara', 'Al dente spaghetti with pancetta, free-range egg yolk, Pecorino Romano, and cracked black pepper', 14.00, 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80', 1, 0, 5],
      [2, 'Confit de Canard', 'Slow-cooked duck leg confit with crispy skin, served with sauteed potatoes and green salad', 21.00, 'https://images.unsplash.com/photo-1432139509613-5c4255815697?w=800&q=80', 1, 0, 6],
      [2, 'Moules Marinières', 'Steamed mussels in white wine, shallots, garlic, and cream, served with crusty bread', 17.50, 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80', 1, 0, 7],
      [3, 'Crème Brûlée', 'Silky vanilla custard with a caramelized sugar crust', 6.50, 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=800&q=80', 1, 1, 1],
      [3, 'Tiramisu', 'Coffee-soaked ladyfingers layered with mascarpone cream and cocoa dust', 6.00, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80', 1, 1, 2],
      [3, 'Fondant au Chocolat', 'Warm dark chocolate fondant with a molten center, served with vanilla bean ice cream', 7.50, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80', 1, 0, 3],
      [3, 'Apfelstrudel', 'Traditional Austrian apple strudel with raisins, cinnamon, and vanilla sauce', 6.50, 'https://images.unsplash.com/photo-1625938145744-5337235911b9?w=800&q=80', 1, 0, 4],
      [4, 'Château Margaux (Glass)', 'Grand cru classe Bordeaux, deep ruby with notes of blackcurrant and violet', 12.00, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80', 1, 1, 1],
      [4, 'Champagne brut (Glass)', 'Fine champagne with delicate bubbles and a crisp, elegant finish', 9.00, 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800&q=80', 1, 0, 2],
      [4, 'Espresso', 'Single-origin Italian espresso, rich and aromatic', 3.00, 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=80', 1, 0, 3],
      [4, 'Limonata Italiana', 'Freshly squeezed Italian lemonade with mint leaves', 3.50, 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800&q=80', 1, 0, 4],
    ];

    for (const r of items) {
      await db.execute({
        sql: 'INSERT INTO menu_items (category_id, name, description, price, image_url, is_available, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: r,
      });
    }
    console.log(`[DB] ${items.length} menu items seeded`);
  }

  // ── Seed Reviews ───────────────────────────────────────
  const reviewResult = await db.execute('SELECT COUNT(*) as c FROM reviews');
  if (Number(reviewResult.rows[0].c) === 0) {
    const reviews = [
      [1, 'Sophie Laurent', 5, 'An unforgettable evening', 'The Coq au Vin was absolutely divine. The ambiance transports you straight to Paris. We will be coming back!', 'approved'],
      [1, 'James Whitmore', 4, 'Excellent service and food', 'Beef Wellington was cooked to perfection. Only wish the portion was slightly larger. Desserts are a must-try.', 'approved'],
      [1, 'Anna Müller', 5, 'Best European restaurant in town', 'The Wiener Schnitzel tasted just like my grandmother used to make. Authentic flavours and beautiful presentation.', 'approved'],
      [1, 'Marco Rossi', 5, 'La Paella e perfetta', 'As a Spaniard, I am very picky about paella. This one exceeded all expectations. The saffron rice was spot on.', 'approved'],
    ];
    for (const r of reviews) {
      await db.execute({
        sql: 'INSERT INTO reviews (user_id, user_name, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?)',
        args: r,
      });
    }
    console.log('[DB] Sample reviews seeded');
  }

  console.log('[DB] Database initialized successfully');
  return db;
}

// Helper: normalize BigInt values to Number for JSON serialization
function normalizeRows(rows) {
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === 'bigint' ? Number(v) : v;
    }
    return out;
  });
}

// Helper: run a SELECT and return rows as plain JS objects
async function query(sql, args = []) {
  const db = getDb();
  const result = await db.execute({ sql, args });
  return normalizeRows(result.rows);
}

// Helper: run a SELECT and return first row
async function queryOne(sql, args = []) {
  const rows = await query(sql, args);
  return rows[0] || null;
}

// Helper: execute INSERT/UPDATE/DELETE and return metadata
async function execute(sql, args = []) {
  const db = getDb();
  const result = await db.execute({ sql, args });
  return {
    lastInsertRowid: Number(result.lastInsertRowid),
    changes: result.rowsAffected,
  };
}

// Helper: run multiple statements in a transaction
async function batch(statements) {
  const db = getDb();
  const result = await db.batch(statements);
  return result;
}

module.exports = { getDb, initDatabase, query, queryOne, execute, batch };
