# Terminal - IDE

AI-powered code editor for Windows (Electron + React + TypeScript), designed to scale from MVP to a commercial developer product.

Inspired by Cursor and VS Code — modular architecture for multiple AI providers, agents, indexing, and plugins.

## Status

**Phases 1–8 shipped**

| Phase | Capability |
|-------|------------|
| 1 | Electron/React foundation, layout, stores, IPC |
| 2 | Monaco + workspace FS |
| 3 | Terminal (node-pty + xterm) |
| 4 | Git SCM |
| 5 | Multi-provider AI chat + credentials |
| 6 | Agent multi-file edits + Accept/Reject review |
| 7 | Ctrl+K inline edit + AI ghost autocomplete |
| 8 | Codebase index + lexical/semantic search |

Optional later: richer agent planning UI, remote vector DB, full LSP suite.

### Native modules

After `npm install`, rebuild `node-pty` for Electron if spawn fails:

```bash
npm run rebuild:native
```

## Requirements

- Node.js 20+
- Windows 10/11 (primary); macOS/Linux supported by architecture

## Setup

```bash
cd terminal-ide
npm install
```

## Development

```bash
# Full Electron + Vite dev
npm run dev

# Typecheck / lint / test / build
npm run typecheck
npm run lint
npm run test
npm run build
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite + Electron (via vite-plugin-electron) |
| `npm run typecheck` | TypeScript (renderer + electron) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run build` | Production renderer + electron compile |
| `npm run dist` | electron-builder package |

## Architecture

```
electron/main     — lifecycle, FS, IPC, future: terminal, git, AI, indexing
electron/preload  — contextBridge API only
src/              — React UI
packages/protocol — typed IPC contracts
packages/types    — shared domain types
packages/ai-core  — AIProvider / AITool interfaces
packages/indexing — index/search contracts
packages/shared   — path, language, cn helpers
```

Security defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

## License

MIT
