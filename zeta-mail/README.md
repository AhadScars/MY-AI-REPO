# Zeta Mail

A Gmail-style webmail app for the **@zeta.com** domain.

## Features

- **Accounts** on `@zeta.com` (e.g. `alice@zeta.com`)
- **SQLite** storage with **bcrypt-hashed** passwords
- **Folders**: Inbox · Sent · Drafts · Scheduled
- **Compose**: subject, rich body, **file attachments**, **insert link**, **schedule send**
- **Auto-draft**: closing the compose window or browser tab saves to Drafts
- Mail delivery between registered @zeta.com users

## Quick start

```bash
# Terminal 1 — API
cd backend
npm install
npm run seed
npm start

# Terminal 2 — UI
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### Demo accounts

| Email | Password |
|-------|----------|
| alice@zeta.com | password123 |
| bob@zeta.com | password123 |
| carol@zeta.com | password123 |

## Stack

- **Backend**: Node.js, Express, built-in `node:sqlite`, bcryptjs, multer
- **Frontend**: React + Vite
- **DB file**: `backend/data/zeta.db`
- **Uploads**: `backend/uploads/`

## API (summary)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create user → `username@zeta.com` |
| POST | `/api/auth/login` | Login (cookie session) |
| GET | `/api/mails?folder=` | `inbox` \| `sent` \| `drafts` \| `scheduled` |
| POST | `/api/mails/draft` | Save / update draft |
| POST | `/api/mails/send` | Send now or schedule (`scheduledAt`) |
| POST | `/api/mails/:id/attachments` | Upload file (multipart) |

Scheduled messages are delivered by a background job every 30 seconds.
