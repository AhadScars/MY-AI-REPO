import { X } from 'lucide-react';
import type { GitDiffResult } from '../../../packages/protocol/src/git';
import { cn } from '../../utils/cn';

interface DiffViewerProps {
  diff: GitDiffResult;
  onClose: () => void;
}

export function DiffViewer({ diff, onClose }: DiffViewerProps) {
  if (diff.isBinary) {
    return (
      <div className="flex h-full flex-col border-t border-ide-border bg-ide-bg">
        <DiffHeader path={diff.path} staged={diff.staged} onClose={onClose} />
        <div className="p-3 text-ide-sm text-ide-muted">Binary file — diff not shown.</div>
      </div>
    );
  }

  const lines = diff.diff.split(/\r?\n/);

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-ide-border bg-ide-bg">
      <DiffHeader path={diff.path} staged={diff.staged} onClose={onClose} />
      <div className="selectable min-h-0 flex-1 overflow-auto font-mono text-ide-xs" data-selectable="true">
        {lines.length === 0 || (lines.length === 1 && !lines[0]) ? (
          <div className="p-3 text-ide-muted">No differences</div>
        ) : (
          lines.map((line, i) => {
            let cls = 'text-ide-text';
            if (line.startsWith('+') && !line.startsWith('+++')) cls = 'bg-green-900/30 text-ide-success';
            else if (line.startsWith('-') && !line.startsWith('---')) cls = 'bg-red-900/30 text-ide-danger';
            else if (line.startsWith('@@')) cls = 'text-ide-accent';
            else if (line.startsWith('diff ') || line.startsWith('index ')) cls = 'text-ide-muted';
            return (
              <div key={i} className={cn('whitespace-pre px-2 leading-5', cls)}>
                {line || ' '}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DiffHeader({
  path,
  staged,
  onClose,
}: {
  path: string;
  staged: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-b border-ide-border px-2">
      <span className="truncate text-ide-xs text-ide-muted">
        {staged ? 'Staged' : 'Working tree'} · {path}
      </span>
      <button
        type="button"
        className="rounded-sm p-0.5 text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
        onClick={onClose}
        aria-label="Close diff"
      >
        <X size={14} />
      </button>
    </div>
  );
}
