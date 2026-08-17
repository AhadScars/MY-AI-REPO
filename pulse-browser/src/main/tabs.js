const { BrowserView, session } = require('electron');
const path = require('path');

const CHROME_HEIGHT = 96; // tab strip + toolbar (+ bookmarks bar space reserved in layout)

function normalizeUrl(input, searchEngine) {
  if (!input || !String(input).trim()) return null;
  let raw = String(input).trim();

  // Internal pages
  if (raw.startsWith('pulse://') || raw.startsWith('about:')) return raw;
  if (raw === 'newtab' || raw === 'about:newtab') return 'pulse://newtab';
  if (raw === 'history' || raw === 'about:history') return 'pulse://history';
  if (raw === 'bookmarks' || raw === 'about:bookmarks') return 'pulse://bookmarks';
  if (raw === 'downloads' || raw === 'about:downloads') return 'pulse://downloads';
  if (raw === 'settings' || raw === 'about:settings') return 'pulse://settings';

  // Looks like a URL (has protocol, or domain-ish)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  // localhost / IP
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/i.test(raw)) {
    return `http://${raw}`;
  }

  // Domain-like: has a dot, no spaces
  const domainish = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+(:\d+)?(\/.*)?$/.test(raw)
    || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(raw);
  if (domainish && !/\s/.test(raw)) {
    return `https://${raw}`;
  }

  // Search query
  const engine = searchEngine || 'https://www.google.com/search?q=';
  return engine + encodeURIComponent(raw);
}

function isInternalUrl(url) {
  return typeof url === 'string' && (url.startsWith('pulse://') || url.startsWith('about:'));
}

function internalPageFile(url) {
  const map = {
    'pulse://newtab': 'newtab.html',
    'pulse://history': 'history.html',
    'pulse://bookmarks': 'bookmarks.html',
    'pulse://downloads': 'downloads.html',
    'pulse://settings': 'settings.html',
    'about:blank': 'newtab.html',
  };
  return map[url] || 'newtab.html';
}

class TabManager {
  constructor(win, store, onStateChange) {
    this.win = win;
    this.store = store;
    this.onStateChange = onStateChange;
    this.tabs = new Map(); // id -> tab
    this.order = []; // tab ids in display order
    this.activeTabId = null;
    this.nextId = 1;
    this.chromeHeight = CHROME_HEIGHT;
  }

  setChromeHeight(h) {
    this.chromeHeight = h;
    this.layoutActive();
  }

  createTab(url, { background = false, activate = true } = {}) {
    const id = `tab-${this.nextId++}`;
    const view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/view-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        partition: 'persist:pulse',
      },
    });

    // Allow popups / new windows as new tabs
    view.webContents.setWindowOpenHandler(({ url: openUrl }) => {
      this.createTab(openUrl, { activate: true });
      return { action: 'deny' };
    });

    const tab = {
      id,
      view,
      title: 'New Tab',
      url: '',
      favicon: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isInternal: false,
      error: null,
    };

    this._bindViewEvents(tab);
    this.tabs.set(id, tab);

    // Insert after the current tab (Chrome-style), not always at the end
    const activeIdx = this.order.indexOf(this.activeTabId);
    if (activeIdx >= 0) {
      this.order.splice(activeIdx + 1, 0, id);
    } else {
      this.order.push(id);
    }

    if (activate && !background) {
      this.activateTab(id);
    }

    this.navigate(id, url || this.store.settings.homePage || 'pulse://newtab');
    this.emitState();
    return id;
  }

  _bindViewEvents(tab) {
    const wc = tab.view.webContents;

    wc.on('page-title-updated', (_e, title) => {
      tab.title = title || 'Untitled';
      this.emitState();
    });

    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.favicon = (favicons && favicons[0]) || '';
      this.emitState();
    });

    wc.on('did-start-loading', () => {
      tab.isLoading = true;
      tab.error = null;
      this.emitState();
    });

    wc.on('did-stop-loading', () => {
      tab.isLoading = false;
      this._syncNav(tab);
      this.emitState();
    });

    wc.on('did-navigate', (_e, url) => {
      if (!isInternalUrl(url)) {
        tab.url = url;
        tab.isInternal = false;
      }
      this._syncNav(tab);
      this.store.addHistory({ title: tab.title, url: tab.url, favicon: tab.favicon });
      this.emitState();
    });

    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame && !isInternalUrl(url)) {
        tab.url = url;
        this._syncNav(tab);
        this.store.addHistory({ title: tab.title, url: tab.url, favicon: tab.favicon });
        this.emitState();
      }
    });

    wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return; // -3 = aborted
      tab.isLoading = false;
      tab.error = { code: errorCode, description: errorDescription, url: validatedURL };
      this.emitState();
    });

    wc.on('dom-ready', () => {
      this._syncNav(tab);
      this.emitState();
    });

    // Keyboard shortcuts inside page still bubble — handled at window level mostly
  }

  _syncNav(tab) {
    try {
      tab.canGoBack = tab.view.webContents.canGoBack();
      tab.canGoForward = tab.view.webContents.canGoForward();
      if (!tab.isInternal) {
        const u = tab.view.webContents.getURL();
        if (u && !u.startsWith('file://')) tab.url = u;
      }
      const t = tab.view.webContents.getTitle();
      if (t) tab.title = t;
    } catch (_) {
      /* view destroyed */
    }
  }

  activateTab(id) {
    if (!this.tabs.has(id)) return;
    const prev = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (prev) {
      try {
        this.win.removeBrowserView(prev.view);
      } catch (_) {}
    }
    this.activeTabId = id;
    const tab = this.tabs.get(id);
    this.win.addBrowserView(tab.view);
    this.layoutActive();
    try {
      tab.view.webContents.focus();
    } catch (_) {}
    this.emitState();
  }

  layoutActive() {
    if (!this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) return;
    const [width, height] = this.win.getContentSize();
    const top = this.chromeHeight;
    tab.view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
    tab.view.setAutoResize({ width: true, height: true });
  }

  closeTab(id) {
    if (!this.tabs.has(id)) return;
    if (this.order.length === 1) {
      // Closing last tab → open a new one, then close old
      this.createTab('pulse://newtab', { activate: true });
    }

    const tab = this.tabs.get(id);
    const idx = this.order.indexOf(id);

    if (this.activeTabId === id) {
      try {
        this.win.removeBrowserView(tab.view);
      } catch (_) {}
      const nextId = this.order[idx + 1] || this.order[idx - 1];
      this.activeTabId = null;
      if (nextId && nextId !== id) this.activateTab(nextId);
    }

    try {
      tab.view.webContents.destroy();
    } catch (_) {}
    this.tabs.delete(id);
    this.order = this.order.filter((t) => t !== id);

    // If we still have no active, activate first
    if (!this.activeTabId && this.order.length) {
      this.activateTab(this.order[0]);
    }

    this.emitState();
  }

  navigate(id, input) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    const url = normalizeUrl(input, this.store.settings.searchEngine);
    if (!url) return;

    if (isInternalUrl(url) || url === 'about:blank') {
      tab.isInternal = true;
      tab.url = url === 'about:blank' ? 'pulse://newtab' : url;
      tab.title =
        {
          'pulse://newtab': 'New Tab',
          'pulse://history': 'History',
          'pulse://bookmarks': 'Bookmarks',
          'pulse://downloads': 'Downloads',
          'pulse://settings': 'Settings',
        }[tab.url] || 'Pulse';
      tab.favicon = '';
      const file = internalPageFile(tab.url);
      const filePath = path.join(__dirname, '../renderer/pages', file);
      tab.view.webContents.loadFile(filePath, { query: { tabId: id } });
      this._syncNav(tab);
      this.emitState();
      return;
    }

    tab.isInternal = false;
    tab.url = url;
    tab.isLoading = true;
    tab.error = null;
    tab.view.webContents.loadURL(url).catch(() => {
      tab.isLoading = false;
      this.emitState();
    });
    this.emitState();
  }

  goBack(id) {
    const tab = this.tabs.get(id || this.activeTabId);
    if (tab && tab.view.webContents.canGoBack()) tab.view.webContents.goBack();
  }

  goForward(id) {
    const tab = this.tabs.get(id || this.activeTabId);
    if (tab && tab.view.webContents.canGoForward()) tab.view.webContents.goForward();
  }

  reload(id, ignoreCache = false) {
    const tab = this.tabs.get(id || this.activeTabId);
    if (!tab) return;
    if (tab.isInternal) {
      this.navigate(tab.id, tab.url);
      return;
    }
    if (ignoreCache) tab.view.webContents.reloadIgnoringCache();
    else tab.view.webContents.reload();
  }

  stop(id) {
    const tab = this.tabs.get(id || this.activeTabId);
    if (tab) tab.view.webContents.stop();
  }

  getActive() {
    return this.tabs.get(this.activeTabId) || null;
  }

  serializeTab(tab) {
    return {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favicon: tab.favicon,
      isLoading: tab.isLoading,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      isInternal: tab.isInternal,
      error: tab.error,
      isActive: tab.id === this.activeTabId,
    };
  }

  getState() {
    return {
      tabs: this.order.map((id) => this.serializeTab(this.tabs.get(id))).filter(Boolean),
      activeTabId: this.activeTabId,
      bookmarks: this.store.bookmarks,
      settings: this.store.settings,
    };
  }

  emitState() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }

  saveSession() {
    this.store.saveSession({
      tabs: this.order.map((id) => {
        const t = this.tabs.get(id);
        return t ? { url: t.url || 'pulse://newtab' } : null;
      }).filter(Boolean),
      activeTabId: this.activeTabId,
    });
  }

  restoreSession() {
    const sessionData = this.store.session;
    if (this.store.settings.restoreSession && sessionData.tabs && sessionData.tabs.length) {
      sessionData.tabs.forEach((t, i) => {
        this.createTab(t.url || 'pulse://newtab', {
          activate: i === 0,
          background: i !== 0,
        });
      });
      // Activate the last active if possible
      if (sessionData.activeTabId) {
        // activeTabId from previous session won't match — activate first
      }
      if (this.order.length) this.activateTab(this.order[0]);
    } else {
      this.createTab(this.store.settings.homePage || 'pulse://newtab');
    }
  }

  destroy() {
    for (const tab of this.tabs.values()) {
      try {
        tab.view.webContents.destroy();
      } catch (_) {}
    }
    this.tabs.clear();
    this.order = [];
  }
}

module.exports = { TabManager, normalizeUrl, isInternalUrl, CHROME_HEIGHT };
