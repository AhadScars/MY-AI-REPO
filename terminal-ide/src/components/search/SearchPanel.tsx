import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, Replace, CaseSensitive } from 'lucide-react';
import { useIndexingStore } from '../../stores/indexingStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEditorStore } from '../../stores/editorStore';
import { useDiagnosticsStore } from '../../stores/diagnosticsStore';
import { useSearchHighlightStore } from '../../stores/searchHighlightStore';
import { requireApi } from '../../services/platform';
import { basename } from '../../../packages/shared/src/path';
import { emitEditorCommand } from '../../features/editor/editorCommands';
import { cn } from '../../utils/cn';

/** Show the matched snippet with the query emphasized in the result list. */
function highlightPreview(line: string, query: string, caseSensitive: boolean): ReactNode {
  const q = query.trim();
  if (!q) return line.slice(0, 200);
  const hay = caseSensitive ? line : line.toLowerCase();
  const needle = caseSensitive ? q : q.toLowerCase();
  const idx = hay.indexOf(needle);
  if (idx < 0) return line.slice(0, 200);
  const before = line.slice(0, idx);
  const match = line.slice(idx, idx + q.length);
  const after = line.slice(idx + q.length, 200);
  return (
    <>
      {before}
      <mark className="rounded-sm bg-yellow-500/40 text-ide-text">{match}</mark>
      {after}
    </>
  );
}

/**
 * Workspace search + find/replace panel (Search activity view).
 */
export function SearchPanel() {
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const searchQuery = useIndexingStore((s) => s.searchQuery);
  const searchResults = useIndexingStore((s) => s.searchResults);
  const isSearching = useIndexingStore((s) => s.isSearching);
  const isIndexing = useIndexingStore((s) => s.isIndexing);
  const chunkCount = useIndexingStore((s) => s.chunkCount);
  const indexProgress = useIndexingStore((s) => s.progress);
  const error = useIndexingStore((s) => s.error);
  const searchIndex = useIndexingStore((s) => s.search);
  const startIndexing = useIndexingStore((s) => s.startIndexing);
  const openFile = useEditorStore((s) => s.openFile);
  const requestReveal = useDiagnosticsStore((s) => s.requestReveal);

  const [searchText, setSearchText] = useState(searchQuery);
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [semantic, setSemantic] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Focus when panel mounts / search view opens
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  // Debounced live search + keep editor highlights in sync with the query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void searchIndex(searchText, semantic, caseSensitive);
      const q = searchText.trim();
      if (q) {
        useSearchHighlightStore.getState().setQuery(q, caseSensitive);
      } else {
        useSearchHighlightStore.getState().clear();
      }
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText, semantic, caseSensitive, searchIndex]);

  const openResult = async (filePath: string, line: number) => {
    const q = searchText.trim();
    // Verify the reported line still contains the query (skip stale / false hits)
    let targetLine = line;
    let column = 1;
    try {
      const tab = useEditorStore.getState().findTabByPath(filePath);
      let content = tab?.content;
      if (content == null) {
        const read = await requireApi().readFile({ path: filePath });
        content = read.content;
      }
      const lines = content.split(/\r?\n/);
      const qCheck = caseSensitive ? q : q.toLowerCase();
      const at = lines[line - 1] ?? '';
      const atCheck = caseSensitive ? at : at.toLowerCase();
      if (q && !atCheck.includes(qCheck)) {
        // Find first real occurrence in file
        let found = -1;
        for (let i = 0; i < lines.length; i++) {
          const hay = caseSensitive ? (lines[i] ?? '') : (lines[i] ?? '').toLowerCase();
          if (hay.includes(qCheck)) {
            found = i + 1;
            column = hay.indexOf(qCheck) + 1;
            break;
          }
        }
        if (found < 0) {
          setStatus(`“${q}” not found in ${basename(filePath)} (result was outdated).`);
          // Refresh results
          void searchIndex(searchText, semantic, caseSensitive);
          return;
        }
        targetLine = found;
        setStatus(null);
      } else if (q) {
        column = atCheck.indexOf(qCheck) + 1;
        setStatus(null);
      }
    } catch {
      // open anyway
    }

    if (q) {
      useSearchHighlightStore.getState().highlightAndFocus({
        query: q,
        caseSensitive,
        path: filePath,
        line: targetLine,
        column,
      });
    }
    await openFile(filePath, false);
    window.setTimeout(() => {
      requestReveal(filePath, targetLine, column);
    }, 80);
  };

  const replaceInActiveFile = () => {
    const find = searchText;
    if (!find) return;
    const tab = useEditorStore.getState().getActiveTab();
    if (!tab) {
      setStatus('Open a file first to replace in the current editor.');
      return;
    }
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const re = new RegExp(escaped, flags);
      const next = tab.content.replace(re, replaceText);
      const count = (tab.content.match(re) ?? []).length;
      if (count === 0) {
        setStatus('No matches in the active file.');
        return;
      }
      useEditorStore.getState().updateContent(tab.id, next);
      setStatus(`Replaced ${count} occurrence(s) in ${tab.name}. Save with Ctrl+S.`);
    } catch {
      setStatus('Invalid search pattern.');
    }
  };

  const replaceInWorkspace = async () => {
    const find = searchText.trim();
    if (!find || !rootPath) {
      setStatus('Enter a search term and open a folder.');
      return;
    }
    if (searchResults.length === 0) {
      setStatus('No search results to replace. Search first.');
      return;
    }

    const ok = window.confirm(
      `Replace all occurrences of "${find}" with "${replaceText}" in files from the current search results? This cannot be undone easily.`,
    );
    if (!ok) return;

    setReplacing(true);
    setStatus('Replacing…');
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let re: RegExp;
    try {
      re = new RegExp(escaped, flags);
    } catch {
      setStatus('Invalid search pattern.');
      setReplacing(false);
      return;
    }

    const files = [...new Set(searchResults.map((r) => r.chunk.path))];
    let filesChanged = 0;
    let totalReplacements = 0;
    const api = requireApi();

    for (const filePath of files) {
      try {
        // Prefer in-memory open tab content
        const openTab = useEditorStore.getState().findTabByPath(filePath);
        let content = openTab?.content;
        if (content == null) {
          const read = await api.readFile({ path: filePath });
          content = read.content;
        }
        const matches = content.match(re);
        if (!matches || matches.length === 0) continue;
        const next = content.replace(re, replaceText);
        totalReplacements += matches.length;
        filesChanged += 1;

        if (openTab) {
          useEditorStore.getState().updateContent(openTab.id, next);
          // Also write to disk for open dirty tabs so workspace stays consistent
          if (!filePath.startsWith('untitled:')) {
            await api.writeFile({ path: filePath, content: next });
            useEditorStore.getState().markSaved(openTab.id, next);
          }
        } else {
          await api.writeFile({ path: filePath, content: next });
        }
      } catch (err) {
        console.error('Replace failed for', filePath, err);
      }
    }

    setReplacing(false);
    setStatus(
      filesChanged === 0
        ? 'No replacements made.'
        : `Replaced ${totalReplacements} occurrence(s) in ${filesChanged} file(s).`,
    );
    // Refresh search hits
    void searchIndex(searchText, semantic, caseSensitive);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ide-border p-2">
        <div className="mb-1.5 flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <Search
              size={12}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ide-muted"
            />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search in workspace…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void searchIndex(searchText, semantic, caseSensitive);
              }}
              className="w-full rounded-sm border border-ide-border bg-ide-bg py-1 pl-7 pr-2 text-ide-sm text-ide-text outline-none focus:border-ide-accent"
            />
          </div>
          <button
            type="button"
            title="Toggle replace"
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-sm hover:bg-ide-elevated',
              showReplace ? 'bg-ide-elevated text-ide-accent' : 'text-ide-muted',
            )}
            onClick={() => setShowReplace((v) => !v)}
          >
            <Replace size={14} />
          </button>
        </div>

        {showReplace && (
          <div className="mb-1.5">
            <input
              type="text"
              placeholder="Replace with…"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="mb-1.5 w-full rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm text-ide-text outline-none focus:border-ide-accent"
            />
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded-sm bg-ide-elevated px-2 py-0.5 text-ide-xs text-ide-text hover:bg-ide-border"
                onClick={replaceInActiveFile}
                disabled={!searchText.trim()}
              >
                Replace in file
              </button>
              <button
                type="button"
                className="rounded-sm bg-ide-accent px-2 py-0.5 text-ide-xs text-white hover:bg-ide-accent-hover disabled:opacity-40"
                onClick={() => void replaceInWorkspace()}
                disabled={!searchText.trim() || replacing || searchResults.length === 0}
              >
                {replacing ? 'Replacing…' : 'Replace in results'}
              </button>
            </div>
          </div>
        )}

        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="Match case"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-sm',
              caseSensitive ? 'bg-ide-elevated text-ide-accent' : 'text-ide-muted hover:bg-ide-elevated',
            )}
            onClick={() => setCaseSensitive((v) => !v)}
          >
            <CaseSensitive size={14} />
          </button>
          <label className="flex items-center gap-1 text-ide-xs text-ide-muted">
            <input
              type="checkbox"
              checked={semantic}
              onChange={(e) => setSemantic(e.target.checked)}
            />
            Semantic
          </label>
          <button
            type="button"
            className="rounded-sm bg-ide-accent px-2 py-0.5 text-ide-xs text-white"
            onClick={() => void searchIndex(searchText, semantic, caseSensitive)}
          >
            {isSearching ? '…' : 'Search'}
          </button>
          <button
            type="button"
            className="rounded-sm px-2 py-0.5 text-ide-xs text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
            title="Find in current file (Ctrl+F)"
            onClick={() => emitEditorCommand('find')}
          >
            Find in file
          </button>
          <button
            type="button"
            className="rounded-sm px-2 py-0.5 text-ide-xs text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
            title="Replace in current file (Ctrl+H)"
            onClick={() => emitEditorCommand('replace')}
          >
            Replace in file
          </button>
        </div>

        <div className="flex items-center justify-between text-ide-xs text-ide-muted">
          <span>
            {searchResults.length > 0
              ? `${searchResults.length} result(s)`
              : `${chunkCount} chunks indexed`}
          </span>
          <button
            type="button"
            className="text-ide-accent hover:underline disabled:opacity-40"
            disabled={!rootPath || isIndexing}
            onClick={() => rootPath && void startIndexing(rootPath)}
          >
            {isIndexing ? 'Indexing…' : 'Reindex'}
          </button>
        </div>
        {indexProgress?.message && (
          <p className="mt-1 text-ide-xs text-ide-muted">{indexProgress.message}</p>
        )}
        {error && <p className="mt-1 text-ide-xs text-ide-danger">{error}</p>}
        {status && <p className="mt-1 text-ide-xs text-ide-accent">{status}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!rootPath && (
          <p className="p-3 text-ide-xs text-ide-muted">Open a folder to search the workspace.</p>
        )}
        {rootPath && searchResults.length === 0 && searchQuery && !isSearching && (
          <p className="p-3 text-ide-xs text-ide-muted">No results for “{searchQuery}”.</p>
        )}
        {searchResults.map((r) => (
          <button
            key={r.chunk.id}
            type="button"
            className="block w-full border-b border-ide-border px-2 py-1.5 text-left hover:bg-ide-elevated"
            onClick={() => void openResult(r.chunk.path, r.chunk.startLine)}
          >
            <div className="truncate text-ide-xs text-ide-text">
              {basename(r.chunk.path)}:{r.chunk.startLine}
              <span className="ml-1 text-ide-muted">{r.matchType}</span>
            </div>
            <div className="line-clamp-2 font-mono text-ide-xs text-ide-muted">
              {highlightPreview(r.chunk.content, searchQuery || searchText, caseSensitive)}
            </div>
          </button>
        ))}
        {rootPath && !searchQuery && (
          <p className="p-3 text-ide-xs text-ide-muted">
            Type to search code across the workspace. Use the replace toggle for bulk replace, or
            Ctrl+F / Ctrl+H for find/replace in the current file.
          </p>
        )}
      </div>
    </div>
  );
}
