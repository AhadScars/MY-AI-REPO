import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import type { IPty } from 'node-pty';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type {
  ShellId,
  TerminalCreateRequest,
  TerminalCreateResult,
  TerminalListItem,
} from '../../../packages/protocol/src/terminal.js';
import { defaultCwd, listAvailableShells, resolveShell } from './shell-detect.js';

interface PtySession {
  id: string;
  pty: IPty;
  shell: ShellId;
  shellPath: string;
  cwd: string;
  cols: number;
  rows: number;
}

/**
 * Manages node-pty processes in the main process.
 * Output is forwarded to the renderer over IPC events.
 */
export class TerminalManager {
  private sessions = new Map<string, PtySession>();
  private ptyModule: typeof import('node-pty') | null = null;
  private getWindow: () => BrowserWindow | null;

  constructor(getWindow: () => BrowserWindow | null) {
    this.getWindow = getWindow;
  }

  private async loadPty(): Promise<typeof import('node-pty')> {
    if (this.ptyModule) return this.ptyModule;
    try {
      // Dynamic import — native module must be externalized from the Vite bundle
      this.ptyModule = await import('node-pty');
      return this.ptyModule;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to load node-pty. Rebuild native modules for Electron (npx electron-rebuild -f -w node-pty). ${message}`,
      );
    }
  }

  listShells() {
    return listAvailableShells();
  }

  list(): TerminalListItem[] {
    return [...this.sessions.values()].map((s) => ({
      id: s.id,
      shell: s.shell,
      cwd: s.cwd,
      pid: s.pty.pid,
    }));
  }

  async create(request: TerminalCreateRequest = {}): Promise<TerminalCreateResult> {
    const pty = await this.loadPty();
    const shellPref = (request.shell ?? 'auto') as ShellId;
    const resolved = resolveShell(shellPref);
    const cwd = defaultCwd(request.cwd);
    const cols = Math.max(2, request.cols ?? 80);
    const rows = Math.max(1, request.rows ?? 24);

    const env: Record<string, string> = {
      ...process.env,
      ...request.env,
      TERM: process.env.TERM ?? 'xterm-256color',
      COLORTERM: process.env.COLORTERM ?? 'truecolor',
    } as Record<string, string>;

    // Avoid leaking Electron paths that confuse shells
    delete env.ELECTRON_RUN_AS_NODE;

    const id = randomUUID();

    let proc: IPty;
    try {
      proc = pty.spawn(resolved.path, resolved.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
        useConpty: process.platform === 'win32',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to spawn shell "${resolved.name}" (${resolved.path}): ${message}`);
    }

    const session: PtySession = {
      id,
      pty: proc,
      shell: resolved.id,
      shellPath: resolved.path,
      cwd,
      cols,
      rows,
    };
    this.sessions.set(id, session);

    proc.onData((data) => {
      const win = this.getWindow();
      win?.webContents.send(IpcChannels.EVENT_TERMINAL_DATA, { id, data });
    });

    proc.onExit(({ exitCode, signal }) => {
      this.sessions.delete(id);
      const win = this.getWindow();
      win?.webContents.send(IpcChannels.EVENT_TERMINAL_EXIT, {
        id,
        exitCode,
        signal: signal ?? undefined,
      });
    });

    return {
      id,
      shell: resolved.id,
      shellPath: resolved.path,
      cwd,
      cols,
      rows,
      pid: proc.pid,
    };
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Terminal not found: ${id}`);
    session.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) return;
    const c = Math.max(2, Math.floor(cols));
    const r = Math.max(1, Math.floor(rows));
    session.pty.resize(c, r);
    session.cols = c;
    session.rows = r;
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.pty.kill();
    } catch {
      // already dead
    }
    this.sessions.delete(id);
  }

  async restart(
    id: string,
    opts: { cwd?: string; shell?: ShellId; cols?: number; rows?: number } = {},
  ): Promise<TerminalCreateResult> {
    const existing = this.sessions.get(id);
    const cwd = opts.cwd ?? existing?.cwd;
    const shell = opts.shell ?? existing?.shell ?? 'auto';
    const cols = opts.cols ?? existing?.cols ?? 80;
    const rows = opts.rows ?? existing?.rows ?? 24;
    this.kill(id);
    return this.create({ cwd, shell, cols, rows });
  }

  disposeAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.kill(id);
    }
  }
}
