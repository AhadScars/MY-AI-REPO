import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMainWindow } from './window.js';
import { registerIpcHandlers } from './ipc/index.js';
import { SettingsStore } from './security/settings-store.js';
import { TerminalManager } from './terminal/terminal-manager.js';
import type { ChatOrchestrator } from './ai/chat-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePreloadPath(): string {
  const candidates = [
    path.join(__dirname, '../preload/preload.mjs'),
    path.join(__dirname, '../preload/preload.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
const settingsStore = new SettingsStore();
const terminalManager = new TerminalManager(() => mainWindow);
let chatOrchestrator: ChatOrchestrator | null = null;
let lastWorkspaceRoot: string | undefined;

function openAppWindow(): BrowserWindow {
  const win = createMainWindow({
    preloadPath: resolvePreloadPath(),
    isDev: !app.isPackaged,
  });
  if (!mainWindow) mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) {
      const remaining = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
      mainWindow = remaining[0] ?? null;
    }
  });
  return win;
}

app.whenReady().then(async () => {
  await settingsStore.init();
  const { ai } = await registerIpcHandlers({
    settingsStore,
    getMainWindow: () => mainWindow,
    terminalManager,
    getWorkspaceRoot: () => lastWorkspaceRoot,
    createWindow: openAppWindow,
  });
  chatOrchestrator = ai?.orchestrator ?? null;

  openAppWindow();
});

app.on('second-instance', () => {
  // Focus an existing window (single-instance app)
  const win = mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('window-all-closed', () => {
  terminalManager.disposeAll();
  chatOrchestrator?.stopAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  terminalManager.disposeAll();
  chatOrchestrator?.stopAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    openAppWindow();
  }
});
