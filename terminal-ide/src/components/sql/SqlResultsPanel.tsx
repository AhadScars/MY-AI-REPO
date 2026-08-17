import { useSqlStore } from '../../stores/sqlStore';
import { basename } from '../../../packages/shared/src/path';
import { cn } from '../../utils/cn';

function cellText(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/**
 * Bottom-panel SQL results: result grids + status for the open database.
 */
export function SqlResultsPanel() {
  const dbPath = useSqlStore((s) => s.dbPath);
  const results = useSqlStore((s) => s.results);
  const lastError = useSqlStore((s) => s.lastError);
  const lastMessage = useSqlStore((s) => s.lastMessage);
  const isRunning = useSqlStore((s) => s.isRunning);
  const durationMs = useSqlStore((s) => s.durationMs);

  const dataSets = results.filter((r) => r.columns.length > 0);
  const mutations = results.filter((r) => r.changes != null && r.columns.length === 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-ide-panel">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ide-border/60 px-3 py-1.5 text-ide-xs">
        <span className="text-ide-muted">Connection</span>
        <span className="truncate text-ide-text" title={dbPath ?? undefined}>
          {dbPath ? (dbPath.includes('/') || dbPath.includes('\\') ? basename(dbPath) : dbPath) : '— none —'}
        </span>
        {isRunning && <span className="text-ide-accent">Running…</span>}
        {durationMs != null && !isRunning && (
          <span className="text-ide-muted">{durationMs}ms</span>
        )}
        {lastMessage && !lastError && (
          <span className="truncate text-ide-success">{lastMessage}</span>
        )}
        {lastError && (
          <span className="truncate text-ide-danger" title={lastError}>
            {lastError}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!dbPath && (
          <p className="px-2 py-3 text-ide-sm text-ide-muted">
            Open a SQLite database from the <strong className="text-ide-text">Database</strong> side
            panel, then open a <code className="text-ide-accent">.sql</code> file and press{' '}
            <kbd className="rounded border border-ide-border px-1">F5</kbd> or use Run.
          </p>
        )}

        {dbPath && dataSets.length === 0 && mutations.length === 0 && !lastError && (
          <p className="px-2 py-3 text-ide-sm text-ide-muted">
            Run SQL from the editor (whole file or selection). Results appear here.
          </p>
        )}

        {mutations.map((r, i) => (
          <div key={`m-${i}`} className="mb-2 px-2 text-ide-sm text-ide-muted">
            Statement changed <span className="text-ide-text">{r.changes}</span> row(s)
            {r.lastInsertRowid != null && r.lastInsertRowid > 0 && (
              <>
                {' '}
                · last_insert_rowid=<span className="text-ide-text">{r.lastInsertRowid}</span>
              </>
            )}
          </div>
        ))}

        {dataSets.map((set, idx) => (
          <div key={`s-${idx}`} className="mb-4 overflow-auto rounded-md border border-ide-border">
            <div className="border-b border-ide-border bg-ide-surface px-2 py-1 text-ide-xs text-ide-muted">
              Result {idx + 1} · {set.rows.length} row(s)
              {set.truncated ? ' (truncated)' : ''}
            </div>
            <table className="w-full min-w-max border-collapse text-left text-ide-xs">
              <thead className="sticky top-0 bg-ide-elevated">
                <tr>
                  <th className="border-b border-ide-border px-2 py-1 font-medium text-ide-muted">
                    #
                  </th>
                  {set.columns.map((c) => (
                    <th
                      key={c}
                      className="border-b border-ide-border px-2 py-1 font-medium text-ide-text"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {set.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={cn(
                      'hover:bg-ide-elevated/60',
                      ri % 2 === 1 && 'bg-ide-surface/40',
                    )}
                  >
                    <td className="border-b border-ide-border/40 px-2 py-0.5 text-ide-muted">
                      {ri + 1}
                    </td>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={cn(
                          'max-w-[28rem] truncate border-b border-ide-border/40 px-2 py-0.5 font-mono text-ide-text',
                          (cell === null || cell === undefined) && 'italic text-ide-muted',
                        )}
                        title={cellText(cell)}
                      >
                        {cellText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
                {set.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={set.columns.length + 1}
                      className="px-2 py-3 text-ide-muted"
                    >
                      No rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
