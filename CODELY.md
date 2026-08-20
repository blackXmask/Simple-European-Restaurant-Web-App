

## Codely Structured Memories

### User

### Feedback

### Project
- [2026-08-20 09:17:19] Simple European Restaurant Web App — Freelancer.com contest entry (₹500 INR, 9 entries, 29 days remaining). Task: lightweight traditional-yet-elegant restaurant web app with menu browsing, online ordering, customer reviews, email/password auth. Tech: Node.js + Express + EJS + SQLite (better-sqlite3) + bcrypt + express-session. Restaurant name: "La Maison Dorée" (Paris est. 1923). Theme: burgundy #722F37 + gold #C4A35A + cream #FAF6F0, Playfair Display + Lato fonts, Font Awesome 6 icons, real Unsplash food images. Features: customer signup/login, menu by category (Antipasti, Mains, Desserts, Beverages), session-based cart, checkout (delivery/pickup), order history, star ratings (1-5) with review moderation, admin panel (dashboard, menu CRUD, order tracking, review moderation, user management, contact messages). Admin: admin@lamaisondoree.com / admin123. All endpoints tested end-to-end (signup, cart, checkout, review, admin panel — all 200 OK).
- [2026-08-20 10:29:09] Simple European Restaurant Web App — Deployed on Vercel + Turso DB. GitHub repo: github.com/blackXmask/Simple-European-Restaurant-Web-App. Vercel URL: simple-european-restaurant-web-app.vercel.app. Turso DB URL: libsql://restaurant-blackxmask.aws-ap-south-1.turso.io. Tech migration: better-sqlite3 → @libsql/client (Turso), connect-sqlite3 → memorystore for serverless. Key Vercel fix: store initDatabase() as a promise and await it in middleware (serverless cold starts don't wait for async init). BigInt values from Turso must be Number()'d for JSON serialization. env vars needed: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD.

### Reference

