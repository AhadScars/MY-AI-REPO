# ShowSpot

Book movies, events, sports and plays. Users pick seats and pay with **Stripe**. Admins run the platform. Organizers (management) list their own shows, venues and showtimes.

Runs on **SQLite** out of the box (a file in `data/showspot.sqlite`). Switch to **Hostinger MySQL** later with `DB_CLIENT=mysql`. Hostinger Node.js web apps need a Business / Cloud plan.

## Roles

| Role | What they can do |
| --- | --- |
| **User** | Browse, pick seats, pay, manage bookings, review shows, apply to become an organizer |
| **Organizer / management** | Create shows, venues, screens and showtimes; see sales for their listings |
| **Admin** | Everything above, plus users, cities, all bookings, and approving organizer applications |

## Local setup

You need **Node 22.5+** (24 is fine). No MySQL install.

```bash
cd showspot
cp .env.example .env
npm install
npm start
```

First start creates `data/showspot.sqlite` and loads demo movies + accounts.

Open http://localhost:3000

To reset the demo database, delete `data/showspot.sqlite` and start again.

### Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@showspot.com` | `Admin@123` |
| Organizer | `organizer@showspot.com` | `Organizer@123` |
| User | `user@showspot.com` | `User@123` |

Change these after first login.

If `STRIPE_SECRET_KEY` is empty, checkout uses **Demo Pay** so you can finish a booking without a Stripe account.

## Hostinger deploy

1. In hPanel → **Databases** create a MySQL database and user. Note host, name, user, password.
   - Same-server Node app: host is usually `localhost`.
   - If Hostinger shows a remote host like `auth-db123.hostinger.com`, use that.
2. hPanel → **Websites** → **Node.js** (Business or Cloud) → add a web app.
   - Node version: 18 or 20
   - Start command: `npm start`
   - Root: the `showspot` folder
3. Set environment variables (same keys as `.env.example`):

```
PORT=3000
NODE_ENV=production
APP_URL=https://your-domain.com
JWT_SECRET=a-long-random-string
DB_HOST=localhost
DB_PORT=3306
DB_USER=u123456789_showspot
DB_PASSWORD=your-db-password
DB_NAME=u123456789_showspot
DB_SSL=false
CURRENCY=usd
CURRENCY_SYMBOL=$
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

4. Set `DB_CLIENT=mysql` (leave SQLite behind once Hostinger MySQL is ready).
5. Upload the project (GitHub deploy or File Manager / FTP). Run once over SSH or the Node console:

```bash
npm install --omit=dev
npm run setup
```

`npm start` creates missing tables automatically. `npm run setup` loads the demo movies and accounts.

6. Optional: import `schema.sql` in phpMyAdmin instead of `npm run migrate`.

### Stripe on Hostinger

1. Create a Stripe account → Developers → API keys.
2. Put the secret key in `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → add endpoint  
   `https://your-domain.com/webhooks/stripe`  
   event: `checkout.session.completed`  
   copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Use a Stripe-supported `CURRENCY` (`usd`, `pkr`, `inr`, `aed`, `gbp`, …).

Until those keys are set, customers can still complete a booking with Demo Pay.

## Project layout

```
server.js            entry
schema.sql           Hostinger / phpMyAdmin import
src/migrate.js       creates database + tables
src/seed.js          demo data
src/routes/          public, auth, booking, account, admin, organizer
views/               pages
public/              CSS, JS, posters
```

Seed titles are original (not licensed films) so the demo art is safe to ship.

## Common Hostinger notes

- Hostinger databases are **MySQL only**. This app does not use PostgreSQL or MongoDB.
- Shared hosting *without* Node.js cannot run this. Use Business/Cloud Node, or a VPS.
- If the app cannot connect, turn on **Remote MySQL** for your IP, or set `DB_HOST` to the host shown in hPanel.
- Uploaded posters land in `public/uploads` — keep that folder writable.
