# Prepwise

Professional AI mock-interview platform. Upload a resume, sit a realistic Grok-powered interview, and download a recruiter-style assessment.

## Features

- Email signup / login, password reset, optional Google sign-in
- Resume upload (PDF, DOC, DOCX) with parsed preview you can edit
- Configurable role, company, type, difficulty, style, and length
- Dynamic interviewer with follow-ups (never a static question list)
- Server-side interview state and answer evaluation
- Professional report: scores, strengths, weaknesses, question review, 7-day plan
- PDF export, history, and progress over time

## Setup

```bash
cd mock-interview
cp .env.example .env
```

Set these in `.env`:

```
XAI_API_KEY=your_xai_key
AUTH_SECRET=long-random-string
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional Google sign-in:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Then:

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`XAI_API_KEY` stays on the server. It is never sent to the browser.

Get a key at [https://console.x.ai](https://console.x.ai). The app uses the SpaceXAI/xAI API (`https://api.x.ai/v1`, model `grok-4.6`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npx prisma db push` | Create / update SQLite schema |
| `npx prisma studio` | Inspect the database |

## Notes

- Password reset links are logged (and returned in development) because email is not configured.
- Scanned image-only PDFs cannot be parsed without OCR.
- Interview scores are hidden until the report is generated.
