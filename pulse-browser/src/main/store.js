const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getDataPath() {
  const dir = path.join(app.getPath('userData'), 'pulse-data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(filename, fallback) {
  const file = path.join(getDataPath(), filename);
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (_) {
    /* corrupt file — use fallback */
  }
  return fallback;
}

function writeJson(filename, data) {
  const file = path.join(getDataPath(), filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const DEFAULT_BOOKMARKS = [
  { id: 'bm-1', title: 'Google', url: 'https://www.google.com', favicon: '', createdAt: Date.now() },
  { id: 'bm-2', title: 'YouTube', url: 'https://www.youtube.com', favicon: '', createdAt: Date.now() },
  { id: 'bm-3', title: 'GitHub', url: 'https://github.com', favicon: '', createdAt: Date.now() },
  { id: 'bm-4', title: 'Wikipedia', url: 'https://www.wikipedia.org', favicon: '', createdAt: Date.now() },
];

const DEFAULT_SETTINGS = {
  homePage: 'pulse://newtab',
  searchEngine: 'https://www.google.com/search?q=',
  showBookmarksBar: true,
  restoreSession: true,
};

class Store {
  constructor() {
    this.history = readJson('history.json', []);
    this.bookmarks = readJson('bookmarks.json', DEFAULT_BOOKMARKS);
    this.downloads = readJson('downloads.json', []);
    this.settings = { ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) };
    this.session = readJson('session.json', { tabs: [], activeTabId: null });
  }

  saveHistory() {
    // Keep last 2000 entries
    if (this.history.length > 2000) {
      this.history = this.history.slice(0, 2000);
    }
    writeJson('history.json', this.history);
  }

  addHistory(entry) {
    const url = entry.url || '';
    if (!url || url.startsWith('pulse://') || url.startsWith('about:')) return;
    // Dedupe consecutive same-URL hits within 5s
    const top = this.history[0];
    if (top && top.url === url && Date.now() - top.visitedAt < 5000) {
      top.title = entry.title || top.title;
      top.visitedAt = Date.now();
      this.saveHistory();
      return;
    }
    this.history.unshift({
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: entry.title || url,
      url,
      favicon: entry.favicon || '',
      visitedAt: Date.now(),
    });
    this.saveHistory();
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  searchHistory(query, limit = 20) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return this.history.slice(0, limit);
    return this.history
      .filter((h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q))
      .slice(0, limit);
  }

  saveBookmarks() {
    writeJson('bookmarks.json', this.bookmarks);
  }

  addBookmark(entry) {
    const existing = this.bookmarks.find((b) => b.url === entry.url);
    if (existing) return existing;
    const bm = {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: entry.title || entry.url,
      url: entry.url,
      favicon: entry.favicon || '',
      createdAt: Date.now(),
    };
    this.bookmarks.unshift(bm);
    this.saveBookmarks();
    return bm;
  }

  removeBookmark(idOrUrl) {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== idOrUrl && b.url !== idOrUrl);
    this.saveBookmarks();
  }

  isBookmarked(url) {
    return this.bookmarks.some((b) => b.url === url);
  }

  saveDownloads() {
    if (this.downloads.length > 500) this.downloads = this.downloads.slice(0, 500);
    writeJson('downloads.json', this.downloads);
  }

  addDownload(entry) {
    this.downloads.unshift(entry);
    this.saveDownloads();
  }

  updateDownload(id, patch) {
    const d = this.downloads.find((x) => x.id === id);
    if (d) Object.assign(d, patch);
    this.saveDownloads();
  }

  clearDownloads() {
    this.downloads = [];
    this.saveDownloads();
  }

  saveSettings() {
    writeJson('settings.json', this.settings);
  }

  updateSettings(patch) {
    Object.assign(this.settings, patch);
    this.saveSettings();
  }

  saveSession(session) {
    this.session = session;
    writeJson('session.json', session);
  }
}

module.exports = { Store };
