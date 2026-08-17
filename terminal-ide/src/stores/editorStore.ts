import { create } from 'zustand';
import type { EditorTab } from '../../packages/types/src/editor';
import { basename, normalizePath } from '../../packages/shared/src/path';
import { languageFromPath } from '../../packages/shared/src/language';
import { requireApi } from '../services/platform';

function createTabId(path: string): string {
  return `tab:${normalizePath(path)}`;
}

/** Case-insensitive on Windows-style paths so tabs match across separators. */
export function pathsEqual(a: string, b: string): boolean {
  const na = normalizePath(a);
  const nb = normalizePath(b);
  if (na === nb) return true;
  return na.toLowerCase() === nb.toLowerCase();
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  lastError: string | null;

  openFile: (path: string, preview?: boolean) => Promise<void>;
  openUntitled: (content?: string, language?: string) => void;
  closeTab: (tabId: string) => Promise<void>;
  closeActiveTab: () => Promise<void>;
  closeOtherTabs: (tabId: string) => Promise<void>;
  closeAllTabs: () => Promise<void>;
  setActiveTab: (tabId: string) => void;
  activateNextTab: () => void;
  activatePrevTab: () => void;
  promotePreview: (tabId: string) => void;
  updateContent: (tabId: string, content: string) => void;
  markSaved: (tabId: string, content: string, path?: string) => void;
  saveActive: () => Promise<boolean>;
  saveAll: () => Promise<void>;
  saveAs: (tabId?: string) => Promise<boolean>;
  confirmCloseIfDirty: (tab: EditorTab) => Promise<'save' | 'discard' | 'cancel'>;
  getActiveTab: () => EditorTab | null;
  findTabByPath: (path: string) => EditorTab | undefined;
  closeTabsForPath: (path: string) => void;
  renameTabPath: (oldPath: string, newPath: string) => void;
  /** Persist open file tabs (not untitled) + active path. */
  persistSession: () => Promise<void>;
  /** Flush any pending session write immediately (call before quit). */
  flushSession: () => Promise<void>;
  /** Re-open saved tabs after workspace restore. */
  restoreSession: () => Promise<void>;
}

let untitledCounter = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistInFlight: Promise<void> | null = null;

function schedulePersistSession(get: () => EditorState, immediate = true): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  // Default immediate so open tabs survive a quick quit; debounce only when asked
  if (immediate) {
    void get().persistSession();
    return;
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void get().persistSession();
  }, 200);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  lastError: null,

  findTabByPath: (path) => get().tabs.find((t) => pathsEqual(t.path, path)),

  openFile: async (filePath, preview = false) => {
    // Switch to existing tab if already open (each file = one tab)
    const existing = get().findTabByPath(filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      if (!preview && existing.isPreview) {
        get().promotePreview(existing.id);
      }
      schedulePersistSession(get);
      return;
    }

    try {
      const api = requireApi();
      const result = await api.readFile({ path: filePath });
      // Open as a permanent tab by default so multi-file work keeps separate tabs.
      // Preview mode only replaces an existing preview tab when explicitly requested.
      const permanent = !preview;
      const tab: EditorTab = {
        id: createTabId(filePath),
        path: filePath,
        name: basename(filePath),
        language: languageFromPath(filePath),
        content: result.content,
        originalContent: result.content,
        isDirty: false,
        isPreview: !permanent,
      };

      let tabs = get().tabs;
      if (!permanent) {
        const previewIdx = tabs.findIndex((t) => t.isPreview);
        if (previewIdx >= 0) {
          tabs = [...tabs];
          tabs[previewIdx] = tab;
          set({ tabs, activeTabId: tab.id, lastError: null });
          schedulePersistSession(get);
          return;
        }
      }

      set({ tabs: [...tabs, tab], activeTabId: tab.id, lastError: null });
      schedulePersistSession(get);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open file';
      set({ lastError: message });
      console.error('Failed to open file:', err);
    }
  },

  openUntitled: (content = '', language = 'plaintext') => {
    untitledCounter += 1;
    const name = `Untitled-${untitledCounter}`;
    const path = `untitled:${untitledCounter}`;
    const tab: EditorTab = {
      id: createTabId(path),
      path,
      name,
      language,
      content,
      originalContent: '',
      isDirty: content.length > 0,
      isPreview: false,
    };
    set({ tabs: [...get().tabs, tab], activeTabId: tab.id });
  },

  confirmCloseIfDirty: async (tab) => {
    if (!tab.isDirty) return 'discard';
    const api = requireApi();
    const result = await api.showMessage({
      type: 'warning',
      title: 'Unsaved Changes',
      message: `Do you want to save changes to ${tab.name}?`,
      detail: tab.path,
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    });
    if (result.response === 0) return 'save';
    if (result.response === 1) return 'discard';
    return 'cancel';
  },

  closeTab: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.isDirty) {
      const decision = await get().confirmCloseIfDirty(tab);
      if (decision === 'cancel') return;
      if (decision === 'save') {
        const ok = tab.path.startsWith('untitled:')
          ? await get().saveAs(tabId)
          : await (async () => {
              try {
                const api = requireApi();
                await api.writeFile({ path: tab.path, content: tab.content });
                get().markSaved(tab.id, tab.content);
                return true;
              } catch {
                return false;
              }
            })();
        if (!ok) return;
      }
    }

    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const next = tabs.filter((t) => t.id !== tabId);
    let nextActive = activeTabId;
    if (activeTabId === tabId) {
      const neighbor = next[idx] ?? next[idx - 1] ?? null;
      nextActive = neighbor?.id ?? null;
    }
    set({ tabs: next, activeTabId: nextActive });
    // Immediate when last tab closed so empty session is saved before quit
    schedulePersistSession(get, next.length === 0);
  },

  closeActiveTab: async () => {
    const id = get().activeTabId;
    if (id) await get().closeTab(id);
  },

  closeOtherTabs: async (tabId) => {
    const others = get().tabs.filter((t) => t.id !== tabId);
    for (const t of others) {
      await get().closeTab(t.id);
    }
    if (get().tabs.some((t) => t.id === tabId)) {
      set({ activeTabId: tabId });
    }
    schedulePersistSession(get, true);
  },

  closeAllTabs: async () => {
    const ids = get().tabs.map((t) => t.id);
    for (const id of ids) {
      await get().closeTab(id);
    }
    // Empty tab list → next launch shows welcome; folder stays on Recent
    await get().flushSession();
  },

  setActiveTab: (tabId) => {
    if (!get().tabs.some((t) => t.id === tabId)) return;
    set({ activeTabId: tabId });
    schedulePersistSession(get, true);
  },

  activateNextTab: () => {
    const { tabs, activeTabId } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = tabs[(idx + 1) % tabs.length];
    if (next) {
      set({ activeTabId: next.id });
      schedulePersistSession(get);
    }
  },

  activatePrevTab: () => {
    const { tabs, activeTabId } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    if (prev) {
      set({ activeTabId: prev.id });
      schedulePersistSession(get);
    }
  },

  promotePreview: (tabId) => {
    set({
      tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, isPreview: false } : t)),
    });
  },

  updateContent: (tabId, content) => {
    set({
      tabs: get().tabs.map((t) =>
        t.id === tabId
          ? { ...t, content, isDirty: content !== t.originalContent, isPreview: false }
          : t,
      ),
    });
  },

  markSaved: (tabId, content, newPath) => {
    set({
      tabs: get().tabs.map((t) => {
        if (t.id !== tabId) return t;
        if (newPath) {
          return {
            ...t,
            id: createTabId(newPath),
            path: newPath,
            name: basename(newPath),
            language: languageFromPath(newPath),
            content,
            originalContent: content,
            isDirty: false,
            isPreview: false,
          };
        }
        return { ...t, content, originalContent: content, isDirty: false };
      }),
      activeTabId:
        newPath && get().activeTabId === tabId ? createTabId(newPath) : get().activeTabId,
    });
  },

  saveActive: async () => {
    const tab = get().getActiveTab();
    if (!tab) return false;

    if (tab.path.startsWith('untitled:')) {
      return get().saveAs(tab.id);
    }

    try {
      const api = requireApi();
      await api.writeFile({ path: tab.path, content: tab.content });
      get().markSaved(tab.id, tab.content);
      set({ lastError: null });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      set({ lastError: message });
      console.error('Save failed:', err);
      return false;
    }
  },

  saveAs: async (tabId) => {
    const tab = tabId
      ? get().tabs.find((t) => t.id === tabId)
      : get().getActiveTab();
    if (!tab) return false;

    try {
      const api = requireApi();
      const result = await api.saveFile({
        defaultPath: tab.path.startsWith('untitled:') ? tab.name : tab.path,
      });
      if (result.canceled || !result.path) return false;

      await api.writeFile({ path: result.path, content: tab.content });
      get().markSaved(tab.id, tab.content, result.path);
      set({ lastError: null });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save As failed';
      set({ lastError: message });
      console.error('Save As failed:', err);
      return false;
    }
  },

  saveAll: async () => {
    const dirty = get().tabs.filter((t) => t.isDirty);
    for (const tab of dirty) {
      if (tab.path.startsWith('untitled:')) {
        await get().saveAs(tab.id);
      } else {
        try {
          const api = requireApi();
          await api.writeFile({ path: tab.path, content: tab.content });
          get().markSaved(tab.id, tab.content);
        } catch (err) {
          console.error('Save failed for', tab.path, err);
        }
      }
    }
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) ?? null;
  },

  closeTabsForPath: (path) => {
    const { tabs, activeTabId } = get();
    const p = normalizePath(path);
    const filtered = tabs.filter((t) => {
      const n = normalizePath(t.path);
      if (pathsEqual(n, p)) return false;
      const nl = n.toLowerCase();
      const pl = p.toLowerCase();
      return !(nl.startsWith(pl + '/') || nl.startsWith(pl + '\\'));
    });
    let nextActive = activeTabId;
    if (activeTabId && !filtered.some((t) => t.id === activeTabId)) {
      nextActive = filtered[filtered.length - 1]?.id ?? null;
    }
    set({ tabs: filtered, activeTabId: nextActive });
    schedulePersistSession(get);
  },

  renameTabPath: (oldPath, newPath) => {
    const oldId = createTabId(oldPath);
    const wasActive = get().activeTabId === oldId || pathsEqual(get().getActiveTab()?.path ?? '', oldPath);
    set({
      tabs: get().tabs.map((t) => {
        if (!pathsEqual(t.path, oldPath)) return t;
        return {
          ...t,
          id: createTabId(newPath),
          path: newPath,
          name: basename(newPath),
          language: languageFromPath(newPath),
        };
      }),
      activeTabId: wasActive ? createTabId(newPath) : get().activeTabId,
    });
    schedulePersistSession(get);
  },

  persistSession: async () => {
    try {
      const { tabs, activeTabId } = get();
      // Real files only; empty list = welcome next launch (folder still on Recent)
      const openPaths = tabs
        .filter((t) => !t.path.startsWith('untitled:') && !t.isPreview)
        .map((t) => t.path);
      const active = tabs.find((t) => t.id === activeTabId);
      const activePath =
        active && !active.path.startsWith('untitled:') && !active.isPreview
          ? active.path
          : (openPaths[openPaths.length - 1] ?? null);
      const api = requireApi();
      const value = { openPaths, activePath };
      const write = api.setSetting({ key: 'session', value });
      persistInFlight = write.then(
        () => undefined,
        () => undefined,
      );
      await persistInFlight;
      persistInFlight = null;
    } catch {
      persistInFlight = null;
      // settings may be unavailable outside Electron
    }
  },

  flushSession: async () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    await get().persistSession();
    if (persistInFlight) await persistInFlight;
  },

  restoreSession: async () => {
    try {
      const api = requireApi();
      // Prefer full settings snapshot, then single key, then legacy
      let session: { openPaths?: string[]; activePath?: string | null } | undefined;
      try {
        const all = (await api.getAllSettings()) as {
          session?: { openPaths?: string[]; activePath?: string | null };
          editor?: { session?: { openPaths?: string[]; activePath?: string | null } };
        };
        if (all?.session && Array.isArray(all.session.openPaths)) {
          session = all.session;
        } else if (all?.editor?.session && Array.isArray(all.editor.session.openPaths)) {
          session = all.editor.session;
        }
      } catch {
        // fall through
      }
      if (!session) {
        session = await api.getSetting({ key: 'session' });
      }
      // Only use legacy when top-level session is missing entirely (not when empty on purpose)
      if (session == null || session.openPaths === undefined) {
        session = await api.getSetting({ key: 'editor.session' });
      }

      const paths = Array.isArray(session?.openPaths) ? session!.openPaths! : [];
      if (paths.length === 0) return;

      for (const p of paths) {
        if (typeof p !== 'string' || !p) continue;
        try {
          const exists = await api.exists({ path: p });
          if (!exists) continue;
          await get().openFile(p, false);
        } catch {
          // skip missing files
        }
      }

      const activePath = session?.activePath;
      if (activePath && typeof activePath === 'string') {
        const tab = get().findTabByPath(activePath);
        if (tab) set({ activeTabId: tab.id });
      }
    } catch (err) {
      console.error('Failed to restore editor session:', err);
    }
  },
}));
