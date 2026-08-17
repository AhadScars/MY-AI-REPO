# Pulse Browser

A full-featured desktop web browser built with **Electron** (Chromium), featuring multi-tab browsing, history, bookmarks, downloads, and a Chrome-like interface.

![Pulse Browser](https://img.shields.io/badge/Electron-Chromium-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

| Feature | Description |
|--------|-------------|
| **Tabs** | Open, close, switch, middle-click close, session restore |
| **Navigation** | Back, forward, reload, stop, home |
| **Omnibox** | Type URLs or search queries with history/bookmark suggestions |
| **History** | Full visit history with search and clear |
| **Bookmarks** | Star pages, bookmarks bar, dedicated manager |
| **Downloads** | Track downloads, open containing folder |
| **New Tab** | Search + shortcut tiles from bookmarks/history |
| **Settings** | Home page, search engine, bookmarks bar, session restore |
| **Security** | Context isolation, sandboxed webviews, HTTPS indicator |

## Requirements

- **Node.js** 18+ (includes npm)
- Linux, Windows, or macOS

## Install & run

### Windows (recommended on this PC)

Double-click **`run.bat`**, or in PowerShell / CMD:

```bat
cd pulse-browser
npm install
npm start
```

Run `npm install` from **Windows** (not WSL) so Electron downloads the Windows binary.

### Linux / macOS / WSL

```bash
cd pulse-browser
npm install
npm start
# or: ./run.sh
```

On Linux/WSL you need Chromium system libraries (e.g. `libnss3`, `libgtk-3-0`, `libgbm1`). On Ubuntu:

```bash
sudo apt install libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2
```

Development with extra logging:

```bash
npm run dev
```

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+L` | Focus address bar |
| `Ctrl+R` / `Ctrl+Shift+R` | Reload / hard reload |
| `Alt+←` / `Alt+→` | Back / forward |
| `Ctrl+D` | Bookmark current page |
| `Ctrl+H` | History |
| `Ctrl+J` | Downloads |
| `Ctrl+N` | New window |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset |
| `F12` | Page developer tools |

On macOS, use `Cmd` instead of `Ctrl`.

## Project structure

```
pulse-browser/
├── package.json
├── README.md
└── src/
    ├── main/
    │   ├── main.js      # App entry, window, IPC, downloads, menu
    │   ├── tabs.js      # Tab manager (BrowserView), navigation
    │   └── store.js     # History, bookmarks, downloads, settings
    ├── preload/
    │   ├── chrome-preload.js  # API for chrome UI
    │   └── view-preload.js    # API for internal pages
    └── renderer/
        ├── chrome.html / .css / .js   # Tab strip + toolbar UI
        └── pages/                     # newtab, history, bookmarks, …
```

## Data storage

User data (history, bookmarks, session, settings) is stored under Electron’s `userData` directory in a `pulse-data` folder.

## Notes

- Pages are rendered with Chromium via Electron `BrowserView` (same engine family as Chrome).
- Internal pages use the `pulse://` scheme (new tab, history, bookmarks, downloads, settings).
- Address bar: domain-like input opens as HTTPS; everything else is sent to your search engine.

## License

MIT
