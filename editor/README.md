# Terminal — Online Code Editor

Browser-based IDE: write code in **Monaco**, run it in a **terminal** or open a **live preview**.  
Built with **Next.js 16**, **React 19**, and **Tailwind CSS 4**. Deploy-ready on **Vercel**.

Works on **phone, tablet, and desktop** (responsive layout with Code / Output panels on mobile).

---

## Features

### Editor & workspace
- **Monaco** editor with syntax highlighting, ligatures, and word wrap.
- **Multi-tab** workspace (new tab, close, language per tab)
- **Split layout**: editor + terminal / preview (drag to resize on desktop)
- **Mobile**: full-height **Code | Output** switcher
- **Run / Preview** with `Ctrl/Cmd + Enter`
- **Import** (file picker or drag-and-drop) + **Export** download
- **Share** playground links (`?p=…`) — open the same language + code in any browser

### Languages

| Language | How it runs |
|----------|-------------|
| Java, Python, C, C++ | Terminal via [Judge0 CE](https://ce.judge0.com) |
| TypeScript, Go, Rust, Kotlin | Terminal via Judge0 |
| PHP, Ruby, C#, SQL (SQLite) | Terminal via Judge0 |
| JavaScript | Terminal in the **browser** (fast, no network) |
| HTML, CSS | **Live preview** iframe (stays in the browser) |

### Learning & classroom
- **Public Gallery** — searchable examples (basics, algorithms, web, data) with pagination  
  Open any example in **any language** you choose
- **Teacher Problem Pack** — problems with starter code + automated tests (sample + hidden)  
  Solve in **any supported language**; tests check stdin/stdout
- Interactive **stdin** in the terminal (Scanner / `input()` / `cin` style)
- After each Judge0 run: **wall time**, **CPU time**, and **memory**

### Toolbar
- Language picker, Run, Share, Import  
- **More (⋯)**: Gallery, Problems, Export, Reset, Clear code, Clear output  

---

## How execution works

```
┌─────────────┐     /api/run      ┌──────────────────┐
│  Browser    │ ───────────────► │  Judge0 CE sandbox│
│  Monaco UI  │ ◄─────────────── │  compile + run    │
└─────────────┘   stdout/stderr  └──────────────────┘
       │
       ├── JavaScript → runs in browser
       └── HTML/CSS   → iframe preview only
```

- Server languages are **not** executed on Vercel’s Node runtime.
- Code is sent to **Judge0** (public CE, RapidAPI, or self-hosted).
- No local JDK, Python, GCC, etc. needed on your machine or on Vercel

---

## Quick start

```bash
# Install
npm install

# Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm start       # serve production build
npm run lint    # ESLint
```

---

## Project structure

```
src/
  app/
    api/run/route.ts      # Judge0 proxy (compile + run)
    page.tsx              # App entry → Workspace
    layout.tsx            # Metadata, viewport, fonts
    globals.css           # Theme, safe-area, responsive helpers
  components/
    Workspace.tsx         # Tabs, run flow, share, mobile panels
    Toolbar.tsx           # Actions + language picker
    CodeEditor.tsx        # Monaco
    EditorTabs.tsx        # Multi-tab bar
    Terminal.tsx          # stdout / stderr / stdin
    Preview.tsx           # HTML/CSS iframe
    GalleryModal.tsx      # Public examples
    ProblemsModal.tsx     # Teacher problem pack
    ProblemPanel.tsx      # Active problem + Run tests
    ShareModal.tsx        # Shareable link
    Pagination.tsx        # Gallery / problems pages
    LangPicker.tsx        # Language select in modals
    Modal.tsx             # Shared dialog (responsive sheet on mobile)
  lib/
    languages.ts          # Language configs + samples
    gallery.ts            # Gallery examples
    problems.ts           # Problem definitions + test runner
    starters.ts           # Multi-language starters
    share.ts              # Encode / decode share URLs
    runInteractive.ts     # Interactive Judge0 stdin loop
    runJs.ts              # Browser JavaScript runner
    tabs.ts               # Tab model helpers
```

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Run / Preview |
| `Ctrl/Cmd + T` | New tab (same language) |
| `Ctrl/Cmd + W` | Close tab |
| `Escape` | Close modal / menus |

---

## Notes & limits

- Public Judge0 has **rate limits** and caps (~5s CPU, limited memory).
- Java: use a `public class` with `main` (e.g. `public class Main`).
- Network is required for Judge0 languages; **JS / HTML / CSS** work offline.
- Share links put code in the URL — very large snippets may be truncated by some messengers.
- SQL problems run as **SQLite** on Judge0; other problems can be solved in any terminal language.

---

## License

Private project (`private: true` in `package.json`). Adjust as needed if you open-source it.
