import { Check, X, CheckCheck, Ban, FileDiff } from 'lucide-react';
import { useEditStore } from '../../stores/editStore';
import { cn } from '../../utils/cn';
import { basename } from '../../../packages/shared/src/path';

function unifiedDiff(original: string, proposed: string): string[] {
  const a = original.split(/\r?\n/);
  const b = proposed.split(/\r?\n/);
  // Simple line diff (not LCS) for review readability
  const lines: string[] = [];
  const max = Math.max(a.length, b.length);
  // Prefer showing as full replace when sizes differ a lot
  if (Math.abs(a.length - b.length) > 50 || a.join('\n') === '') {
    for (const l of a) lines.push(`- ${l}`);
    for (const l of b) lines.push(`+ ${l}`);
    return lines;
  }
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(`  ${a[i]}`);
      i += 1;
      j += 1;
    } else if (j < b.length && (i >= a.length || !a.slice(i, i + 3).includes(b[j]!))) {
      lines.push(`+ ${b[j]}`);
      j += 1;
    } else if (i < a.length) {
      lines.push(`- ${a[i]}`);
      i += 1;
    } else {
      break;
    }
    if (lines.length > 2000) {
      lines.push('  … diff truncated …');
      break;
    }
  }
  void max;
  return lines;
}

export function EditReviewPanel() {
  const proposals = useEditStore((s) => s.proposals);
  const selectedId = useEditStore((s) => s.selectedId);
  const panelOpen = useEditStore((s) => s.panelOpen);
  const isApplying = useEditStore((s) => s.isApplying);
  const error = useEditStore((s) => s.error);
  const select = useEditStore((s) => s.select);
  const closePanel = useEditStore((s) => s.closePanel);
  const apply = useEditStore((s) => s.apply);
  const applyAll = useEditStore((s) => s.applyAll);
  const reject = useEditStore((s) => s.reject);
  const rejectAll = useEditStore((s) => s.rejectAll);

  const pending = proposals.filter((p) => p.status === 'pending' || p.status === 'conflict');
  const selected = proposals.find((p) => p.id === selectedId) ?? pending[0] ?? null;

  if (!panelOpen || pending.length === 0) return null;

  const diffLines = selected
    ? unifiedDiff(selected.originalContent, selected.proposedContent)
    : [];

  return (
    <div className="flex h-64 shrink-0 flex-col border-t border-ide-border bg-ide-surface">
      <div className="flex h-8 items-center justify-between border-b border-ide-border px-2">
        <span className="flex items-center gap-1 text-ide-xs font-semibold uppercase tracking-wide text-ide-muted">
          <FileDiff size={14} />
          AI Edits ({pending.length})
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded-sm bg-ide-success/20 px-2 py-0.5 text-ide-xs text-ide-success hover:bg-ide-success/30"
            disabled={isApplying}
            onClick={() => void applyAll(false)}
          >
            <CheckCheck size={12} /> Accept all
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-sm bg-ide-danger/15 px-2 py-0.5 text-ide-xs text-ide-danger hover:bg-ide-danger/25"
            onClick={() => void rejectAll()}
          >
            <Ban size={12} /> Reject all
          </button>
          <button
            type="button"
            className="rounded-sm p-1 text-ide-muted hover:bg-ide-elevated"
            onClick={closePanel}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-ide-border px-2 py-1 text-ide-xs text-ide-danger">{error}</div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="w-56 shrink-0 overflow-auto border-r border-ide-border">
          {pending.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                'flex w-full flex-col items-start gap-0.5 border-b border-ide-border px-2 py-1.5 text-left text-ide-xs hover:bg-ide-elevated',
                selected?.id === p.id && 'bg-ide-selection',
              )}
              onClick={() => select(p.id)}
            >
              <span className="font-medium text-ide-text">{basename(p.path)}</span>
              <span className="truncate text-ide-muted w-full" title={p.path}>
                {p.path}
              </span>
              <span
                className={cn(
                  'uppercase',
                  p.status === 'conflict' ? 'text-ide-danger' : 'text-ide-warning',
                )}
              >
                {p.status}
              </span>
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-ide-border px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-ide-xs text-ide-muted">
                  {selected.description ?? selected.path}
                </span>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-sm bg-ide-accent px-2 py-0.5 text-ide-xs text-white"
                  disabled={isApplying}
                  onClick={() => void apply(selected.id, selected.status === 'conflict')}
                >
                  <Check size={12} />
                  {selected.status === 'conflict' ? 'Force accept' : 'Accept'}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-sm border border-ide-border px-2 py-0.5 text-ide-xs"
                  onClick={() => void reject(selected.id)}
                >
                  <X size={12} /> Reject
                </button>
              </div>
              <div
                className="selectable min-h-0 flex-1 overflow-auto font-mono text-ide-xs"
                data-selectable="true"
              >
                {diffLines.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      'whitespace-pre px-2 leading-5',
                      line.startsWith('+') && 'bg-green-900/30 text-ide-success',
                      line.startsWith('-') && 'bg-red-900/30 text-ide-danger',
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-3 text-ide-sm text-ide-muted">Select a proposal</div>
          )}
        </div>
      </div>
    </div>
  );
}
