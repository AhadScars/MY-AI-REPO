import { create } from 'zustand';
import type { ShellId, ShellInfo } from '../../packages/protocol/src/terminal';
import { requireApi } from '../services/platform';

export interface TerminalSession {
  id: string;
  name: string;
  cwd: string | null;
  shell: ShellId;
  shellPath?: string;
  pid?: number;
  isActive: boolean;
  status: 'starting' | 'running' | 'exited' | 'error';
  exitCode?: number;
  error?: string;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  availableShells: ShellInfo[];
  preferredShell: ShellId;
  lastError: string | null;

  loadShells: () => Promise<void>;
  setPreferredShell: (shell: ShellId) => void;
  createSession: (opts?: {
    cwd?: string;
    shell?: ShellId;
    cols?: number;
    rows?: number;
    name?: string;
  }) => Promise<string | null>;
  killSession: (id: string) => Promise<void>;
  killActive: () => Promise<void>;
  /** Close tab only if exited; otherwise kill process */
  closeSession: (id: string) => Promise<void>;
  restartSession: (id: string) => Promise<void>;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  activateNext: () => void;
  activatePrev: () => void;
  markExited: (id: string, exitCode: number) => void;
  markError: (id: string, error: string) => void;
}

let sessionCounter = 0;

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  availableShells: [],
  preferredShell: 'auto',
  lastError: null,

  loadShells: async () => {
    try {
      const shells = await requireApi().listShells();
      set({ availableShells: shells, lastError: null });
    } catch (err) {
      set({
        lastError: err instanceof Error ? err.message : 'Failed to list shells',
      });
    }
  },

  setPreferredShell: (shell) => set({ preferredShell: shell }),

  createSession: async (opts) => {
    sessionCounter += 1;
    const name = (opts?.name?.trim() || `Terminal ${sessionCounter}`).slice(0, 48);
    const shell = opts?.shell ?? get().preferredShell;

    try {
      const api = requireApi();
      const result = await api.createTerminal({
        cwd: opts?.cwd,
        shell,
        cols: opts?.cols ?? 80,
        rows: opts?.rows ?? 24,
      });

      const session: TerminalSession = {
        id: result.id,
        name,
        cwd: result.cwd,
        shell: result.shell,
        shellPath: result.shellPath,
        pid: result.pid,
        isActive: true,
        status: 'running',
      };

      const sessions = get().sessions.map((s) => ({ ...s, isActive: false }));
      set({
        sessions: [...sessions, session],
        activeSessionId: result.id,
        lastError: null,
      });
      return result.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create terminal';
      set({ lastError: message });
      console.error(message);
      return null;
    }
  },

  killSession: async (id) => {
    try {
      await requireApi().killTerminal({ id });
    } catch {
      // may already be dead
    }
    const sessions = get().sessions.filter((s) => s.id !== id);
    let activeSessionId = get().activeSessionId;
    if (activeSessionId === id) {
      activeSessionId = sessions[sessions.length - 1]?.id ?? null;
    }
    set({
      sessions: sessions.map((s) => ({
        ...s,
        isActive: s.id === activeSessionId,
      })),
      activeSessionId,
    });
  },

  killActive: async () => {
    const id = get().activeSessionId;
    if (id) await get().killSession(id);
  },

  closeSession: async (id) => {
    const s = get().sessions.find((x) => x.id === id);
    if (!s) return;
    if (s.status === 'running' || s.status === 'starting') {
      await get().killSession(id);
    } else {
      // already exited — just remove tab
      const sessions = get().sessions.filter((x) => x.id !== id);
      let activeSessionId = get().activeSessionId;
      if (activeSessionId === id) {
        activeSessionId = sessions[sessions.length - 1]?.id ?? null;
      }
      set({
        sessions: sessions.map((x) => ({
          ...x,
          isActive: x.id === activeSessionId,
        })),
        activeSessionId,
      });
    }
  },

  restartSession: async (id) => {
    const existing = get().sessions.find((s) => s.id === id);
    if (!existing) return;
    try {
      const result = await requireApi().restartTerminal({
        id,
        cwd: existing.cwd ?? undefined,
        shell: existing.shell,
      });
      set({
        sessions: get().sessions.map((s) =>
          s.id === id
            ? {
                ...s,
                id: result.id,
                cwd: result.cwd,
                shell: result.shell,
                shellPath: result.shellPath,
                pid: result.pid,
                status: 'running',
                exitCode: undefined,
                error: undefined,
                isActive: get().activeSessionId === id || s.isActive,
              }
            : s,
        ),
        activeSessionId:
          get().activeSessionId === id ? result.id : get().activeSessionId,
        lastError: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restart failed';
      get().markError(id, message);
    }
  },

  setActiveSession: (id) => {
    if (!get().sessions.some((s) => s.id === id)) return;
    set({
      activeSessionId: id,
      sessions: get().sessions.map((s) => ({ ...s, isActive: s.id === id })),
    });
  },

  renameSession: (id, name) => {
    const trimmed = name.trim().slice(0, 48);
    if (!trimmed) return;
    set({
      sessions: get().sessions.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
    });
  },

  activateNext: () => {
    const { sessions, activeSessionId } = get();
    if (sessions.length === 0) return;
    const idx = sessions.findIndex((s) => s.id === activeSessionId);
    const next = sessions[(idx + 1) % sessions.length];
    if (next) get().setActiveSession(next.id);
  },

  activatePrev: () => {
    const { sessions, activeSessionId } = get();
    if (sessions.length === 0) return;
    const idx = sessions.findIndex((s) => s.id === activeSessionId);
    const prev = sessions[(idx - 1 + sessions.length) % sessions.length];
    if (prev) get().setActiveSession(prev.id);
  },

  markExited: (id, exitCode) => {
    set({
      sessions: get().sessions.map((s) =>
        s.id === id ? { ...s, status: 'exited', exitCode } : s,
      ),
    });
  },

  markError: (id, error) => {
    set({
      sessions: get().sessions.map((s) =>
        s.id === id ? { ...s, status: 'error', error } : s,
      ),
      lastError: error,
    });
  },
}));
