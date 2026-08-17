import { create } from 'zustand';
import type { EditorDiagnostic } from '../../packages/types/src/editor';
import {
  parseDiagnosticsFromOutput,
  stripAnsi,
  diagnosticMatchesPath,
} from '../features/run/parseDiagnostics';
import { useEditorStore } from './editorStore';

const TERMINAL_BUFFER_MAX = 80_000;
const TERMINAL_PARSE_DEBOUNCE_MS = 350;

export interface RevealRequest {
  path: string;
  line: number;
  column: number;
  token: number;
}

interface DiagnosticsState {
  /** Combined run + terminal diagnostics (for UI / markers). */
  diagnostics: EditorDiagnostic[];
  runDiagnostics: EditorDiagnostic[];
  terminalDiagnostics: EditorDiagnostic[];
  sourceFile: string | null;
  /** Last N chars of stripped terminal output, per session. */
  terminalBuffers: Record<string, string>;
  revealRequest: RevealRequest | null;

  setFromOutput: (output: string, sourceFile?: string | null) => void;
  ingestTerminalData: (sessionId: string, data: string) => void;
  clear: () => void;
  clearRun: () => void;
  /** Remove all diagnostics for a file (e.g. after user edits / fixes code). */
  clearForPath: (editorPath: string) => void;
  /**
   * After a text edit: drop markers on the changed lines and shift remaining
   * line numbers when lines were inserted or deleted.
   */
  applyEditToPath: (
    editorPath: string,
    edit: {
      startLine: number;
      endLine: number;
      /** How many lines the change spans after the edit (1 = single line, no newline). */
      newLineCount: number;
    },
  ) => void;
  forPath: (editorPath: string) => EditorDiagnostic[];
  requestReveal: (path: string, line: number, column?: number) => void;
  clearReveal: () => void;
}

let terminalParseTimer: ReturnType<typeof setTimeout> | null = null;
let revealToken = 0;

function mergeDiagnostics(
  run: EditorDiagnostic[],
  terminal: EditorDiagnostic[],
): EditorDiagnostic[] {
  const seen = new Set<string>();
  const out: EditorDiagnostic[] = [];
  for (const d of [...run, ...terminal]) {
    const key = `${d.path}|${d.line}|${d.column}|${d.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set, get) => ({
  diagnostics: [],
  runDiagnostics: [],
  terminalDiagnostics: [],
  sourceFile: null,
  terminalBuffers: {},
  revealRequest: null,

  setFromOutput: (output, sourceFile = null) => {
    const runDiagnostics = parseDiagnosticsFromOutput(output, sourceFile, 'run');
    const diagnostics = mergeDiagnostics(runDiagnostics, get().terminalDiagnostics);
    set({ runDiagnostics, diagnostics, sourceFile: sourceFile ?? null });
  },

  ingestTerminalData: (sessionId, data) => {
    const plain = stripAnsi(data);
    if (!plain) return;

    const prev = get().terminalBuffers[sessionId] ?? '';
    let next = prev + plain;
    if (next.length > TERMINAL_BUFFER_MAX) {
      next = next.slice(-TERMINAL_BUFFER_MAX);
    }
    set({
      terminalBuffers: { ...get().terminalBuffers, [sessionId]: next },
    });

    if (terminalParseTimer) clearTimeout(terminalParseTimer);
    terminalParseTimer = setTimeout(() => {
      terminalParseTimer = null;
      const buf = get().terminalBuffers[sessionId] ?? '';
      // Only re-parse when output looks like it may contain errors
      if (
        !/(error|Error|Exception|warning|Warning|:\d+:|\.java:|\.py:|\.js:|\.ts:|\.c:|\.go:|Traceback)/.test(
          buf.slice(-4000),
        )
      ) {
        return;
      }
      const active = useEditorStore.getState().getActiveTab();
      const primary =
        active && !active.path.startsWith('untitled:') ? active.path : get().sourceFile;
      const terminalDiagnostics = parseDiagnosticsFromOutput(buf, primary, 'terminal');
      // Keep only the most recent errors (avoid flooding from long sessions)
      const capped = terminalDiagnostics.slice(-100);
      set({
        terminalDiagnostics: capped,
        diagnostics: mergeDiagnostics(get().runDiagnostics, capped),
        sourceFile: primary ?? get().sourceFile,
      });
    }, TERMINAL_PARSE_DEBOUNCE_MS);
  },

  clear: () =>
    set({
      diagnostics: [],
      runDiagnostics: [],
      terminalDiagnostics: [],
      sourceFile: null,
      terminalBuffers: {},
    }),

  clearRun: () => {
    set({
      runDiagnostics: [],
      diagnostics: mergeDiagnostics([], get().terminalDiagnostics),
    });
  },

  clearForPath: (editorPath) => {
    const keep = (d: EditorDiagnostic) => !diagnosticMatchesPath(d.path, editorPath);
    const runDiagnostics = get().runDiagnostics.filter(keep);
    const terminalDiagnostics = get().terminalDiagnostics.filter(keep);
    set({
      runDiagnostics,
      terminalDiagnostics,
      diagnostics: mergeDiagnostics(runDiagnostics, terminalDiagnostics),
    });
  },

  applyEditToPath: (editorPath, edit) => {
    const { startLine, endLine, newLineCount } = edit;
    const oldLineCount = Math.max(1, endLine - startLine + 1);
    const lineDelta = newLineCount - oldLineCount;

    const mapList = (list: EditorDiagnostic[]): EditorDiagnostic[] => {
      const next: EditorDiagnostic[] = [];
      for (const d of list) {
        if (!diagnosticMatchesPath(d.path, editorPath)) {
          next.push(d);
          continue;
        }
        // Remove markers on the edited lines — fixing the problem clears the red line
        if (d.line >= startLine && d.line <= endLine) {
          continue;
        }
        // Keep other markers; shift line numbers if lines were inserted/deleted above
        if (d.line > endLine && lineDelta !== 0) {
          next.push({
            ...d,
            line: Math.max(1, d.line + lineDelta),
            endLine:
              d.endLine != null ? Math.max(1, d.endLine + lineDelta) : d.endLine,
          });
          continue;
        }
        next.push(d);
      }
      return next;
    };

    const prev = get().diagnostics;
    const runDiagnostics = mapList(get().runDiagnostics);
    const terminalDiagnostics = mapList(get().terminalDiagnostics);
    const diagnostics = mergeDiagnostics(runDiagnostics, terminalDiagnostics);

    const unchanged =
      diagnostics.length === prev.length &&
      lineDelta === 0 &&
      diagnostics.every(
        (d, i) =>
          d.line === prev[i]?.line &&
          d.column === prev[i]?.column &&
          d.message === prev[i]?.message &&
          d.path === prev[i]?.path,
      );
    if (unchanged) return;

    set({
      runDiagnostics,
      terminalDiagnostics,
      diagnostics,
    });
  },

  forPath: (editorPath) => {
    return get().diagnostics.filter((d) => diagnosticMatchesPath(d.path, editorPath));
  },

  requestReveal: (path, line, column = 1) => {
    revealToken += 1;
    set({
      revealRequest: { path, line, column, token: revealToken },
    });
  },

  clearReveal: () => set({ revealRequest: null }),
}));
