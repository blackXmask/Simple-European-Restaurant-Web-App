# La Maison Dorée — Elegant European Restaurant Web Application

A full-featured, production-ready restaurant web application built for a European dining establishment. Features online ordering, customer reviews, email/password authentication, and a comprehensive admin panel.

## ✨ Features

### Customer-Facing
- **Elegant Homepage** — Hero banner, featured dishes, category showcase, guest reviews, and restaurant stats
- **Full Menu** — Browse dishes by category (Antipasti, Mains, Desserts, Wine & Beverages) with real food photography
- **Online Ordering** — Session-based shopping cart, delivery/pickup options, order notes
- **Checkout** — Secure order placement with customer details and delivery address
- **Order History** — View past orders with status tracking (pending → preparing → ready → delivered)
- **Reviews** — Star ratings (1–5), review titles and comments, rating distribution sidebar
- **User Dashboard** — Order stats, total spent, review history, account overview
- **Contact** — Contact form with map integration
- **About** — Restaurant story, values, and chef profile

### Admin Panel
- **Dashboard** — Revenue stats, order counts, pending items, recent orders
- **Menu Management** — Full CRUD (create, edit, delete) for menu items with featured/availability toggles
- **Order Tracking** — Filter orders by status, inline status updates via dropdown
- **Review Moderation** — Approve or reject customer reviews before they appear publicly
- **Contact Messages** — View all contact form submissions
- **User Management** — View registered customers and admins

### Security
- **bcrypt** password hashing (industry standard)
- **express-session** with SQLite session store (persists across restarts)
- Role-based access control (customer vs admin)
- Input validation on all forms
- HTTP-only, sameSite cookies

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Templating | EJS 3 |
| Database | SQLite (via better-sqlite3) |
| Auth | bcrypt + express-session |
| Session Store | connect-sqlite3 |
| Method Override | PUT/DELETE in HTML forms |
| Icons | Font Awesome 6 (CDN) |
| Fonts | Playfair Display + Lato (Google Fonts) |
| Images | Unsplash (real food photography) |

## 📦 Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm (bundled with Node.js)

### Steps

1. **Clone or download** the project:
   ```bash
   git clone <your-repo-url>
   cd "Simple European Restaurant Web App"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional — defaults work out of the box):
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to customise the port, session secret, admin credentials, and restaurant details.

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Development Mode
For auto-restart on file changes:
```bash
npm run dev
```

## 🔐 Default Admin Account

| Field | Value |
|-------|-------|
| Email | `admin@lamaisondoree.com` |
| Password | `admin123` |

> ⚠️ **Change these credentials in production** by editing the `.env` file before first launch. Delete the `data/` folder to reset the database with new credentials.

## 📁 Project Structure

```
Simple European Restaurant Web App/
├── server.js                 # Express app entry point
├── package.json
├── .env.example              # Environment variable template
├── config/
│   └── database.js           # SQLite schema + seed data
├── middleware/
│   └── auth.js               # requireAuth, requireAdmin
├── routes/
│   ├── index.js              # Home, About, Contact
│   ├── auth.js               # Signup, Login, Logout, Dashboard
│   ├── menu.js               # Menu, Cart, Checkout, Orders
│   ├── reviews.js            # Reviews listing + submission
│   └── admin.js              # Admin panel routes
├── views/
│   ├── partials/             # Reusable components
│   │   ├── head.ejs          # HTML head
│   │   ├── navbar.ejs        # Navigation bar
│   │   ├── footer.ejs        # Footer + flash messages
│   │   ├── admin-head.ejs    # Admin layout wrapper
│   │   └── admin-footer.ejs # Admin layout footer
│   ├── pages/                # Page templates
│   │   ├── home.ejs
│   │   ├── menu.ejs
│   │   ├── cart.ejs
│   │   ├── checkout.ejs
│   │   ├── login.ejs
│   │   ├── signup.ejs
│   │   ├── dashboard.ejs
│   │   ├── reviews.ejs
│   │   ├── about.ejs
│   │   ├── contact.ejs
│   │   ├── orders.ejs
│   │   ├── order-detail.ejs
│   │   ├── admin/
│   │   │   ├── dashboard.ejs
│   │   │   ├── menu.ejs
│   │   │   ├── menu-form.ejs
│   │   │   ├── orders.ejs
│   │   │   ├── order-detail.ejs
│   │   │   ├── reviews.ejs
│   │   │   ├── messages.ejs
│   │   │   └── users.ejs
│   └── error.ejs             # 404/500 error page
├── public/
│   ├── css/
│   │   └── style.css         # Complete stylesheet
│   └── js/                   # (future client-side scripts)
└── data/                     # SQLite database (auto-created)
```

## 🚀 Deployment

### Option 1: VPS / Dedicated Server

1. Install Node.js 18+ on your server
2. Upload the project files (excluding `node_modules/` and `data/`)
3. Run `npm install` on the server
4. Set environment variables in `.env`:
   ```
   NODE_ENV=production
   SESSION_SECRET=<a-long-random-string>
   ADMIN_EMAIL=<your-admin-email>
   ADMIN_PASSWORD=<a-secure-password>
   ```
5. Start with a process manager:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "la-maison-doree"
   pm2 save
   pm2 startup
   ```

### Option 2: Using Nginx as Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 3: Docker

```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t la-maison-doree .
docker run -p 3000:3000 -v $(pwd)/data:/app/data la-maison-doree
```

## 🧪 End-to-End Testing Checklist

1. **User Registration**: Sign up at `/auth/signup` with a valid email and password
2. **Login/Logout**: Sign in and sign out at `/auth/login`
3. **Browse Menu**: Visit `/menu` and filter by category
4. **Add to Cart**: Click "Add" on any menu item
5. **Checkout**: Go to `/cart` → `/checkout` → fill in details → place order
6. **Order Confirmation**: View the order detail page after placing
7. **Order History**: Visit `/orders` to see past orders
8. **Write Review**: Go to `/reviews#write-review` → rate and comment
9. **Admin Login**: Sign in as admin → visit `/admin`
10. **Menu Management**: Add/edit/delete a menu item at `/admin/menu`
11. **Order Tracking**: Update order status at `/admin/orders`
12. **Review Moderation**: Approve/reject reviews at `/admin/reviews`

## 📊 Database Schema

### Tables
- **users** — id, name, email, password_hash, phone, role (customer/admin), created_at
- **categories** — id, name, slug, description, icon, sort_order
- **menu_items** — id, category_id, name, description, price, image_url, is_available, is_featured, sort_order
- **orders** — id, user_id, order_number, status, total, customer info, delivery_type, notes
- **order_items** — id, order_id, menu_item_id, name, price, quantity
- **reviews** — id, user_id, user_name, rating (1-5), title, comment, status, created_at
- **contact_messages** — id, name, email, subject, message, created_at

## 🔧 Configuration

All configuration is done via environment variables (`.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `SESSION_SECRET` | — | Secret for session signing (CHANGE IN PRODUCTION) |
| `DB_PATH` | `./data/restaurant.db` | SQLite database file path |
| `ADMIN_EMAIL` | `admin@lamaisondoree.com` | Seeded admin email |
| `ADMIN_PASSWORD` | `admin123` | Seeded admin password |
| `RESTAURANT_NAME` | `La Maison Dorée` | Restaurant name |

## 📝 License

MIT License — free for commercial use.

---

**La Maison Dorée** — *Where European tradition meets culinary excellence.* 🍽️
