import { useDiagnosticsStore } from '../../stores/diagnosticsStore';
import { useEditorStore } from '../../stores/editorStore';
import { useRunStore } from '../../stores/runStore';
import { cn } from '../../utils/cn';
import { basename } from '../../../packages/shared/src/path';

export function ProblemsPanel() {
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics);
  const clear = useDiagnosticsStore((s) => s.clear);
  const requestReveal = useDiagnosticsStore((s) => s.requestReveal);
  const openFile = useEditorStore((s) => s.openFile);
  const tabs = useEditorStore((s) => s.tabs);
  const clearOutput = useRunStore((s) => s.clearOutput);

  const goToProblem = async (path: string, line: number, column: number) => {
    const alreadyOpen = tabs.some(
      (t) => t.path === path || basename(t.path).toLowerCase() === basename(path).toLowerCase(),
    );
    if (!alreadyOpen) {
      // Prefer absolute path; if only basename, open matching tab if any
      const match = tabs.find(
        (t) => basename(t.path).toLowerCase() === basename(path).toLowerCase(),
      );
      if (match) {
        useEditorStore.getState().setActiveTab(match.id);
        requestReveal(match.path, line, column);
        return;
      }
      try {
        await openFile(path, false);
      } catch {
        // path from compiler may be relative/basename only
      }
    } else {
      const match =
        tabs.find((t) => t.path === path) ??
        tabs.find((t) => basename(t.path).toLowerCase() === basename(path).toLowerCase());
      if (match) useEditorStore.getState().setActiveTab(match.id);
    }
    const active = useEditorStore.getState().getActiveTab();
    const revealPath = active?.path ?? path;
    requestReveal(revealPath, line, column);
  };

  if (diagnostics.length === 0) {
    return (
      <div className="p-3 text-ide-sm text-ide-muted">
        No problems. Run a file (F5) or use the terminal — compile/runtime errors appear here and
        as red underlines in the editor. Hover an underline to see the full message.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 items-center justify-between border-b border-ide-border px-2">
        <span className="text-ide-xs text-ide-muted">{diagnostics.length} problem(s)</span>
        <button
          type="button"
          className="text-ide-xs text-ide-muted hover:text-ide-text"
          onClick={() => {
            clear();
            clearOutput();
          }}
        >
          Clear
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {diagnostics.map((d, i) => (
          <button
            key={`${d.path}:${d.line}:${d.message}:${i}`}
            type="button"
            className="flex w-full items-start gap-2 border-b border-ide-border px-2 py-1.5 text-left text-ide-sm hover:bg-ide-elevated"
            onClick={() => void goToProblem(d.path, d.line, d.column)}
            title={`${d.path}:${d.line} — ${d.message}`}
          >
            <span
              className={cn(
                'mt-0.5 shrink-0 text-ide-xs font-semibold uppercase',
                d.severity === 'error' && 'text-ide-danger',
                d.severity === 'warning' && 'text-ide-warning',
                d.severity === 'info' && 'text-ide-accent',
              )}
            >
              {d.severity === 'error' ? 'E' : d.severity === 'warning' ? 'W' : 'I'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ide-text">{d.message}</span>
              <span className="mt-0.5 block text-ide-xs text-ide-muted">
                {basename(d.path)}:{d.line}
                {d.column > 1 ? `:${d.column}` : ''}
                {d.source ? ` · ${d.source}` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}