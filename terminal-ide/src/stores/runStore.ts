import { create } from 'zustand';
import { requireApi } from '../services/platform';
import { useEditorStore } from './editorStore';
import { useLayoutStore } from './layoutStore';
import { useWorkspaceStore } from './workspaceStore';
import { useDiagnosticsStore } from './diagnosticsStore';
import { dirname } from '../../packages/shared/src/path';
import { normalizeTerminalChunk } from '../features/run/ansi';

export interface RunLogLine {
  id: string;
  stream: 'stdout' | 'stderr' | 'system' | 'stdin';
  text: string;
  ts: number;
}

interface RunState {
  isRunning: boolean;
  runId: string | null;
  lastCommand: string | null;
  lastFilePath: string | null;
  output: RunLogLine[];
  exitCode: number | null;
  error: string | null;
  subscribed: boolean;

  ensureSubscribed: () => void;
  clearOutput: () => void;
  runActiveFile: () => Promise<void>;
  /** Stop if needed, then run again (active file or last run file). */
  rerun: () => Promise<void>;
  stop: () => Promise<void>;
  /** Send a line of text to the running program (stdin). */
  sendInput: (text: string) => Promise<void>;
  append: (stream: RunLogLine['stream'], text: string) => void;
  reparseDiagnostics: () => void;
}

let lineCounter = 0;

export const useRunStore = create<RunState>((set, get) => ({
  isRunning: false,
  runId: null,
  lastCommand: null,
  lastFilePath: null,
  output: [],
  exitCode: null,
  error: null,
  subscribed: false,

  ensureSubscribed: () => {
    if (get().subscribed) return;
    const api = requireApi();
    api.onRunOutput((event) => {
      if (get().runId && event.runId !== get().runId) return;
      get().append(event.stream, event.data);
      // Live-update markers as stderr streams in
      if (event.stream === 'stderr' || event.stream === 'system') {
        get().reparseDiagnostics();
      }
    });
    api.onRunExit((event) => {
      if (get().runId && event.runId !== get().runId) return;
      const ms = event.durationMs;
      get().append(
        'system',
        `\n[Finished in ${ms}ms with exit code ${event.code ?? 'null'}]\n`,
      );
      set({ isRunning: false, exitCode: event.code, runId: null });
      get().reparseDiagnostics();
      // Jump to first error so the red underline is visible; hover shows the message
      const diags = useDiagnosticsStore.getState().diagnostics;
      const first = diags.find((d) => d.severity === 'error') ?? diags[0];
      if (first) {
        useDiagnosticsStore.getState().requestReveal(first.path, first.line, first.column);
        useLayoutStore.getState().setBottomPanelTab('problems');
      }
    });
    set({ subscribed: true });
  },

  clearOutput: () => {
    set({ output: [], error: null, exitCode: null });
    useDiagnosticsStore.getState().clearRun();
  },

  reparseDiagnostics: () => {
    const { output, lastFilePath } = get();
    const text = output.map((l) => l.text).join('');
    useDiagnosticsStore.getState().setFromOutput(text, lastFilePath);
  },

  append: (stream, text) => {
    // Normalize \r progress bars / control junk before splitting lines
    // (ANSI colors kept for the Output panel renderer)
    const cleaned = normalizeTerminalChunk(text);

    // Split multi-line chunks so UI can style per line
    const parts = cleaned.split(/(\r?\n)/);
    const lines: RunLogLine[] = [];
    let buf = '';
    for (const p of parts) {
      buf += p;
      if (p === '\n' || p === '\r\n') {
        lineCounter += 1;
        lines.push({ id: `l${lineCounter}`, stream, text: buf, ts: Date.now() });
        buf = '';
      }
    }
    if (buf) {
      lineCounter += 1;
      lines.push({ id: `l${lineCounter}`, stream, text: buf, ts: Date.now() });
    }
    if (lines.length === 0) return;
    set({ output: [...get().output, ...lines].slice(-5000) });
  },

  runActiveFile: async () => {
    get().ensureSubscribed();
    const editor = useEditorStore.getState();
    const tab = editor.getActiveTab();
    if (!tab) {
      set({ error: 'No file open to run' });
      return;
    }
    if (tab.path.startsWith('untitled:')) {
      set({ error: 'Save the file first (Ctrl+S) before running' });
      return;
    }

    // Auto-save dirty file
    if (tab.isDirty) {
      const ok = await editor.saveActive();
      if (!ok) {
        set({ error: 'Save failed — cannot run' });
        return;
      }
    }

    // Show output panel
    useLayoutStore.getState().setBottomPanelTab('output');
    if (!useLayoutStore.getState().bottomPanelVisible) {
      useLayoutStore.getState().toggleBottomPanel();
    }
    if (!useLayoutStore.getState().bottomPanelVisible) {
      useLayoutStore.setState({ bottomPanelVisible: true, bottomPanelTab: 'output' });
    }

    useDiagnosticsStore.getState().clearRun();
    set({
      isRunning: true,
      error: null,
      exitCode: null,
      output: [],
      lastCommand: null,
      lastFilePath: tab.path,
    });

    try {
      const api = requireApi();
      const detect = await api.runDetect({ filePath: tab.path });
      if (!detect.available) {
        set({
          isRunning: false,
          error: detect.reason ?? 'Cannot run this file type',
        });
        get().append('system', `Error: ${detect.reason ?? 'Cannot run'}\n`);
        return;
      }

      const cwd =
        useWorkspaceStore.getState().rootPath ?? dirname(tab.path);

      const springHint =
        detect.language === 'spring-boot'
          ? detect.label.includes('deps missing')
            ? '\n[Spring Boot] Dependencies missing — use Maven tool (left sidebar) → Install Dependencies if the run fails.\n'
            : '\n[Spring Boot] Starting…\n'
          : '\n';
      get().append('system', `Running ${tab.name} (${detect.label})…${springHint}`);

      const result = await api.runStart({
        filePath: tab.path,
        cwd,
      });
      set({ runId: result.runId, lastCommand: result.command });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ isRunning: false, error: message, runId: null });
      get().append('system', `Error: ${message}\n`);
      get().reparseDiagnostics();
    }
  },

  rerun: async () => {
    get().ensureSubscribed();

    // Stop current process if still running
    if (get().isRunning) {
      try {
        await requireApi().runStop({ runId: get().runId ?? undefined });
      } catch {
        // ignore
      }
      set({ isRunning: false, runId: null });
      get().append('system', '\n[Rerun — restarting…]\n');
      // Brief pause so the OS releases the previous process (Windows)
      await new Promise((r) => setTimeout(r, 80));
    }

    const editor = useEditorStore.getState();
    const lastPath = get().lastFilePath;
    const active = editor.getActiveTab();

    // Prefer active file; fall back to last run path (focus that tab if open)
    if (lastPath && active?.path !== lastPath) {
      const openTab = editor.tabs.find((t) => t.path === lastPath);
      if (openTab) {
        editor.setActiveTab(openTab.id);
      }
    }

    // If nothing runnable is focused but we have a last path, try open it
    const tab = editor.getActiveTab();
    if ((!tab || tab.path.startsWith('untitled:')) && lastPath) {
      try {
        await editor.openFile(lastPath, false);
      } catch {
        set({ error: 'Nothing to re-run — open a file first' });
        return;
      }
    }

    await get().runActiveFile();
  },

  stop: async () => {
    try {
      // Main process kills process tree + frees ports (and logs when a run was active)
      const result = await requireApi().runStop({ runId: get().runId ?? undefined });
      set({ isRunning: false, runId: null });
      // If nothing was "active" but ports were freed (orphaned java), show it here
      if (
        result &&
        typeof result === 'object' &&
        Array.isArray(result.freedPorts) &&
        result.freedPorts.length > 0 &&
        !result.message?.includes('Killed')
      ) {
        get().append(
          'system',
          `\n[Stopped] Freed leftover port(s): ${result.freedPorts.join(', ')} — safe to Run again.\n`,
        );
      }
    } catch {
      set({ isRunning: false, runId: null });
      get().append('system', '\n[Stopped]\n');
    }
  },

  sendInput: async (text) => {
    const payload = text.endsWith('\n') ? text : `${text}\n`;
    const runId = get().runId ?? undefined;
    try {
      await requireApi().runWrite({ runId, data: payload });
      // Echo is also emitted from main; avoid double-append if event arrives.
      // Local echo only if not running under electron event (browser stub).
      if (!window.terminalIde) {
        get().append('stdin', payload);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      get().append('system', `Input error: ${message}\n`);
    }
  },
}));