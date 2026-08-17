# Video AI Notes

A local computer app that **analyzes videos with AI**, writes structured **notes**, and lets you send **follow-up commands** (chat) about the video.

Built with **Google Gemini** vision + chat.

## What it does

1. **Upload** a video (MP4, WebM, MOV, etc.)
2. Extracts key **frames in your browser** (nothing leaves your machine until you click Analyze)
3. Sends frames to **Gemini** for visual analysis
4. Generates Markdown **notes** (summary, timeline, key points, tags, action items)
5. **AI Commands** panel — ask follow-ups like “create a quiz”, “list products shown”, etc.

## Setup

### 1. API key

1. Create a free key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. In this folder, copy the example env file:

```bash
cp .env.example .env
```

3. Edit `.env` and set:

```
GEMINI_API_KEY=your_real_key_here
```

### 2. Install & run

```bash
cd video-ai-notes
npm install
npm start
```

Open **http://localhost:3847** in your browser.

## Usage

| Step | Action |
|------|--------|
| 1 | Drop or browse for a video |
| 2 | Optional: set frame count (6–16) and a focus prompt |
| 3 | Click **Analyze with AI** |
| 4 | Read / edit / copy / download notes |
| 5 | Use **AI Commands** for follow-up questions |

### Example follow-up commands

- `Summarize the main takeaway in one sentence.`
- `List all people, products, or brands shown.`
- `Create a study guide with quiz questions from this video.`
- `Rewrite the notes as bullet action items only.`
- `What happens around the middle of the video?`

## Requirements

- **Node.js** 18+
- Modern browser (Chrome, Edge, Firefox)
- `GEMINI_API_KEY` with access to Gemini models that support **image understanding**

## Project layout

```
video-ai-notes/
  server/
    index.js      # Express API
    ai.js         # Google Gemini client
  public/
    index.html
    styles.css
    app.js        # Frame extraction + UI
  .env.example
  package.json
```

## Privacy notes

- Video file stays in the browser for preview and frame grab.
- Only **JPEG frames** (not the full video file) are sent to the API for analysis.
- Sessions are stored **in memory** on the server and cleared when the process restarts.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Status: “Set GEMINI_API_KEY” | Add key to `.env`, restart `npm start` |
| Analysis fails | Check key at [AI Studio](https://aistudio.google.com/apikey); try `MODEL=gemini-2.0-flash` |
| Black frames | Try MP4 (H.264); some codecs don’t decode in browser |
| Large video slow | Use fewer frames (6) or a shorter clip |

## Optional model override

In `.env`:

```
MODEL=gemini-3.5-flash
# or: gemini-2.5-pro, gemini-2.0-flash
```

## License

MIT
