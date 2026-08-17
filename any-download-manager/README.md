# ADM — Any Download Manager

**IDM-style desktop download manager** for Windows / Linux / macOS.

Paste any link — software installers, ZIP files, direct media, YouTube, Instagram, TikTok, and 1000+ sites — and ADM downloads it with a multi-connection engine, queue, pause/resume, and live speed stats.

![Python](https://img.shields.io/badge/Python-3.10+-blue) ![UI](https://img.shields.io/badge/UI-CustomTkinter-green)

---

## Features (like IDM)

| Feature | Description |
|--------|-------------|
| **Add URL** | Paste any `http/https` link |
| **Multi-connection** | Up to **16** parallel connections per file (Range requests) |
| **Queue** | Multiple downloads, max concurrent limit |
| **Pause / Resume / Stop** | Control individual jobs or all |
| **Progress** | Size, %, speed, ETA |
| **Media sites** | YouTube, Instagram, TikTok, X, Facebook, Vimeo, Reddit… via **yt-dlp** |
| **Audio extract** | MP3 from media URLs |
| **History** | Jobs saved under `data/history.json` |
| **Settings** | Default folder, connections, concurrency |

---

## Requirements

| Software | Why |
|----------|-----|
| **Python 3.10+** | Runs the app |
| **customtkinter**, **Pillow**, **yt-dlp** | UI + media engine |
| **FFmpeg** (recommended) | Merge best video+audio, audio convert |

### Install FFmpeg (Windows)

```bat
winget install Gyan.FFmpeg
```

Or download: https://www.gyan.dev/ffmpeg/builds/

### Install FFmpeg (Linux / WSL)

```bash
sudo apt update && sudo apt install -y ffmpeg
```

---

## Setup & run

### Windows (easiest)

Double-click **`run.bat`** — creates a venv, installs deps, starts ADM.

### Manual

```bash
cd any-download-manager
python -m venv .venv

# Windows
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python main.py

# Linux / macOS
.venv/bin/pip install -r requirements.txt
.venv/bin/python main.py
```

Or: `bash run.sh`

---

## How to use

1. Click **Add URL** (or press **Ctrl+N** / **Ctrl+V** with a link on the clipboard)
2. Paste the file or video link
3. Choose save folder, connections (8 default), type:
   - **Auto** — detect direct file vs media site
   - **Direct file** — multi-part HTTP download
   - **Video / Media** — yt-dlp
   - **Audio only** — MP3
4. Click **Download**
5. Use **Start / Pause / Stop / Delete** on selected rows
6. Double-click a completed file name to open it
7. **Folder** opens the save directory

---

## Project layout

```
any-download-manager/
├── main.py                 # Entry point
├── requirements.txt
├── run.bat / run.sh
├── downloads/              # Default save folder
├── data/                   # settings + history
└── adm/
    ├── app.py              # GUI
    ├── engine.py           # Multi-connection + yt-dlp
    ├── queue.py            # Queue / workers
    ├── models.py
    ├── storage.py
    └── utils.py
```

---

## Notes

- Multi-connection acceleration needs the server to support **HTTP Range** requests. Small files or servers without ranges fall back to a single connection.
- Pause on multi-part downloads cancels the current run and re-queues; resume restarts with partial-file reuse where possible (single-connection uses `.adm.partial`).
- Only download content you have the right to access. Respect copyright and site terms of service.
- This is **not** affiliated with Internet Download Manager (Tonec Inc.).

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+N** | Add URL |
| **Ctrl+V** | Add URL from clipboard (if it looks like a link) |
| **Delete** | Remove selected jobs from the list |
