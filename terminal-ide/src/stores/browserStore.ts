import { create } from 'zustand';
import { requireApi } from '../services/platform';
import { useLayoutStore } from './layoutStore';
import { useWorkspaceStore } from './workspaceStore';
import { basename, dirname } from '../../packages/shared/src/path';

export interface BrowserTab {
  id: string;
  title: string;
  /** Page currently shown */
  url: string;
  /** Source HTML file (if any) */
  filePath: string | null;
  rootPath: string | null;
  history: string[];
  historyIndex: number;
}

interface BrowserState {
  open: boolean;
  tabs: BrowserTab[];
  activeTabId: string | null;
  lastError: string | null;

  openHtmlFile: (filePath: string) => Promise<void>;
  openUrl: (url: string, title?: string) => void;
  closeTab: (id: string) => void;
  closeBrowser: () => void;
  setActiveTab: (id: string) => void;
  reloadActive: () => void;
  goBack: () => void;
  goForward: () => void;
  navigateActive: (url: string) => void;
  /** Called from iframe when location changes (best-effort) */
  noteNavigated: (id: string, url: string) => void;
}

let tabCounter = 0;

function isHtmlPath(p: string): boolean {
  return /\.html?$/i.test(p);
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  open: false,
  tabs: [],
  activeTabId: null,
  lastError: null,

  openHtmlFile: async (filePath) => {
    if (!isHtmlPath(filePath)) {
      set({ lastError: 'Only .html / .htm files can be previewed' });
      return;
    }
    try {
      const workspaceRoot = useWorkspaceStore.getState().rootPath;
      // Prefer workspace root so linked CSS/JS resolve correctly across folders
      const rootPath =
        workspaceRoot &&
        filePath.toLowerCase().replace(/\\/g, '/').startsWith(
          workspaceRoot.toLowerCase().replace(/\\/g, '/'),
        )
          ? workspaceRoot
          : dirname(filePath);

      const result = await requireApi().previewOpen({
        filePath,
        rootPath: rootPath ?? undefined,
      });

      // Reuse tab for same file
      const existing = get().tabs.find(
        (t) => t.filePath && t.filePath.toLowerCase() === filePath.toLowerCase(),
      );
      if (existing) {
        set({
          open: true,
          activeTabId: existing.id,
          lastError: null,
          tabs: get().tabs.map((t) =>
            t.id === existing.id
              ? {
                  ...t,
                  url: result.url,
                  title: result.title,
                  rootPath: result.root,
                  history: [...t.history.slice(0, t.historyIndex + 1), result.url],
                  historyIndex: t.historyIndex + 1,
                }
              : t,
          ),
        });
      } else {
        tabCounter += 1;
        const id = `browser-${tabCounter}`;
        const tab: BrowserTab = {
          id,
          title: result.title || basename(filePath),
          url: result.url,
          filePath,
          rootPath: result.root,
          history: [result.url],
          historyIndex: 0,
        };
        set({
          open: true,
          tabs: [...get().tabs, tab],
          activeTabId: id,
          lastError: null,
        });
      }

      // Give browser panel room in the center layout
      const layout = useLayoutStore.getState();
      if (layout.aiPanelVisible && layout.aiPanelWidth > 420) {
        // leave as-is
      }
    } catch (err) {
      // Still open the panel so the error banner is visible (not only system browser)
      set({
        open: true,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  openUrl: (url, title) => {
    let href = url.trim();
    if (!/^https?:\/\//i.test(href) && !href.startsWith('http://127.0.0.1')) {
      href = `https://${href}`;
    }
    tabCounter += 1;
    const id = `browser-${tabCounter}`;
    const tab: BrowserTab = {
      id,
      title: title || href,
      url: href,
      filePath: null,
      rootPath: null,
      history: [href],
      historyIndex: 0,
    };
    set({
      open: true,
      tabs: [...get().tabs, tab],
      activeTabId: id,
      lastError: null,
    });
  },

  closeTab: (id) => {
    const tabs = get().tabs.filter((t) => t.id !== id);
    let activeTabId = get().activeTabId;
    if (activeTabId === id) {
      activeTabId = tabs[tabs.length - 1]?.id ?? null;
    }
    set({
      tabs,
      activeTabId,
      open: tabs.length > 0,
    });
    if (tabs.length === 0) {
      void requireApi().previewStop().catch(() => undefined);
    }
  },

  closeBrowser: () => {
    set({ open: false, tabs: [], activeTabId: null });
    void requireApi().previewStop().catch(() => undefined);
  },

  setActiveTab: (id) => {
    if (!get().tabs.some((t) => t.id === id)) return;
    set({ activeTabId: id });
  },

  reloadActive: () => {
    const id = get().activeTabId;
    if (!id) return;
    // bump url with cache-buster for iframe remount
    set({
      tabs: get().tabs.map((t) => {
        if (t.id !== id) return t;
        const base = t.url.split('#')[0] ?? t.url;
        const sep = base.includes('?') ? '&' : '?';
        // keep clean url in history but force remount via key in UI using reloadToken
        return { ...t, url: base.includes('_r=') ? base.replace(/([?&])_r=\d+/, `$1_r=${Date.now()}`) : `${base}${sep}_r=${Date.now()}` };
      }),
    });
  },

  goBack: () => {
    const id = get().activeTabId;
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || tab.historyIndex <= 0) return;
    const historyIndex = tab.historyIndex - 1;
    set({
      tabs: get().tabs.map((t) =>
        t.id === id
          ? { ...t, historyIndex, url: t.history[historyIndex]! }
          : t,
      ),
    });
  },

  goForward: () => {
    const id = get().activeTabId;
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;
    const historyIndex = tab.historyIndex + 1;
    set({
      tabs: get().tabs.map((t) =>
        t.id === id
          ? { ...t, historyIndex, url: t.history[historyIndex]! }
          : t,
      ),
    });
  },

  navigateActive: (url) => {
    const id = get().activeTabId;
    if (!id) {
      get().openUrl(url);
      return;
    }
    let href = url.trim();
    if (!href) return;
    if (!/^https?:\/\//i.test(href) && !href.startsWith('http://127.0.0.1')) {
      href = `https://${href}`;
    }
    set({
      tabs: get().tabs.map((t) => {
        if (t.id !== id) return t;
        const history = [...t.history.slice(0, t.historyIndex + 1), href];
        return {
          ...t,
          url: href,
          title: href,
          history,
          historyIndex: history.length - 1,
        };
      }),
    });
  },

  noteNavigated: (id, url) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || tab.url === url) return;
    const history = [...tab.history.slice(0, tab.historyIndex + 1), url];
    set({
      tabs: get().tabs.map((t) =>
        t.id === id
          ? {
              ...t,
              url,
              history,
              historyIndex: history.length - 1,
            }
          : t,
      ),
    });
  },
}));
