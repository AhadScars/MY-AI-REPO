import { BrowserWindow, shell, Menu, app, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IpcChannels } from '../../packages/protocol/src/ipc-channels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CreateWindowOptions {
  preloadPath: string;
  isDev: boolean;
}

function resolveAppIcon(): string | undefined {
  // Packaged: process.resourcesPath (extraResources) + asar-unpacked paths
  // Dev: project resources/
  const candidates = [
    // NSIS install: resources/ next to app.asar
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'icon.png'),
    // Sometimes copied as app icon name
    path.join(process.resourcesPath, 'app.ico'),
    path.join(path.dirname(process.execPath), 'resources', 'icon.ico'),
    path.join(path.dirname(process.execPath), 'resources', 'icon.png'),
    path.join(app.getAppPath(), 'resources', 'icon.png'),
    path.join(app.getAppPath(), 'resources', 'icon.ico'),
    path.join(app.getAppPath(), '..', 'resources', 'icon.png'),
    path.join(__dirname, '../../../resources/icon.ico'),
    path.join(__dirname, '../../../resources/icon.png'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // continue
    }
  }
  return undefined;
}

export function createMainWindow(options: CreateWindowOptions): BrowserWindow {
  const icon = resolveAppIcon();
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f1115',
    title: 'Terminal - IDE',
    ...(icon ? { icon } : {}),
    // Single top chrome: custom title bar hosts panel toggles
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac
      ? {}
      : {
          titleBarOverlay: {
            color: '#14171c',
            symbolColor: '#e6e8eb',
            height: 36,
          },
        }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.on('maximize', () => {
    win.webContents.send(IpcChannels.EVENT_WINDOW_MAXIMIZED);
  });

  win.on('unmaximize', () => {
    win.webContents.send(IpcChannels.EVENT_WINDOW_UNMAXIMIZED);
  });

  // Flush editor session to disk before the window actually closes
  let allowClose = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const finishClose = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    allowClose = true;
    if (!win.isDestroyed()) win.close();
  };
  const onFlushed = () => finishClose();
  ipcMain.on(IpcChannels.APP_SESSION_FLUSHED, onFlushed);

  win.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    if (flushTimer) return; // already flushing
    win.webContents.send(IpcChannels.EVENT_PREPARE_QUIT);
    flushTimer = setTimeout(() => {
      // Safety: force close if renderer never replies
      finishClose();
    }, 2500);
  });

  win.on('closed', () => {
    ipcMain.removeListener(IpcChannels.APP_SESSION_FLUSHED, onFlushed);
    if (flushTimer) clearTimeout(flushTimer);
  });

  buildApplicationMenu(win);

  if (options.isDev) {
    void win.loadURL('http://localhost:5173');
  } else {
    void win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return win;
}

function buildApplicationMenu(win: BrowserWindow): void {
  const send = (action: string) => {
    win.webContents.send(IpcChannels.EVENT_MENU_ACTION, { action });
  };

  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Text File',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('file.newTextFile'),
        },
        {
          label: 'New File',
          click: () => send('file.newFile'),
        },
        { type: 'separator' },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('file.openFolder'),
        },
        {
          label: 'Open File…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('file.openFile'),
        },
        {
          label: 'Open New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => send('file.openNewWindow'),
        },
        { type: 'separator' },
        {
          label: 'Close Folder',
          click: () => send('file.closeFolder'),
        },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => send('file.closeWindow'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('file.save'),
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+K S',
          click: () => send('file.saveAll'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => send('edit.undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => send('edit.redo'),
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => send('edit.cut'),
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => send('edit.copy'),
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => send('edit.paste'),
        },
        { type: 'separator' },
        {
          label: 'Find in Files',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send('edit.findInFiles'),
        },
        {
          label: 'Replace in Files',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => send('edit.replaceInFiles'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette…',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => send('view.commandPalette'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => send('view.toggleSidebar'),
        },
        {
          label: 'Toggle Panel (Terminal)',
          accelerator: 'CmdOrCtrl+`',
          click: () => send('view.toggleTerminal'),
        },
        {
          label: 'Toggle Sephora',
          accelerator: 'CmdOrCtrl+L',
          click: () => send('view.toggleAiChat'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Run',
      submenu: [
        {
          label: 'Run File',
          accelerator: 'F5',
          click: () => send('run.program'),
        },
        {
          label: 'Rerun',
          accelerator: 'Ctrl+F5',
          click: () => send('run.rerun'),
        },
        {
          label: 'Stop',
          accelerator: 'Shift+F5',
          click: () => send('run.stop'),
        },
      ],
    },
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'New Terminal',
          accelerator: 'Ctrl+Shift+`',
          click: () => send('terminal.new'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Welcome',
          click: () => send('help.welcome'),
        },
        {
          label: 'Show All Commands',
          // Accelerator is registered on View → Command Palette (same action)
          click: () => send('help.showCommands'),
        },
        {
          label: 'About Terminal - IDE',
          click: () => send('help.about'),
        },
        { type: 'separator' },
        {
          label: 'Developer: Abdul Ahad',
          click: () => send('help.developer'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
