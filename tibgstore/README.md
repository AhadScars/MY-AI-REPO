# TIBGSTORE

Black-and-white shop for **prebuilt PCs**, **custom builds**, and **parts**. The owner desk URL is a long secret path from `.env` (`ADMIN_PATH`) — the server prints it on start. Checkout is **Stripe**.

## Run

```bash
cd tibgstore
npm install
```

Copy `.env.example` to `.env` and set:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
ADMIN_PASSWORD=a-strong-password
URL_SECRET=long-random-hex
ADMIN_PATH=/x/long-random-hex
ACCOUNT_PATH=/u/long-random-hex
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=owner@gmail.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5174/auth/google/callback
```

Then:

```bash
npm start
```

Open [http://localhost:5174](http://localhost:5174).

## Hostinger (production + MySQL)

This shop is a **Node.js** app. Use Hostinger **Node.js / Cloud / VPS** (not plain PHP shared hosting).

1. In hPanel → **Databases** create a MySQL database and user. Note host (`localhost` on most Hostinger plans), database name, user, and password.
2. Open **phpMyAdmin** → select that database → **Import** → upload `db/schema.sql`.
3. Upload the project files (or git pull on VPS).
4. Copy `.env.example` to `.env` and fill:

```
NODE_ENV=production
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_hostinger_db_user
MYSQL_PASSWORD=your_hostinger_db_password
MYSQL_DATABASE=your_hostinger_db_name
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback
```

Also set Stripe, SMTP, Google, `SESSION_SECRET`, `URL_SECRET`, `ADMIN_PATH`, and `ADMIN_PASSWORD`.

5. On the server:

```bash
npm install --omit=dev
npm run db:migrate
npm start
```

`db:migrate` copies your current `data/*.json` catalog, orders, users, coupons, settings, and admin password into MySQL. Run it **once**. After that the live shop reads and writes the database only.

6. In hPanel Node.js app settings: start command `node server.js`, document root = this folder. Point the domain to that app.

7. In Google Cloud Console add the production callback URL. In Stripe add the live domain.

If `MYSQL_HOST` is empty, the shop still uses local JSON files (fine for your PC). Set the MySQL vars on Hostinger.

Windows: `run.bat`. macOS / Linux: `./run.sh`.

**Never put the Stripe secret key in HTML or `js/`.** It stays in `.env` on the server.

## Pages

| Page | URL |
| --- | --- |
| Home | `/` |
| Budget / Mid / High | `/budget.html` `/mid-range.html` `/high-end.html` |
| Custom PC + call assist | `/build.html` |
| Parts | `/parts.html` |
| Journal | `/blog.html` |
| Cart / Stripe checkout | `/cart.html` `/checkout.html` |
| Item page | `/i/<signed-key>` |
| Journal note | `/n/<signed-key>` |
| Your orders | secret path from `.env` (`ACCOUNT_PATH`) |
| Owner desk | secret path from `.env` (`ADMIN_PATH`, printed on start) |

## Admin

Default local password is `tibg-admin` until you change `ADMIN_PASSWORD`. Open the owner desk URL printed when the server starts — `/admin.html` is not public.

From admin you can add or remove products and blog posts, read custom-build callbacks, see Stripe orders, and edit the shop phone number.

## Custom build

Shoppers pick CPU, GPU, RAM, and the rest. The page warns on socket / PSU / case mismatches and puts **Call the owner** and WhatsApp next to the list so they can stay on the line while they tap.

## Stripe

1. Create keys at [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys).
2. Paste them into `.env`.
3. Restart `npm start`.
4. Use test card `4242 4242 4242 4242` in test mode.
