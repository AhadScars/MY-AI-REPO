# Soleil — Sunglasses store (HTML, CSS, JS)

A static e-commerce site. No React, no npm, no build step.

## Run

```bash
cd soleil
python3 -m http.server 5173
```

Windows: double-click `run.bat`

Then open [http://localhost:5173](http://localhost:5173)

Use a local server so the cart and admin share the same data. Opening files directly (`file://`) can isolate each page.

## Demo payment

- Card: `4242 4242 4242 4242`
- Expiry: any future date (`12/28`)
- CVC: any 3 digits
- `4000 0000 0000 0002` is declined on purpose

## Admin

- URL: `/admin/login.html`
- Email: `admin@soleil.com`
- Password: `admin123`

Admin can add / edit / delete products, update order status, view customers, and reset demo data.
