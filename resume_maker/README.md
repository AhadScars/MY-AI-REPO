# Resume Maker — 1-Page Customizable Builder

A pure-Python resume builder (no pip packages). Edit content and style in the browser, export a **single-page PDF**.

## Features

- **One page only** — A4 or US Letter, with live fill % and overflow warning
- **Header** — name, title, email, phone, location, website, LinkedIn, GitHub, extra
- **Sections** — summary, experience, education, skills, projects, certifications, languages, custom
- **Typography** — Helvetica / Times / Courier, per-role **size**, **bold**, **italic**
- **Dates & months** — Jan 2024 · January 2024 · 01/2024 · 2024-01 · year only · custom “Present” label
- **Layout** — margins, spacing, line height, header align, accent colors, header bar
- **ATS Score Analyzer** — rule-based score (0–100) + optional SpaceXAI deep analysis
- **Save / Load** JSON · Download PDF · Browser Print
- **Zero dependencies** — Python 3 standard library only

## Run

```bash
cd resume_maker
python3 app.py
```

Open **http://127.0.0.1:5050**

Optional env:

```bash
RESUME_HOST=0.0.0.0 RESUME_PORT=8080 python3 app.py
```

### AI ATS (optional)

Rule-based scoring always works offline. For AI insights (rewrite examples, keyword gaps, blended score):

1. Get a key: https://console.x.ai  
2. Export and start:

```bash
export XAI_API_KEY=your_key_here
# optional: export XAI_MODEL=grok-4.5
python3 app.py
```

In the app: open **ATS AI** tab → paste a job description → check **Use AI analyzer** → **Analyze ATS Score**.

## Usage tips for 1 page

1. Keep summary to 2–4 lines
2. 2–3 jobs with 2–4 bullets each
3. Use **Style** sliders to tighten section/item spacing
4. Shrink body / date sizes slightly under **Type**
5. Watch the green **Fits 1 page** badge (turns red if over)

## Project layout

```
resume_maker/
  app.py              # HTTP server + API
  pdf_generator.py    # Single-page PDF engine
  templates/index.html
  static/style.css
  static/app.js
  data/               # Saved resumes (JSON)
  exports/            # Generated PDFs
```

## API (optional)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/default` | Sample resume JSON |
| POST | `/api/pdf` | Body = resume JSON → PDF file |
| POST | `/api/save` | `{ "id": "name", "data": {...} }` |
| GET | `/api/list` | Saved resumes |
| GET | `/api/load/<id>` | Load saved JSON |
| GET | `/api/ats/status` | Whether SpaceXAI is configured |
| POST | `/api/ats` | `{ "resume": {...}, "job_description": "...", "use_ai": false }` → ATS report |

### ATS score breakdown (100 pts)

| Category | Max | Checks |
|----------|-----|--------|
| Contact | 15 | Name, email, phone, title |
| Structure | 20 | Summary, experience, education, skills |
| Content | 25 | Action verbs, metrics, bullet quality |
| Keywords | 25 | Job description match (or general skills) |
| Format | 15 | Fonts, dates, single-column, ATS-safe layout |
