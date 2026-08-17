# SQLite Manager

Clean web UI to **open**, **browse**, **edit**, and **delete** rows in SQLite databases.

Runs **entirely in the browser** (sql.js) — perfect for **Vercel** (no server, no database host).

## Features

- Open any `.db` / `.sqlite` file (drag-and-drop)
- Sample database included
- Full table grid — every column visible, clear text
- Search, sort, pagination
- Edit / insert / delete rows
- **Download .db** to save your edits (browser memory only until you download)

## Local development

```bash
cd sqlite-manager/client
npm install
npm run dev
```

Open http://localhost:5177

## Deploy to Vercel

### Option A — Vercel CLI

```bash
cd sqlite-manager
npm i -g vercel
vercel
```

Follow prompts. Framework: Other / Vite.  
Root can be the repo; `vercel.json` points build to `client/`.

### Option B — GitHub + Vercel Dashboard

1. Push this folder to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo
4. Settings (auto-filled by `vercel.json` if present):
   - **Root Directory:** leave default (repo root) *or* set to `client`
   - **Build Command:** `cd client && npm install && npm run build` (if root)  
     or `npm run build` (if root = `client`)
   - **Output Directory:** `client/dist` (root) or `dist` (client)
5. Deploy

### Option C — Deploy only the client folder

```bash
cd sqlite-manager/client
npx vercel
```

Use:
- Build: `npm run build`
- Output: `dist`

## How Vercel works for this app

| Piece | Behavior |
|--------|----------|
| Hosting | Static React build |
| SQLite | sql.js (WASM) in the browser |
| Your file | Stays on the user's device / in browser memory |
| Edits | In-memory until **Download .db** |

No backend API is required on Vercel. The Express server in `/server` is **optional** for local-only use.

## Optional local API server

```bash
cd sqlite-manager
npm install --prefix server
npm run server
```

## Notes

- Large DBs (100MB+) may be slow or hit browser memory limits
- Always click **Download .db** after edits to keep changes
- Do not rely on Vercel server disk — this app does not use it.
