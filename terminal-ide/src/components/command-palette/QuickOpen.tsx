import { useEffect, useRef, useState } from 'react';
import { File } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEditorStore } from '../../stores/editorStore';
import { basename, normalizePath } from '../../../packages/shared/src/path';
import { cn } from '../../utils/cn';

export function QuickOpen() {
  const open = useLayoutStore((s) => s.quickOpenOpen);
  const close = useLayoutStore((s) => s.closeQuickOpen);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const fileIndex = useWorkspaceStore((s) => s.fileIndex);
  const fileIndexLoading = useWorkspaceStore((s) => s.fileIndexLoading);
  const searchFiles = useWorkspaceStore((s) => s.searchFiles);
  const buildFileIndex = useWorkspaceStore((s) => s.buildFileIndex);
  const openFile = useEditorStore((s) => s.openFile);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recompute when query or index changes (searchFiles reads live store state)
  const results = fileIndex && searchFiles(query, 80);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      if (rootPath && fileIndex.length === 0 && !fileIndexLoading) {
        void buildFileIndex();
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, rootPath, fileIndex.length, fileIndexLoading, buildFileIndex]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (!open) return null;

  const toRelative = (path: string) => {
    if (!rootPath) return path;
    const n = normalizePath(path);
    const r = normalizePath(rootPath);
    if (n.toLowerCase().startsWith(r.toLowerCase())) {
      return n.slice(r.length).replace(/^\//, '');
    }
    return path;
  };

  const choose = (path: string) => {
    close();
    void openFile(path, false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const path = results[selected];
      if (path) choose(path);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" role="dialog">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close quick open"
        onClick={close}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-md border border-ide-border bg-ide-surface shadow-2xl">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={rootPath ? 'Go to file…' : 'Open a folder first to search files'}
          className="w-full border-b border-ide-border bg-transparent px-4 py-3 text-ide-md text-ide-text outline-none placeholder:text-ide-muted"
          aria-label="Quick open"
          disabled={!rootPath}
        />
        <ul className="max-h-96 overflow-auto py-1" role="listbox">
          {!rootPath && (
            <li className="px-4 py-3 text-ide-sm text-ide-muted">No workspace open</li>
          )}
          {rootPath && fileIndexLoading && fileIndex.length === 0 && (
            <li className="px-4 py-3 text-ide-sm text-ide-muted">Indexing files…</li>
          )}
          {rootPath && !fileIndexLoading && results.length === 0 && (
            <li className="px-4 py-3 text-ide-sm text-ide-muted">No matching files</li>
          )}
          {results.map((path, i) => {
            const name = basename(path);
            const rel = toRelative(path);
            return (
              <li key={path} role="option" aria-selected={i === selected}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-1.5 text-left text-ide-sm',
                    i === selected ? 'bg-ide-accent text-white' : 'hover:bg-ide-elevated',
                  )}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => choose(path)}
                >
                  <File size={14} className="shrink-0 opacity-80" />
                  <span className="truncate font-medium">{name}</span>
                  <span
                    className={cn(
                      'ml-auto truncate text-ide-xs',
                      i === selected ? 'text-white/75' : 'text-ide-muted',
                    )}
                  >
                    {rel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {rootPath && (
          <div className="border-t border-ide-border px-3 py-1 text-ide-xs text-ide-muted">
            {fileIndex.length} files indexed · ↑↓ navigate · Enter open
          </div>
        )}
      </div>
    </div>
  );
}
