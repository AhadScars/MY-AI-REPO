const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  shell,
  Menu,
  dialog,
  nativeTheme,
  screen,
} = require('electron');
const path = require('path');
const { Store } = require('./store');
const { TabManager, CHROME_HEIGHT } = require('./tabs');

// Disable hardware acceleration issues on some Linux/WSL setups if needed
// app.disableHardwareAcceleration();

let mainWindow = null;
let store = null;
let tabs = null;
let menuPopup = null;

const isDev = process.argv.includes('--enable-logging');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#1a1b1e',
    title: 'Pulse Browser',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/chrome-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/chrome.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('resize', () => {
    if (tabs) tabs.layoutActive();
  });

  mainWindow.on('close', () => {
    if (tabs) tabs.saveSession();
  });

  mainWindow.on('closed', () => {
    if (tabs) {
      tabs.destroy();
      tabs = null;
    }
    mainWindow = null;
  });

  // Keyboard shortcuts at window level
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!tabs) return;
    const ctrl = input.control || input.meta;
    if (input.type !== 'keyDown') return;

    if (ctrl && input.key.toLowerCase() === 't') {
      event.preventDefault();
      tabs.createTab('pulse://newtab');
    } else if (ctrl && input.key.toLowerCase() === 'w') {
      event.preventDefault();
      if (tabs.activeTabId) tabs.closeTab(tabs.activeTabId);
    } else if (ctrl && input.key.toLowerCase() === 'r') {
      event.preventDefault();
      tabs.reload(null, input.shift);
    } else if (ctrl && input.key.toLowerCase() === 'l') {
      event.preventDefault();
      sendToChrome('focus-omnibox');
    } else if (ctrl && input.key === 'Tab') {
      event.preventDefault();
      cycleTab(input.shift ? -1 : 1);
    } else if (input.alt && input.key === 'ArrowLeft') {
      event.preventDefault();
      tabs.goBack();
    } else if (input.alt && input.key === 'ArrowRight') {
      event.preventDefault();
      tabs.goForward();
    } else if (ctrl && input.key.toLowerCase() === 'd') {
      event.preventDefault();
      toggleBookmarkActive();
    } else if (ctrl && input.key.toLowerCase() === 'h') {
      event.preventDefault();
      tabs.createTab('pulse://history');
    } else if (ctrl && input.key.toLowerCase() === 'j') {
      event.preventDefault();
      tabs.createTab('pulse://downloads');
    } else if (ctrl && input.key === '+') {
      event.preventDefault();
      zoomActive(0.1);
    } else if (ctrl && input.key === '-') {
      event.preventDefault();
      zoomActive(-0.1);
    } else if (ctrl && input.key === '0') {
      event.preventDefault();
      const t = tabs.getActive();
      if (t) t.view.webContents.setZoomFactor(1);
    } else if (input.key === 'F12') {
      event.preventDefault();
      const t = tabs.getActive();
      if (t) t.view.webContents.toggleDevTools();
    } else if (ctrl && (input.key === '=' || input.key === '+')) {
      event.preventDefault();
      zoomActive(0.1);
    }
  });

  tabs = new TabManager(mainWindow, store, (state) => {
    sendToChrome('browser-state', state);
  });

  // Wait for chrome UI to be ready before restoring tabs
  mainWindow.webContents.once('did-finish-load', () => {
    tabs.restoreSession();
    sendToChrome('browser-state', tabs.getState());
  });

  // No native File / Edit / View bar — hamburger menu only
  Menu.setApplicationMenu(null);
}

function sendToChrome(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function cycleTab(dir) {
  if (!tabs || !tabs.order.length) return;
  const idx = tabs.order.indexOf(tabs.activeTabId);
  const next = (idx + dir + tabs.order.length) % tabs.order.length;
  tabs.activateTab(tabs.order[next]);
}

function toggleBookmarkActive() {
  if (!tabs) return;
  const t = tabs.getActive();
  if (!t || !t.url || t.isInternal) return;
  if (store.isBookmarked(t.url)) {
    store.removeBookmark(t.url);
  } else {
    store.addBookmark({ title: t.title, url: t.url, favicon: t.favicon });
  }
  tabs.emitState();
  sendToChrome('toast', {
    message: store.isBookmarked(t.url) ? 'Bookmark added' : 'Bookmark removed',
  });
}

function zoomActive(delta) {
  const t = tabs.getActive();
  if (!t) return;
  const current = t.view.webContents.getZoomFactor();
  t.view.webContents.setZoomFactor(Math.min(3, Math.max(0.5, current + delta)));
}

function closeAppMenu() {
  if (menuPopup && !menuPopup.isDestroyed()) {
    menuPopup.close();
  }
  menuPopup = null;
}

/** Frameless popup that covers the page (does not push BrowserView down). */
function showAppMenu(anchor) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  closeAppMenu();

  const menuW = 268;
  const menuH = 352;
  const content = mainWindow.getContentBounds();
  // anchor is relative to the chrome webContents (window content origin)
  let x = content.x + Math.round(anchor.x + (anchor.width || 0) - menuW);
  let y = content.y + Math.round(anchor.y + (anchor.height || 0) + 4);

  // Keep on screen
  const display = screen.getDisplayMatching(content);
  const area = display.workArea;
  if (x + menuW > area.x + area.width) x = area.x + area.width - menuW - 8;
  if (x < area.x) x = area.x + 8;
  if (y + menuH > area.y + area.height) y = content.y + Math.round(anchor.y) - menuH - 4;
  if (y < area.y) y = area.y + 8;

  menuPopup = new BrowserWindow({
    parent: mainWindow,
    modal: false,
    frame: false,
    width: menuW,
    height: menuH,
    x,
    y,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    transparent: false,
    backgroundColor: '#2d2e31',
    hasShadow: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/menu-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  menuPopup.setMenu(null);
  menuPopup.loadFile(path.join(__dirname, '../renderer/app-menu.html'));

  menuPopup.once('ready-to-show', () => {
    if (menuPopup && !menuPopup.isDestroyed()) menuPopup.show();
  });

  menuPopup.on('blur', () => {
    closeAppMenu();
  });

  menuPopup.on('closed', () => {
    menuPopup = null;
  });
}

function handleMenuAction(action) {
  if (action === '__close__') {
    closeAppMenu();
    return;
  }
  closeAppMenu();
  switch (action) {
    case 'new-tab':
      tabs && tabs.createTab('pulse://newtab');
      break;
    case 'history':
      tabs && tabs.createTab('pulse://history');
      break;
    case 'bookmarks':
      tabs && tabs.createTab('pulse://bookmarks');
      break;
    case 'downloads':
      tabs && tabs.createTab('pulse://downloads');
      break;
    case 'settings':
      tabs && tabs.createTab('pulse://settings');
      break;
    case 'bookmark':
      toggleBookmarkActive();
      break;
    case 'devtools': {
      const t = tabs && tabs.getActive();
      if (t) t.view.webContents.toggleDevTools();
      break;
    }
    case 'zoom-in':
      zoomActive(0.1);
      break;
    case 'zoom-out':
      zoomActive(-0.1);
      break;
    case 'zoom-reset': {
      const t = tabs && tabs.getActive();
      if (t) t.view.webContents.setZoomFactor(1);
      break;
    }
    case 'about':
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Pulse Browser',
        message: 'Pulse Browser 1.0',
        detail:
          'A full-featured desktop browser with tabs, history, bookmarks, downloads, and Chromium rendering.\n\nShortcuts:\nCtrl+T New tab · Ctrl+W Close tab · Ctrl+L Address bar\nCtrl+R Reload · Alt+←/→ Back/Forward · Ctrl+D Bookmark',
      });
      break;
    case 'quit':
      app.quit();
      break;
    default:
      break;
  }
}

function setupDownloads() {
  session.fromPartition('persist:pulse').on('will-download', (_event, item) => {
    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      savePath: '',
      startedAt: Date.now(),
      endedAt: null,
    };
    store.addDownload(entry);
    sendToChrome('download-updated', entry);
    sendToChrome('toast', { message: `Downloading ${entry.filename}` });

    item.on('updated', (_e, state) => {
      entry.receivedBytes = item.getReceivedBytes();
      entry.totalBytes = item.getTotalBytes();
      entry.state = state;
      entry.savePath = item.getSavePath();
      store.updateDownload(id, entry);
      sendToChrome('download-updated', entry);
    });

    item.once('done', (_e, state) => {
      entry.state = state;
      entry.receivedBytes = item.getReceivedBytes();
      entry.savePath = item.getSavePath();
      entry.endedAt = Date.now();
      store.updateDownload(id, entry);
      sendToChrome('download-updated', entry);
      sendToChrome('toast', {
        message:
          state === 'completed'
            ? `Downloaded ${entry.filename}`
            : `Download ${state}: ${entry.filename}`,
      });
    });
  });
}

function registerIpc() {
  ipcMain.handle('get-state', () => (tabs ? tabs.getState() : null));

  ipcMain.handle('chrome-height', (_e, height) => {
    if (tabs && typeof height === 'number') {
      tabs.setChromeHeight(height);
    }
  });

  ipcMain.handle('create-tab', (_e, url) => {
    if (!tabs) return null;
    return tabs.createTab(url || 'pulse://newtab');
  });

  ipcMain.handle('close-tab', (_e, id) => {
    if (tabs) tabs.closeTab(id);
  });

  ipcMain.handle('activate-tab', (_e, id) => {
    if (tabs) tabs.activateTab(id);
  });

  ipcMain.handle('navigate', (_e, { tabId, url }) => {
    if (tabs) tabs.navigate(tabId || tabs.activeTabId, url);
  });

  ipcMain.handle('go-back', (_e, tabId) => {
    if (tabs) tabs.goBack(tabId);
  });

  ipcMain.handle('go-forward', (_e, tabId) => {
    if (tabs) tabs.goForward(tabId);
  });

  ipcMain.handle('reload', (_e, { tabId, ignoreCache } = {}) => {
    if (tabs) tabs.reload(tabId, ignoreCache);
  });

  ipcMain.handle('stop', (_e, tabId) => {
    if (tabs) tabs.stop(tabId);
  });

  ipcMain.handle('get-history', (_e, { query, limit } = {}) => {
    return store.searchHistory(query, limit || 100);
  });

  ipcMain.handle('clear-history', () => {
    store.clearHistory();
    return true;
  });

  ipcMain.handle('get-bookmarks', () => store.bookmarks);

  ipcMain.handle('add-bookmark', (_e, entry) => {
    const bm = store.addBookmark(entry);
    tabs && tabs.emitState();
    return bm;
  });

  ipcMain.handle('remove-bookmark', (_e, idOrUrl) => {
    store.removeBookmark(idOrUrl);
    tabs && tabs.emitState();
    return true;
  });

  ipcMain.handle('toggle-bookmark', (_e, entry) => {
    if (store.isBookmarked(entry.url)) {
      store.removeBookmark(entry.url);
      tabs && tabs.emitState();
      return { bookmarked: false };
    }
    store.addBookmark(entry);
    tabs && tabs.emitState();
    return { bookmarked: true };
  });

  ipcMain.handle('is-bookmarked', (_e, url) => store.isBookmarked(url));

  ipcMain.handle('get-downloads', () => store.downloads);

  ipcMain.handle('clear-downloads', () => {
    store.clearDownloads();
    return true;
  });

  ipcMain.handle('open-download', async (_e, filePath) => {
    if (filePath) await shell.showItemInFolder(filePath);
  });

  ipcMain.handle('get-settings', () => store.settings);

  ipcMain.handle('update-settings', (_e, patch) => {
    store.updateSettings(patch);
    tabs && tabs.emitState();
    return store.settings;
  });

  ipcMain.handle('open-external', (_e, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('suggest', (_e, query) => {
    const q = (query || '').trim();
    if (!q) {
      return {
        history: store.history.slice(0, 8),
        bookmarks: store.bookmarks.slice(0, 4),
      };
    }
    return {
      history: store.searchHistory(q, 8),
      bookmarks: store.bookmarks
        .filter(
          (b) =>
            b.title.toLowerCase().includes(q.toLowerCase()) ||
            b.url.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 4),
    };
  });

  ipcMain.handle('show-app-menu', (_e, anchor) => {
    showAppMenu(anchor || { x: 0, y: 0, width: 32, height: 32 });
  });

  ipcMain.handle('hide-app-menu', () => {
    closeAppMenu();
  });

  ipcMain.on('menu-action', (_e, action) => {
    handleMenuAction(action);
  });

  // From internal pages (via view preload)
  ipcMain.on('internal-navigate', (_e, url) => {
    if (tabs && tabs.activeTabId) tabs.navigate(tabs.activeTabId, url);
  });

  ipcMain.on('internal-open-tab', (_e, url) => {
    if (tabs) tabs.createTab(url);
  });
}

app.whenReady().then(() => {
  store = new Store();
  nativeTheme.themeSource = 'dark';
  registerIpc();
  setupDownloads();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (tabs) tabs.saveSession();
});
