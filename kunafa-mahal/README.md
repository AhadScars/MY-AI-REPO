# Kunafa Mahal

A complete café website with its own food-delivery desk for **Kunafa Mahal**, Shop 4, New Market, Zone 2, near Multilevel Parking, Hazratganj, Lucknow.

The look follows the official site at [kunafamahal.in](https://kunafamahal.in/): house maroon `#961B27`, cream type, Open Sans, and the palace crest. Menu names and copy come from the official site and the [Zomato listing](https://www.zomato.com/lucknow/kunafa-mahal-hazratganj). The map pin is [this Google Maps place](https://maps.app.goo.gl/fgw6T6rt8KAGpr797).

## What’s included

- Home, menu, cart, checkout, order confirmation, live track
- About, visit / contact
- **Admin desk** at `/admin.html` — every order from every browser
- Delivery across Lucknow areas, or café pickup
- GST, packaging, area-wise delivery fee, promo codes
- WhatsApp to `+91 73070 97771`

Orders are saved on the café server (`data/orders.json`) so the admin desk can see them. There is no online payment step. Guests can order without signing in; guest orders do not earn loyalty points.

### Admin login

| | |
| --- | --- |
| Address | http://localhost:4173/admin.html |
| Username | `admin` |
| Password | `Kunafa@7771` |

From the desk you can filter live tickets, open a guest’s thaal, mark cooking / out for delivery / delivered, cancel, read contact-form messages, and add / edit / delete menu dishes with a price and photo (they appear on the public menu).

### Loyalty points

Every delivery or pickup order earns **100 points**. **100 points = ₹50** on the next bill. Guests tick “Pay with loyalty points” at checkout — points are stored on their mobile number.

### Google OAuth

Add these to `.env` after you create a Web OAuth client in Google Cloud Console:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4173/api/auth/google/callback
```

In the Google Cloud app, set the authorized redirect URI to exactly `http://localhost:4173/api/auth/google/callback`. Enable the Gmail API if you want “Connect Gmail with Google” in the admin desk.

Guests can **Sign in with Google** in the header. Staff can sign in to admin with the café Gmail (`ADMIN_EMAIL` / `SMTP_TO`).

### Gmail SMTP

Edit `kunafa-mahal/.env` then restart the server:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=Kunafa Mahal <your-gmail@gmail.com>
SMTP_TO=your-gmail@gmail.com
```

Use a Gmail **App Password**, not your normal Google password. Once set, the café gets mail for new orders and contact messages; guests who leave an email get a confirmation and status updates. Orders still work if SMTP is empty.

## Run it

```bash
cd kunafa-mahal
python3 server.py
```

Windows: double-click `run.bat`. Then open http://localhost:4173 and the admin desk at http://localhost:4173/admin.html

## Deploy on Vercel

1. Push this folder to GitHub and import it in [Vercel](https://vercel.com/new). Root directory: `kunafa-mahal` if the repo parent is `AI`.
2. Framework Preset: **Other**.
3. Add the same keys from `.env` in **Project → Settings → Environment Variables**:

```
SITE_URL=https://your-app.vercel.app
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/auth/google/callback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_TO=
ADMIN_EMAIL=
```

4. In Google Cloud, add Authorized redirect URI: `https://your-app.vercel.app/auth/google/callback` (and the JavaScript origin `https://your-app.vercel.app`).
5. Deploy.

The café pages are static. Orders, login, and mail go through `/api`. Vercel’s disk is not permanent — new dishes you upload in admin and live orders may reset when the function sleeps. The menu that ships in `data/menu.json` is included in the deploy.

## Promo codes

| Code | Offer |
| --- | --- |
| `ROYAL50` | ₹50 off above ₹399 |
| `KUNAFA10` | 10% off above ₹499 |
| `WELCOME` | ₹80 off above ₹449 |
| `PALACE` | ₹120 off above ₹899 |

## Notes

- Hours on the site match the official listing: 12:00 pm – 11:45 pm daily.
- Most dish prices are café estimates aligned with ~₹500 for two and the published ₹529 Pista Dream Salankatia. Swap numbers in `js/data.js` when you have the full rate card.
- Product photos mix official Kunafa Mahal plates with matching studio shots.
