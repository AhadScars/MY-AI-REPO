import { create } from 'zustand';
import type {
  GitBranchInfo,
  GitChange,
  GitDiffResult,
  GitFileStatusCode,
  GitLogEntry,
  GitRemoteInfo,
} from '../../packages/protocol/src/git';
import { requireApi } from '../services/platform';

interface GitState {
  workspacePath: string | null;
  isRepo: boolean;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitChange[];
  unstaged: GitChange[];
  conflicted: GitChange[];
  /** relative path -> status for decorations */
  statusMap: Record<string, GitFileStatusCode>;
  branches: GitBranchInfo[];
  remotes: GitRemoteInfo[];
  log: GitLogEntry[];
  isLoading: boolean;
  isCommitting: boolean;
  isPushing: boolean;
  error: string | null;
  lastMessage: string | null;
  /** When true, UI should prompt user to add a remote URL */
  needsRemote: boolean;
  selectedDiff: GitDiffResult | null;
  diffLoading: boolean;

  refresh: (workspacePath?: string | null) => Promise<void>;
  loadRemotes: () => Promise<void>;
  setRemote: (url: string, name?: string) => Promise<boolean>;
  stage: (paths: string[]) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  discard: (paths: string[]) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: (message: string, opts?: { amend?: boolean }) => Promise<boolean>;
  /**
   * Easy path: stage all changes → commit → push (optional).
   * Returns true if commit succeeded (push may still fail separately).
   */
  commitAndPush: (
    message: string,
    opts?: { push?: boolean; amend?: boolean },
  ) => Promise<boolean>;
  loadBranches: () => Promise<void>;
  checkout: (ref: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  fetch: () => Promise<void>;
  pull: () => Promise<void>;
  push: (opts?: { confirm?: boolean }) => Promise<boolean>;
  initRepo: () => Promise<void>;
  showDiff: (filePath: string, staged: boolean) => Promise<void>;
  clearDiff: () => void;
  getStatusForPath: (absolutePath: string) => GitFileStatusCode | undefined;
  reset: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  workspacePath: null,
  isRepo: false,
  branch: null,
  upstream: null,
  ahead: 0,
  behind: 0,
  staged: [],
  unstaged: [],
  conflicted: [],
  statusMap: {},
  branches: [],
  remotes: [],
  log: [],
  isLoading: false,
  isCommitting: false,
  isPushing: false,
  error: null,
  lastMessage: null,
  needsRemote: false,
  selectedDiff: null,
  diffLoading: false,

  refresh: async (workspacePath) => {
    const cwd = workspacePath === undefined ? get().workspacePath : workspacePath;
    if (!cwd) {
      get().reset();
      return;
    }

    // Always bind SCM to this folder and clear previous project's remotes first
    set({
      isLoading: true,
      error: null,
      lastMessage: null,
      workspacePath: cwd,
      remotes: [],
      needsRemote: false,
    });

    try {
      const api = requireApi();
      const status = await api.gitStatus({ cwd });

      // Stale response after another project was opened
      if (get().workspacePath !== cwd) return;

      set({
        isRepo: status.isRepo,
        branch: status.branch,
        upstream: status.upstream,
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        unstaged: status.unstaged,
        conflicted: status.conflicted,
        statusMap: status.statusMap,
        isLoading: false,
        error: null,
      });

      if (status.isRepo) {
        void get().loadBranches();
        await get().loadRemotes();
        try {
          const log = await api.gitLog({ cwd, limit: 20 });
          if (get().workspacePath === cwd) set({ log });
        } catch {
          if (get().workspacePath === cwd) set({ log: [] });
        }
      } else {
        set({
          branches: [],
          log: [],
          remotes: [],
          needsRemote: false,
        });
      }
    } catch (err) {
      if (get().workspacePath !== cwd) return;
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Git status failed',
        isRepo: false,
        remotes: [],
        needsRemote: false,
        branches: [],
        log: [],
      });
    }
  },

  stage: async (paths) => {
    const cwd = get().workspacePath;
    if (!cwd || paths.length === 0) return;
    try {
      await requireApi().gitStage({ cwd, paths });
      await get().refresh(cwd);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Stage failed' });
    }
  },

  unstage: async (paths) => {
    const cwd = get().workspacePath;
    if (!cwd || paths.length === 0) return;
    try {
      await requireApi().gitUnstage({ cwd, paths });
      await get().refresh(cwd);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unstage failed' });
    }
  },

  discard: async (paths) => {
    const cwd = get().workspacePath;
    if (!cwd || paths.length === 0) return;
    try {
      const api = requireApi();
      const confirm = await api.showMessage({
        type: 'warning',
        title: 'Discard Changes',
        message: `Discard local changes to ${paths.length} file(s)?`,
        detail: 'This cannot be undone for tracked files.',
        buttons: ['Discard', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      });
      if (confirm.response !== 0) return;
      await api.gitDiscard({ cwd, paths });
      await get().refresh(cwd);
      set({ selectedDiff: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Discard failed' });
    }
  },

  stageAll: async () => {
    const paths = get().unstaged.map((c) => c.path);
    await get().stage(paths);
  },

  unstageAll: async () => {
    const paths = get().staged.map((c) => c.path);
    await get().unstage(paths);
  },

  commit: async (message, opts) => {
    const cwd = get().workspacePath;
    if (!cwd) return false;
    const msg = message.trim();
    const amend = Boolean(opts?.amend);
    if (!msg && !amend) {
      set({ error: 'Enter a commit message' });
      return false;
    }
    if (get().staged.length === 0 && !amend) {
      set({ error: 'Nothing staged to commit — stage files first or use Commit & Push' });
      return false;
    }
    set({ isCommitting: true, error: null });
    try {
      await requireApi().gitCommit({
        cwd,
        message: msg || 'amend',
        amend,
      });
      set({
        isCommitting: false,
        lastMessage: amend ? 'Amended commit' : 'Committed',
        selectedDiff: null,
      });
      await get().refresh(cwd);
      return true;
    } catch (err) {
      set({
        isCommitting: false,
        error: err instanceof Error ? err.message : 'Commit failed',
      });
      return false;
    }
  },

  commitAndPush: async (message, opts) => {
    const cwd = get().workspacePath;
    if (!cwd) return false;
    const msg = message.trim();
    const amend = Boolean(opts?.amend);
    if (!msg && !amend) {
      set({ error: 'Enter a commit message first' });
      return false;
    }

    set({ isCommitting: true, error: null, lastMessage: null });
    try {
      // 1) Stage everything (add all)
      if (get().unstaged.length > 0) {
        await get().stageAll();
        await get().refresh(cwd);
      }

      // 2) Commit if there is something staged (or amend)
      let didCommit = false;
      if (get().staged.length > 0 || amend) {
        await requireApi().gitCommit({
          cwd,
          message: msg || 'amend',
          amend,
        });
        await get().refresh(cwd);
        didCommit = true;
        set({ lastMessage: amend ? 'Amended commit' : 'Committed' });
      } else if (get().ahead === 0) {
        set({
          isCommitting: false,
          error: 'Nothing to commit — working tree is clean',
        });
        return false;
      }

      set({ isCommitting: false });

      // 3) Push (default on) — also works for “already committed, just push”
      if (opts?.push !== false) {
        const pushed = await get().push({ confirm: false });
        if (pushed) {
          set({
            lastMessage: didCommit
              ? 'Committed and pushed successfully'
              : 'Pushed successfully',
          });
        }
        return pushed;
      }

      set({ lastMessage: didCommit ? 'Committed successfully' : 'Done' });
      return true;
    } catch (err) {
      set({
        isCommitting: false,
        isPushing: false,
        error: err instanceof Error ? err.message : 'Commit & push failed',
      });
      return false;
    }
  },

  loadBranches: async () => {
    const cwd = get().workspacePath;
    if (!cwd || !get().isRepo) return;
    try {
      const branches = await requireApi().gitBranches({ cwd });
      set({ branches });
    } catch {
      set({ branches: [] });
    }
  },

  loadRemotes: async () => {
    const cwd = get().workspacePath;
    if (!cwd || !get().isRepo) {
      set({ remotes: [], needsRemote: false });
      return;
    }
    try {
      const remotes = await requireApi().gitListRemotes({ cwd });
      // Drop if project changed while request was in flight
      if (
        get().workspacePath?.replace(/\\/g, '/').toLowerCase() !==
        cwd.replace(/\\/g, '/').toLowerCase()
      ) {
        return;
      }
      set({
        remotes,
        needsRemote: remotes.length === 0,
      });
    } catch {
      if (
        get().workspacePath?.replace(/\\/g, '/').toLowerCase() ===
        cwd.replace(/\\/g, '/').toLowerCase()
      ) {
        set({ remotes: [], needsRemote: true });
      }
    }
  },

  setRemote: async (url, name = 'origin') => {
    const cwd = get().workspacePath;
    if (!cwd) return false;
    const trimmed = url.trim();
    if (!trimmed) {
      set({ error: 'Enter a remote repository URL' });
      return false;
    }
    try {
      await requireApi().gitSetRemote({ cwd, url: trimmed, name });
      await get().loadRemotes();
      set({
        lastMessage: `Remote "${name}" set to ${trimmed}`,
        error: null,
        needsRemote: false,
      });
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to set remote',
        needsRemote: true,
      });
      return false;
    }
  },

  checkout: async (ref) => {
    const cwd = get().workspacePath;
    if (!cwd) return;
    try {
      await requireApi().gitCheckout({ cwd, ref });
      await get().refresh(cwd);
      set({ lastMessage: `Checked out ${ref}` });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Checkout failed' });
    }
  },

  createBranch: async (name) => {
    const cwd = get().workspacePath;
    if (!cwd) return;
    try {
      await requireApi().gitCreateBranch({ cwd, name, checkout: true });
      await get().refresh(cwd);
      set({ lastMessage: `Created branch ${name}` });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Create branch failed' });
    }
  },

  fetch: async () => {
    const cwd = get().workspacePath;
    if (!cwd) return;
    try {
      const msg = await requireApi().gitFetch({ cwd });
      await get().refresh(cwd);
      set({ lastMessage: msg });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Fetch failed' });
    }
  },

  pull: async () => {
    const cwd = get().workspacePath;
    if (!cwd) return;
    try {
      const msg = await requireApi().gitPull({ cwd });
      await get().refresh(cwd);
      set({ lastMessage: msg });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Pull failed' });
    }
  },

  push: async (opts) => {
    const cwd = get().workspacePath;
    if (!cwd) return false;
    set({ isPushing: true, error: null });
    try {
      const api = requireApi();
      await get().loadRemotes();
      if (get().remotes.length === 0) {
        set({
          isPushing: false,
          needsRemote: true,
          error:
            'No remote repository configured. Add your GitHub/GitLab URL below, then push again.',
        });
        return false;
      }

      const wantConfirm = opts?.confirm !== false;
      if (wantConfirm) {
        const settings = await api.getSetting<boolean>({ key: 'git.confirmSync' });
        if (settings !== false) {
          const remoteLabel =
            get().remotes.find((r) => r.name === 'origin')?.pushUrl ||
            get().remotes[0]?.pushUrl ||
            'remote';
          const confirm = await api.showMessage({
            type: 'question',
            title: 'Push',
            message: `Push ${get().branch ?? 'HEAD'} to:\n${remoteLabel}`,
            buttons: ['Push', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          });
          if (confirm.response !== 0) {
            set({ isPushing: false });
            return false;
          }
        }
      }
      const msg = await api.gitPush({ cwd });
      await get().refresh(cwd);
      set({
        isPushing: false,
        lastMessage: msg || 'Pushed successfully',
        needsRemote: false,
      });
      return true;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const needsRemote =
        /NO_REMOTE|REMOTE_INVALID|does not appear to be a git repository|Could not read from remote/i.test(
          raw,
        );
      // Clean up IPC wrapper noise for the user
      const clean = raw
        .replace(/^Error invoking remote method '[^']+':\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .replace(/^NO_REMOTE:\s*/i, '')
        .replace(/^REMOTE_INVALID:\s*/i, '');
      set({
        isPushing: false,
        needsRemote: needsRemote || get().remotes.length === 0,
        error: clean || 'Push failed',
      });
      return false;
    }
  },

  initRepo: async () => {
    const cwd = get().workspacePath;
    if (!cwd) return;
    try {
      await requireApi().gitInit({ cwd });
      await get().refresh(cwd);
      set({ lastMessage: 'Initialized empty Git repository' });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'git init failed' });
    }
  },

  showDiff: async (filePath, staged) => {
    const cwd = get().workspacePath;
    if (!cwd) return;
    set({ diffLoading: true });
    try {
      const diff = await requireApi().gitDiff({ cwd, path: filePath, staged });
      set({ selectedDiff: diff, diffLoading: false });
    } catch (err) {
      set({
        diffLoading: false,
        error: err instanceof Error ? err.message : 'Diff failed',
        selectedDiff: null,
      });
    }
  },

  clearDiff: () => set({ selectedDiff: null }),

  getStatusForPath: (absolutePath) => {
    const { workspacePath, statusMap } = get();
    if (!workspacePath) return undefined;
    const norm = absolutePath.replace(/\\/g, '/');
    const root = workspacePath.replace(/\\/g, '/');
    let rel = norm;
    if (norm.toLowerCase().startsWith(root.toLowerCase())) {
      rel = norm.slice(root.length).replace(/^\//, '');
    }
    return statusMap[rel] ?? statusMap[rel.replace(/\//g, '\\')];
  },

  reset: () =>
    set({
      workspacePath: null,
      isRepo: false,
      branch: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      remotes: [],
      isPushing: false,
      needsRemote: false,
      conflicted: [],
      statusMap: {},
      branches: [],
      log: [],
      error: null,
      lastMessage: null,
      selectedDiff: null,
      isLoading: false,
    }),
}));
