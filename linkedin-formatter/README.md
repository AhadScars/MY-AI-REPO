# LinkedIn Text Formatter

Format LinkedIn posts with **bold**, *italic*, ***bold italic***, underline, and bullet points — using Unicode characters that paste cleanly into LinkedIn (no HTML/markdown support required).

## Features

- **Bold / Italic / Bold italic** — Mathematical Alphanumeric Symbols
- **Underline** — combining underline (U+0332)
- **Bullet lists** — dot, dash, arrow, check, star, numbered, and more
- **Live LinkedIn-style preview**
- **Copy for LinkedIn** — one click to clipboard
- Character counter (LinkedIn ~3000 limit)
- Dark mode support (system preference)

## How to use

1. Type or paste your post
2. **Select** the text you want to style
3. Click **B**, **I**, **BI**, or **U**
4. Pick a bullet style and click **• List** for selected lines
5. Click **Copy for LinkedIn** and paste into LinkedIn

## Run locally

```bash
cd linkedin-formatter
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

grok --resume 019fa383-d598-70a0-b5d9-ac92811c0ffd

## Note

LinkedIn does not support real rich text in posts. This app converts letters to look-alike Unicode so formatting survives paste. Appearance can vary slightly by device/font.
