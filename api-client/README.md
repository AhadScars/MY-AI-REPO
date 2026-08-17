# API Client

Postman-style desktop HTTP client built with **Tauri v2**, **React**, **TypeScript**, **Vite**, **Tailwind CSS**, **Zustand**, and **shadcn-style** UI.

## Features

- Method selector: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`
- URL bar with Enter / **Ctrl+Enter** (⌘+Enter on macOS) to send
- Editable request **Headers** (enable / disable / add / remove)
- JSON **Body** editor for write methods
- **Send** button (white, high-contrast on dark theme)
- Response **status code**, **status text**, **response time**, and **size**
- Response body (pretty-printed JSON when valid) and response headers
- Dark theme with white primary actions and light text for visibility
- Requests go through Tauri’s HTTP plugin (no browser CORS limits)

## Prerequisites

### All platforms

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable)

### Windows

Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and WebView2 (usually preinstalled on Windows 10/11).

### Linux

Install system deps (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Setup

```bash
cd api-client
npm install
```

## Run

### Desktop (Tauri)

```bash
npm run tauri dev
```

### Frontend only (browser preview)

```bash
npm run dev
```

Open http://localhost:1420

Browser mode used to fail with **Failed to fetch** against Spring Boot because of **CORS** (Postman is not affected).  
`npm run dev` now routes requests through a Vite **`/__proxy`** middleware, so local APIs work without changing Spring CORS.

Still prefer the desktop app for production-like use:

```bash
npm run tauri:dev
```

If you prefer fixing CORS on the backend instead:

```java
@CrossOrigin(origins = "http://localhost:1420")
// or a global CorsConfigurationSource allowing that origin
```

## Build

```bash
npm run tauri build
```

Installers land under `src-tauri/target/release/bundle/`.

## Project layout

```
api-client/
├── src/
│   ├── components/     # UI + request/response panels
│   ├── lib/            # utils + HTTP client
│   ├── store/          # Zustand request state
│   ├── App.tsx
│   └── index.css       # Tailwind + dark theme
└── src-tauri/          # Rust / Tauri shell + HTTP plugin
```

## Stack

| Layer        | Choice                          |
|-------------|-------------------------------|
| Desktop     | Tauri v2                      |
| UI          | React 19 + TypeScript + Vite  |
| Styling     | Tailwind CSS v4               |
| State       | Zustand                       |
| Components  | shadcn-style (Button, Input…) |
| HTTP        | `@tauri-apps/plugin-http`     |
