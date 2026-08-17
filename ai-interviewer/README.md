# Offline Resume Coach

**Fully offline** resume reviewer + practice interviewer.  
Upload a resume, get a local review, then interview yourself with voice.  
**No API keys. No cloud AI. Resume data stays on your machine.**

## Features

1. **Resume review (offline)** — score, strengths, weaknesses, ATS tips, bullet rewrites  
2. **Self-interview (offline)** — questions tailored from your resume  
3. **Voice** — spoken questions (system TTS) + mic or typed answers  
4. **Camera + session recording** (optional)  
5. **Notes & feedback files** saved under `data/sessions/`  
6. **Desktop app** via Electron (optional shell around local Next.js)

## How offline works

| Piece | Offline? |
|--------|----------|
| Resume parse + review scoring | Yes — local heuristics engine |
| Interview questions & feedback | Yes — local engine |
| Question speech (TTS) | Yes — OS/browser voices |
| Mic dictation (STT) | **Browser-dependent** — Chrome often uses cloud STT. **Type answers for a fully offline path.** |
| Google Gemini / OpenAI / etc. | **Not used** |

## Requirements

- Node.js 18+  
- Chrome or Edge recommended for speech  
- No internet required after `npm install`

## Setup

```powershell
cd "C:\Users\Shoaib Qazi\Desktop\ai-interviewer"
npm install
```

No `.env` needed for offline mode.

## Run in browser (local only)

```powershell
npm run dev
```

Open **http://127.0.0.1:3000** (stays on your machine).

## Run as desktop app

```powershell
npm install
npm run desktop
```

This starts the local server and opens an Electron window.

## Usage

1. Enter the **target role**  
2. Upload a **.txt** / text PDF resume, or paste text  
3. Click **Review resume offline**  
4. Read the review → **Start voice interview**  
5. Answer with mic or keyboard → get strengths & improvements  

### Best resume formats for offline

- Prefer **.txt** or paste text  
- PDF works when it has real text (not a scanned image)  
- Image-only resumes are not supported offline (no cloud OCR)

## Project layout

```
src/lib/offline-interviewer.ts   # resume review + interview engine
src/app/api/analyze|interview|feedback  # offline-only APIs
data/sessions/                   # notes, transcripts, feedback files
electron/main.js                 # desktop shell
```

## Privacy

- Processing runs on `127.0.0.1`  
- Sessions are written only under `data/sessions/` on disk  
- No Gemini/OpenAI keys required  

## Optional later upgrades

- Local Whisper (true offline STT)  
- Local Ollama LLM for richer free-form feedback  
- Tauri packaging for a smaller installer  
