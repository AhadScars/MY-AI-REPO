# PayFlow — PhonePe / Paytm style demo

Demo wallet app: link bank accounts and pay via **username**, **UPI ID**, or **bank transfer**.

> **Demo only** — no real bank or UPI connections. Data is stored in `data/db.json`.

## How to run

You need **two terminals** (Node.js 18+).

### 1. Start the API (backend)

```bash
cd payflow/backend
npm start
```

Runs at **http://localhost:4000**

### 2. Start the app (frontend)

```bash
cd payflow/frontend
npm run dev
```

Open **http://localhost:5173**

### Demo login

| Field    | Value        |
|----------|--------------|
| Phone    | `9876543210` |
| Password | `demo123`    |

Other users (same password): **priya**, **rahul**

### Try payments

- **Username:** `@priya` or `@rahul`
- **UPI:** `priya@payflow` or `rahul@okaxis`
- **Bank transfer:** A/C `001234567890`, IFSC `ICIC0000789` (Priya)
- **UPI PIN (demo):** any 4–6 digits, e.g. `1234`

## Features

- Login / register
- Wallet + add money from linked bank
- Link / unlink bank accounts
- Pay via username, UPI, or bank transfer
- Transaction history
- Mobile-first UI

## Scripts

| Folder     | Command        | Purpose              |
|------------|----------------|----------------------|
| `backend`  | `npm start`    | Production API       |
| `backend`  | `npm run dev`  | API with auto-reload |
| `frontend` | `npm run dev`  | Vite dev server      |
| `frontend` | `npm run build`| Production build     |


 019f8f17-2799-7520-8ddd-17d00566c0ef
