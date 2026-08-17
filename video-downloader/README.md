# MediaVault — Multi-Platform Video Downloader

Professional desktop app to download **video** or **audio only** from:

- **YouTube**
- **Instagram**
- **TikTok**
- Twitter/X, Facebook, Vimeo, Reddit, and 1000+ sites (via [yt-dlp](https://github.com/yt-dlp/yt-dlp))

Supports **original / best quality**, quality caps (1080p–360p), and audio export (MP3, M4A, WAV, OPUS).

---

## Requirements

| Software | Why |
|----------|-----|
| **Python 3.10+** | Runs the app |
| **yt-dlp**, **customtkinter**, **Pillow** | Download engine + UI |
| **FFmpeg** (recommended) | Merge best video+audio, convert audio formats |

### Install FFmpeg (Windows)

1. Download: https://www.gyan.dev/ffmpeg/builds/ (essentials build)
2. Extract and add the `bin` folder to your system **PATH**
3. Or with winget: `winget install Gyan.FFmpeg`

### Install FFmpeg (Linux / WSL)

```bash
sudo apt update && sudo apt install -y ffmpeg
```

---

## Setup

```bash
cd video-downloader
python -m pip install -r requirements.txt
```

Or double-click **`run.bat`** on Windows (creates a venv and installs deps automatically).

---

## Run

```bash
python main.py
```

Windows: double-click `run.bat`.

---

## How to use

1. Paste a video URL (YouTube / Instagram / TikTok / etc.)
2. Click **Fetch Info** to preview title, creator, duration, quality
3. Choose:
   - **Video** + quality (**Best (Original)** recommended)
   - **Audio Only** + format (MP3 320kbps, M4A, WAV, OPUS)
4. Pick a save folder (default: `downloads/`)
5. Click **Download**

---

## Notes

- **Original quality** uses yt-dlp’s best video + best audio and remuxes to MP4 when needed.
- Some Instagram / TikTok posts may require login cookies for private or age-gated content.
- Use only for content you have the right to download. Respect platform terms and copyright.

---

## Project layout

```
video-downloader/
├── main.py              # MediaVault GUI app
├── requirements.txt
├── run.bat              # Windows launcher
├── downloads/           # Default output folder
└── README.md
```
