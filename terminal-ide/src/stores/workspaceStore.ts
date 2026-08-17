import { create } from 'zustand';
import type { TreeNode, WorkspaceFolder } from '../../packages/types/src/workspace';
import { requireApi } from '../services/platform';
import { basename, dirname, joinPath } from '../../packages/shared/src/path';
import { isTextFile } from '../../packages/shared/src/language';
import { useGitStore } from './gitStore';
import { useIndexingStore } from './indexingStore';

const IGNORE_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  '.tmp',
  'release',
  '.next',
  '.nuxt',
  '__pycache__',
  'venv',
  '.venv',
  'target',
  'dist-electron',
]);

interface WorkspaceState {
  rootPath: string | null;
  name: string | null;
  folders: WorkspaceFolder[];
  tree: TreeNode[];
  recentPaths: string[];
  isLoading: boolean;
  error: string | null;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  /** Flat file index for Quick Open */
  fileIndex: string[];
  fileIndexLoading: boolean;

  openFolder: (path?: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadChildren: (nodePath: string) => Promise<TreeNode[]>;
  toggleExpand: (nodePath: string) => Promise<void>;
  ensureExpanded: (nodePath: string) => Promise<void>;
  /** Collapse every expanded folder in the explorer tree (keeps workspace open). */
  collapseAll: () => void;
  closeWorkspace: () => void;
  setError: (error: string | null) => void;
  setSelectedPath: (path: string | null) => void;

  createFile: (parentDir: string, name: string) => Promise<string | null>;
  createFolder: (parentDir: string, name: string) => Promise<string | null>;
  renameEntry: (oldPath: string, newName: string) => Promise<string | null>;
  deleteEntry: (path: string) => Promise<boolean>;

  buildFileIndex: () => Promise<void>;
  searchFiles: (query: string, limit?: number) => string[];
  /** Load recent folders from settings (for welcome page). */
  loadRecent: () => Promise<void>;
  removeRecent: (path: string) => Promise<void>;
  /** Persist expanded folders + selection for the file/folder panel. */
  persistExplorer: () => Promise<void>;
  /** Flush explorer UI state immediately (call before quit). */
  flushExplorer: () => Promise<void>;
  /** Restore expanded folders + selection after openFolder. */
  restoreExplorer: () => Promise<void>;
}

let explorerPersistTimer: ReturnType<typeof setTimeout> | null = null;
let explorerPersistInFlight: Promise<void> | null = null;
/** Suppress disk writes while re-expanding folders on restore. */
let explorerRestoring = false;

function schedulePersistExplorer(get: () => WorkspaceState, immediate = false): void {
  if (explorerRestoring) return;
  if (explorerPersistTimer) {
    clearTimeout(explorerPersistTimer);
    explorerPersistTimer = null;
  }
  if (immediate) {
    void get().persistExplorer();
    return;
  }
  explorerPersistTimer = setTimeout(() => {
    explorerPersistTimer = null;
    void get().persistExplorer();
  }, 200);
}

/** Max recent folders shown on home / stored in settings */
const MAX_RECENT = 5;

function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function pathsMatch(a: string, b: string): boolean {
  return normPath(a) === normPath(b);
}

/** True if path is the root or a child of root (case/separator insensitive). */
function isUnderRoot(path: string, root: string): boolean {
  const p = normPath(path);
  const r = normPath(root);
  return p === r || p.startsWith(r + '/');
}

function pathInSet(path: string, set: Set<string>): boolean {
  const n = normPath(path);
  for (const p of set) {
    if (normPath(p) === n) return true;
  }
  return false;
}

async function buildTreeNodes(dirPath: string, includeHidden = false): Promise<TreeNode[]> {
  const api = requireApi();
  const entries = await api.readDir({ path: dirPath, includeHidden });
  return entries.map((e) => ({
    id: e.path,
    name: e.name,
    path: e.path,
    type: e.isDirectory ? 'directory' : 'file',
    extension: e.extension,
    children: e.isDirectory ? [] : undefined,
    isExpanded: false,
    isLoading: false,
  }));
}

async function walkFiles(
  dirPath: string,
  acc: string[],
  depth: number,
  maxFiles: number,
): Promise<void> {
  if (acc.length >= maxFiles || depth > 12) return;
  const api = requireApi();
  let entries;
  try {
    entries = await api.readDir({ path: dirPath, includeHidden: false });
  } catch {
    return;
  }
  for (const e of entries) {
    if (acc.length >= maxFiles) break;
    if (e.isDirectory) {
      if (IGNORE_DIR_NAMES.has(e.name)) continue;
      await walkFiles(e.path, acc, depth + 1, maxFiles);
    } else if (e.isFile) {
      // Prefer text-like files for quick open; still include others
      if (isTextFile(e.path) || e.size === undefined || e.size < 2_000_000) {
        acc.push(e.path);
      }
    }
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPath: null,
  name: null,
  folders: [],
  tree: [],
  recentPaths: [],
  isLoading: false,
  error: null,
  expandedPaths: new Set(),
  selectedPath: null,
  fileIndex: [],
  fileIndexLoading: false,

  openFolder: async (folderPath) => {
    set({ isLoading: true, error: null });
    try {
      const api = requireApi();
      let path = folderPath;
      if (!path) {
        const result = await api.openFolder();
        if (result.canceled || !result.path) {
          set({ isLoading: false });
          return;
        }
        path = result.path;
      }

      const name = basename(path);
      const tree = await buildTreeNodes(path);
      const prevRecent = get().recentPaths;
      const recent = [
        path,
        ...prevRecent.filter((p) => !pathsMatch(p, path)),
      ].slice(0, MAX_RECENT);

      set({
        rootPath: path,
        name,
        folders: [{ name, path }],
        tree,
        recentPaths: recent,
        isLoading: false,
        expandedPaths: new Set(),
        selectedPath: null,
        fileIndex: [],
      });

      try {
        // Single atomic write so Recent/lastPath are never partially lost
        if (api.setSettingsMany) {
          await api.setSettingsMany({
            values: {
              'workspace.lastPath': path,
              'workspace.recentPaths': recent,
            },
          });
        } else {
          await api.setSetting({ key: 'workspace.lastPath', value: path });
          await api.setSetting({ key: 'workspace.recentPaths', value: recent });
        }
      } catch {
        // optional
      }

      // Index in background for Quick Open
      void get().buildFileIndex();
      // Load Git status + remote URL for this project only
      void useGitStore.getState().refresh(path);
      // Codebase index for search / AI tools
      const privacy = (await import('./settingsStore')).useSettingsStore.getState().settings
        .privacy;
      if (privacy.indexingEnabled) {
        void useIndexingStore.getState().startIndexing(path);
      }

      // Restore expanded folders + selection for this project (if previously saved)
      await get().restoreExplorer();
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to open folder',
      });
    }
  },

  refresh: async () => {
    const { rootPath, expandedPaths } = get();
    if (!rootPath) return;
    set({ isLoading: true, error: null });
    try {
      const expandRecursive = async (
        nodes: TreeNode[],
      ): Promise<TreeNode[]> => {
        return Promise.all(
          nodes.map(async (node) => {
            if (node.type === 'directory' && pathInSet(node.path, expandedPaths)) {
              let children = await buildTreeNodes(node.path);
              children = await expandRecursive(children);
              return { ...node, children, isExpanded: true };
            }
            return { ...node, isExpanded: false };
          }),
        );
      };

      const tree = await buildTreeNodes(rootPath);
      const refreshed = await expandRecursive(tree);
      set({ tree: refreshed, isLoading: false });
      void get().buildFileIndex();
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to refresh',
      });
    }
  },

  loadChildren: async (nodePath) => buildTreeNodes(nodePath),

  toggleExpand: async (nodePath) => {
    const { tree, expandedPaths, loadChildren } = get();
    const nextExpanded = new Set(expandedPaths);

    const updateNode = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
      return Promise.all(
        nodes.map(async (node) => {
          if (pathsMatch(node.path, nodePath) && node.type === 'directory') {
            if (node.isExpanded) {
              // Collapse — remove any matching path variants
              for (const p of [...nextExpanded]) {
                if (pathsMatch(p, node.path)) nextExpanded.delete(p);
              }
              return { ...node, isExpanded: false };
            }
            nextExpanded.add(node.path);
            const children = await loadChildren(node.path);
            return { ...node, children, isExpanded: true };
          }
          if (node.children && node.children.length > 0) {
            return { ...node, children: await updateNode(node.children) };
          }
          return node;
        }),
      );
    };

    const nextTree = await updateNode(tree);
    set({ tree: nextTree, expandedPaths: nextExpanded });
    schedulePersistExplorer(get, true);
  },

  ensureExpanded: async (nodePath) => {
    const { expandedPaths, toggleExpand } = get();
    if (!pathInSet(nodePath, expandedPaths)) {
      await toggleExpand(nodePath);
    }
  },

  collapseAll: () => {
    const collapseNodes = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((node) => ({
        ...node,
        isExpanded: false,
        children: node.children ? collapseNodes(node.children) : node.children,
      }));

    set({
      expandedPaths: new Set(),
      tree: collapseNodes(get().tree),
    });
    schedulePersistExplorer(get, true);
  },

  closeWorkspace: () => {
    // Keep folder on Recent, but clear lastPath so next launch does not auto-reopen it.
    // User sees welcome + Recent instead of restoring the closed workspace.
    const { rootPath, recentPaths } = get();
    let recent = recentPaths;
    if (rootPath) {
      recent = [rootPath, ...recentPaths.filter((p) => !pathsMatch(p, rootPath))].slice(
        0,
        MAX_RECENT,
      );
      set({ recentPaths: recent });
    }

    const api = requireApi();
    const clearValues = {
      'workspace.lastPath': null as string | null,
      'workspace.recentPaths': recent,
      'workspace.expandedPaths': [] as string[],
      'workspace.selectedPath': null as string | null,
      session: { openPaths: [] as string[], activePath: null as string | null },
    };
    void (api.setSettingsMany
      ? api.setSettingsMany({ values: clearValues })
      : Promise.all([
          api.setSetting({ key: 'workspace.lastPath', value: null }),
          api.setSetting({ key: 'workspace.recentPaths', value: recent }),
          api.setSetting({ key: 'workspace.expandedPaths', value: [] }),
          api.setSetting({ key: 'workspace.selectedPath', value: null }),
          api.setSetting({ key: 'session', value: { openPaths: [], activePath: null } }),
        ])
    ).catch(() => undefined);

    set({
      rootPath: null,
      name: null,
      folders: [],
      tree: [],
      expandedPaths: new Set(),
      error: null,
      selectedPath: null,
      fileIndex: [],
    });
    useGitStore.getState().reset();

    // Clear editor tabs so welcome + Recent show
    void (async () => {
      const { useEditorStore } = await import('./editorStore');
      const ed = useEditorStore.getState();
      // Force-clear without dirty prompts when closing whole workspace
      useEditorStore.setState({ tabs: [], activeTabId: null });
      await ed.flushSession();
    })();
  },

  setError: (error) => set({ error }),
  setSelectedPath: (path) => {
    set({ selectedPath: path });
    schedulePersistExplorer(get);
  },

  createFile: async (parentDir, name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
      set({ error: 'Invalid file name' });
      return null;
    }
    const fullPath = joinPath(parentDir, trimmed);
    try {
      const api = requireApi();
      await api.createFile({ path: fullPath, content: '' });
      await get().refresh();
      // Expand parent
      if (parentDir !== get().rootPath) {
        await get().ensureExpanded(parentDir);
      }
      set({ selectedPath: fullPath, error: null });
      return fullPath;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create file' });
      return null;
    }
  },

  createFolder: async (parentDir, name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
      set({ error: 'Invalid folder name' });
      return null;
    }
    const fullPath = joinPath(parentDir, trimmed);
    try {
      const api = requireApi();
      await api.createDir({ path: fullPath, recursive: true });
      await get().refresh();
      set({ selectedPath: fullPath, error: null });
      return fullPath;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create folder' });
      return null;
    }
  },

  renameEntry: async (oldPath, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
      set({ error: 'Invalid name' });
      return null;
    }
    const parent = dirname(oldPath);
    const newPath = joinPath(parent, trimmed);
    if (newPath === oldPath) return oldPath;
    try {
      const api = requireApi();
      await api.rename({ oldPath, newPath });
      await get().refresh();
      set({ selectedPath: newPath, error: null });
      return newPath;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to rename' });
      return null;
    }
  },

  deleteEntry: async (targetPath) => {
    try {
      const api = requireApi();
      const stat = await api.stat({ path: targetPath });
      const result = await api.showMessage({
        type: 'warning',
        title: 'Confirm Delete',
        message: `Are you sure you want to delete "${basename(targetPath)}"?`,
        detail: `This will permanently delete:\n${targetPath}\n\nThis cannot be undone.`,
        buttons: ['Delete', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      });
      if (result.response !== 0) return false;

      await api.delete({ path: targetPath, recursive: stat.isDirectory });
      await get().refresh();
      if (get().selectedPath === targetPath) {
        set({ selectedPath: null });
      }
      set({ error: null });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete' });
      return false;
    }
  },

  buildFileIndex: async () => {
    const root = get().rootPath;
    if (!root) {
      set({ fileIndex: [], fileIndexLoading: false });
      return;
    }
    set({ fileIndexLoading: true });
    const files: string[] = [];
    try {
      await walkFiles(root, files, 0, 5000);
      set({ fileIndex: files, fileIndexLoading: false });
    } catch {
      set({ fileIndex: files, fileIndexLoading: false });
    }
  },

  searchFiles: (query, limit = 50) => {
    const q = query.trim().toLowerCase();
    const { fileIndex, rootPath } = get();
    if (!q) {
      return fileIndex.slice(0, limit);
    }

    const scored: Array<{ path: string; score: number }> = [];
    for (const path of fileIndex) {
      const name = basename(path).toLowerCase();
      const rel = rootPath
        ? path.replace(/\\/g, '/').toLowerCase().replace(rootPath.replace(/\\/g, '/').toLowerCase(), '')
        : path.toLowerCase();

      let score = -1;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (rel.includes(q)) score = 40;
      else {
        // Fuzzy: all chars in order
        let qi = 0;
        for (let i = 0; i < name.length && qi < q.length; i++) {
          if (name[i] === q[qi]) qi++;
        }
        if (qi === q.length) score = 20;
      }
      if (score >= 0) scored.push({ path, score });
    }
    scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    return scored.slice(0, limit).map((s) => s.path);
  },

  loadRecent: async () => {
    try {
      const api = requireApi();
      // Prefer full settings snapshot (more reliable than a single key after races)
      let saved: string[] | undefined;
      try {
        const all = (await api.getAllSettings()) as {
          workspace?: { recentPaths?: string[] };
        };
        if (Array.isArray(all?.workspace?.recentPaths)) {
          saved = all.workspace.recentPaths;
        }
      } catch {
        // fall through
      }
      if (!saved) {
        saved = await api.getSetting<string[]>({ key: 'workspace.recentPaths' });
      }

      const fromDisk = Array.isArray(saved)
        ? saved.filter((p) => typeof p === 'string' && p.length > 0)
        : [];
      const current = get().recentPaths;

      // Merge: never wipe a non-empty in-memory list with an empty disk read
      if (fromDisk.length === 0) {
        if (current.length > 0) return;
        set({ recentPaths: [] });
        return;
      }

      const merged: string[] = [];
      const pushUnique = (p: string) => {
        if (!merged.some((x) => pathsMatch(x, p))) merged.push(p);
      };
      for (const p of fromDisk) pushUnique(p);
      for (const p of current) pushUnique(p);
      set({ recentPaths: merged.slice(0, MAX_RECENT) });
    } catch {
      // keep in-memory list
    }
  },

  removeRecent: async (path) => {
    const recent = get().recentPaths.filter((p) => !pathsMatch(p, path));
    set({ recentPaths: recent });
    try {
      await requireApi().setSetting({ key: 'workspace.recentPaths', value: recent });
    } catch {
      // ignore
    }
  },

  persistExplorer: async () => {
    try {
      const { rootPath, expandedPaths, selectedPath, recentPaths } = get();
      if (!rootPath) return;
      const api = requireApi();
      const expanded = [...expandedPaths];
      const values: Record<string, unknown> = {
        'workspace.lastPath': rootPath,
        'workspace.recentPaths': recentPaths.slice(0, MAX_RECENT),
        'workspace.expandedPaths': expanded,
        'workspace.selectedPath': selectedPath,
      };
      const write = api.setSettingsMany
        ? api.setSettingsMany({ values })
        : (async () => {
            for (const [key, value] of Object.entries(values)) {
              await api.setSetting({ key, value });
            }
          })();
      explorerPersistInFlight = write.then(
        () => undefined,
        () => undefined,
      );
      await explorerPersistInFlight;
      explorerPersistInFlight = null;
    } catch {
      explorerPersistInFlight = null;
    }
  },

  flushExplorer: async () => {
    if (explorerPersistTimer) {
      clearTimeout(explorerPersistTimer);
      explorerPersistTimer = null;
    }
    await get().persistExplorer();
    if (explorerPersistInFlight) await explorerPersistInFlight;
  },

  restoreExplorer: async () => {
    if (explorerRestoring) return;
    explorerRestoring = true;
    try {
      const { rootPath, tree } = get();
      if (!rootPath) return;
      const api = requireApi();

      // Read from full snapshot first
      let expanded: string[] = [];
      let selected: string | null = null;
      try {
        const all = (await api.getAllSettings()) as {
          workspace?: { expandedPaths?: string[]; selectedPath?: string | null };
        };
        if (Array.isArray(all?.workspace?.expandedPaths)) {
          expanded = all.workspace.expandedPaths;
        }
        if (all?.workspace?.selectedPath != null) {
          selected = all.workspace.selectedPath;
        }
      } catch {
        // fall through to single keys
      }
      if (expanded.length === 0) {
        const e = await api.getSetting<string[]>({ key: 'workspace.expandedPaths' });
        if (Array.isArray(e)) expanded = e;
      }
      if (selected == null) {
        const s = await api.getSetting<string | null>({ key: 'workspace.selectedPath' });
        if (typeof s === 'string') selected = s;
      }

      const want = new Set(
        expanded.filter((p) => typeof p === 'string' && p.length > 0 && isUnderRoot(p, rootPath)),
      );
      if (want.size === 0 && !selected) return;

      // Bulk re-expand: load children for every saved folder (reliable vs one-by-one toggle)
      const applied = new Set<string>();
      const expandRecursive = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
        return Promise.all(
          nodes.map(async (node) => {
            if (node.type === 'directory' && pathInSet(node.path, want)) {
              applied.add(node.path);
              try {
                let children = await buildTreeNodes(node.path);
                children = await expandRecursive(children);
                return { ...node, children, isExpanded: true };
              } catch {
                return { ...node, isExpanded: false };
              }
            }
            return { ...node, isExpanded: false, children: node.type === 'directory' ? [] : undefined };
          }),
        );
      };

      const nextTree = await expandRecursive(tree);
      let nextSelected: string | null = null;
      if (selected && typeof selected === 'string' && isUnderRoot(selected, rootPath)) {
        try {
          if (await api.exists({ path: selected })) {
            nextSelected = selected;
          }
        } catch {
          // ignore
        }
      }

      set({
        tree: nextTree,
        expandedPaths: applied,
        selectedPath: nextSelected,
      });
    } catch (err) {
      console.error('Failed to restore explorer state:', err);
    } finally {
      explorerRestoring = false;
    }
  },
}));
