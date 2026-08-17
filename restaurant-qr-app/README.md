# TableOrder — Restaurant QR Ordering Dashboard

Owner dashboard + customer QR menu for restaurants.

## Core idea (anti-fake-order)

1. Print a **static QR** on each table.
2. When a guest sits, staff taps **Seat table** on the dashboard.
3. Guest scans QR → enters **name + phone** → orders.
4. If someone opens a saved QR from home while the table is **not seated**, ordering is **blocked**.
5. After the meal, staff taps **Close table** — session ends.

Name/phone alone does **not** stop home orders. **Staff seating** is the real gate.

## Stack

- **Backend:** Node.js, Express, Socket.io, SQLite (`node:sqlite`)
- **Frontend:** React + Vite

## Quick start

```bash
# Terminal 1 — API
cd backend
npm install
npm run seed
npm run dev

# Terminal 2 — UI
cd frontend
npm install
npm run dev
```

- Owner UI: http://localhost:5173/login  
- Demo login: `owner@demo.com` / `demo1234`  
- Customer example: http://localhost:5173/t/demo-cafe/T01  

**Flow to test**

1. Login as owner → **Tables & QR** → **Seat table** on T01  
2. Open customer URL (or Show QR) → enter name + 10-digit phone  
3. Add items → **Place order**  
4. See live order on **Live Orders** dashboard  
5. **Close table** → customer can no longer order  

## API

- `POST /api/auth/register` · `POST /api/auth/login`
- `GET/POST /api/tables` · `POST /api/tables/:id/seat|close` · `GET /api/tables/:id/qr`
- `GET/POST /api/menu/...`
- `GET /api/orders` · `PATCH /api/orders/:id/status`
- Public: `/api/public/:slug/tables/:code`, `.../join`, `.../menu`, `/api/public/orders`

## Session rules

| Table state | Customer can order? |
|-------------|---------------------|
| Free (no session) | No |
| Seated / Active (staff seated) | Yes, after name+phone |
| Closed / expired (90 min default) | No |

One phone claims a seated session; another phone is rejected until the table is closed and seated again.
