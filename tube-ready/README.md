# TubeReady

Chrome extension that **auto-detects the YouTube video** on the page and gets it **ready to download**.

Open a video or Short → the red button appears → pick a quality → download.

## Use yt-dlp (recommended)

Chrome cannot run yt-dlp inside the browser. TubeReady talks to a small local helper.

You already have Python and yt-dlp on this PC. One-time setup:

1. Double-click `install-host.bat`
2. Open `chrome://extensions` and **reload TubeReady**
3. Open a YouTube video and click **Download video**

Files go to `Downloads\TubeReady`.

If you want 1080p video+audio merged into one file, also install [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) and add it to PATH.

## What it does

- Detects `youtube.com/watch`, Shorts, Live, `youtu.be`, embed, and Music links
- Shows a **Ready** badge and an on-page download button as soon as the video is found
- Lets you pick quality or audio-only
- Popup works from any tab: paste a YouTube link if you are not already on the video
- Right-click a YouTube link → **Download with TubeReady**
- Shortcut: `Alt+Shift+D`

Files save to `Downloads/TubeReady/`.

Downloads go through YouTube’s player API. Official [cobalt.tools](https://cobalt.tools) currently has YouTube disabled, so the Cobalt button opens a working community instance (`cobalt.3kh0.net` by default).

## Install in Chrome (unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Choose this folder: `tube-ready`
5. Pin **TubeReady** from the puzzle-piece menu
6. Open any YouTube video

The first time Chrome may ask for permission to download files and to access YouTube. Allow both.

## Use

1. Open a YouTube video
2. A red download button appears in the bottom-right
3. It already shows the title, thumbnail, and **Ready to download**
4. Click **Download video**

Or click the toolbar icon — the popup detects the current tab automatically.

## Settings

Right-click the extension icon → **Options** (or open Settings from the popup).

You can change default quality, hide the on-page button, pick a Cobalt website that still supports YouTube, or point TubeReady at your own [Cobalt](https://github.com/imputnet/cobalt) API instance.

## Note

Only download videos you have the right to save (your own uploads, Creative Commons, or other permitted content). This is a local unpacked extension for personal use.

## Files

```
tube-ready/
  manifest.json
  background.js
  content.js
  inject.js
  detect.js
  backends.js
  popup.html
  options.html
  icons/
```
