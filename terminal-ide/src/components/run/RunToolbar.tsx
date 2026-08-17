import { Play, Square, RotateCw, Database, Globe } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useRunStore } from '../../stores/runStore';
import { useSqlStore } from '../../stores/sqlStore';
import { useBrowserStore } from '../../stores/browserStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { cn } from '../../utils/cn';

function isSqlTab(tab: { path: string; language?: string } | null): boolean {
  if (!tab) return false;
  if (tab.language === 'sql') return true;
  return /\.sql$/i.test(tab.path);
}

function isHtmlTab(tab: { path: string; language?: string } | null): boolean {
  if (!tab || tab.path.startsWith('untitled:')) return false;
  if (tab.language === 'html') return true;
  return /\.html?$/i.test(tab.path);
}

/**
 * Run / Preview toolbar.
 * HTML → built-in browser · SQL → query · else → run program.
 */
export function RunToolbar() {
  const activeTab = useEditorStore((s) => s.getActiveTab());
  const isRunning = useRunStore((s) => s.isRunning);
  const sqlRunning = useSqlStore((s) => s.isRunning);
  const lastFilePath = useRunStore((s) => s.lastFilePath);
  const lastCommand = useRunStore((s) => s.lastCommand);
  const runActiveFile = useRunStore((s) => s.runActiveFile);
  const rerun = useRunStore((s) => s.rerun);
  const stop = useRunStore((s) => s.stop);
  const runActiveSql = useSqlStore((s) => s.runActiveSql);
  const dbPath = useSqlStore((s) => s.dbPath);
  const openDatabase = useSqlStore((s) => s.openDatabase);
  const openHtmlFile = useBrowserStore((s) => s.openHtmlFile);

  const sqlMode = isSqlTab(activeTab);
  const htmlMode = isHtmlTab(activeTab);
  const busy = sqlMode ? sqlRunning : isRunning;
  const canRun = sqlMode
    ? Boolean(activeTab)
    : htmlMode
      ? Boolean(activeTab)
      : Boolean(activeTab && !activeTab.path.startsWith('untitled:'));
  const canRerun = sqlMode
    ? Boolean(activeTab)
    : htmlMode
      ? Boolean(activeTab)
      : Boolean(
          lastFilePath || lastCommand || (activeTab && !activeTab.path.startsWith('untitled:')),
        );

  const onRun = () => {
    if (sqlMode) void runActiveSql();
    else if (htmlMode && activeTab) void openHtmlFile(activeTab.path);
    else void runActiveFile();
  };

  const onRerun = () => {
    if (sqlMode) void runActiveSql();
    else if (htmlMode && activeTab) void openHtmlFile(activeTab.path);
    else void rerun();
  };

  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-l border-ide-border bg-ide-surface px-1">
      {sqlMode && (
        <button
          type="button"
          onClick={() => {
            useLayoutStore.getState().setActivityView('database');
            if (!dbPath) void openDatabase();
          }}
          className={cn(
            'inline-flex h-6 max-w-[9rem] items-center gap-1 truncate rounded-md px-1.5 text-ide-xs',
            dbPath
              ? 'text-ide-accent hover:bg-ide-elevated'
              : 'text-ide-warning hover:bg-ide-elevated',
          )}
          title={dbPath ? `Database: ${dbPath}` : 'Open SQLite database'}
        >
          <Database size={12} />
          <span className="truncate">{dbPath ? 'DB' : 'Open DB'}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onRun}
        disabled={!canRun || (sqlMode && busy) || (busy && !sqlMode && !htmlMode)}
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-md',
          canRun && !(sqlMode && busy) && !(busy && !sqlMode && !htmlMode)
            ? htmlMode
              ? 'text-ide-accent hover:bg-ide-elevated'
              : 'text-ide-success hover:bg-ide-elevated'
            : 'cursor-not-allowed text-ide-muted/35',
        )}
        title={
          sqlMode
            ? dbPath
              ? 'Run SQL (F5)'
              : 'Open a database first, then Run SQL (F5)'
            : htmlMode
              ? 'Open in built-in browser (F5)'
              : busy
                ? 'Stop the process first, then Run'
                : canRun
                  ? 'Run (F5) — Java/Spring Boot, Python, Node, and more'
                  : activeTab?.path.startsWith('untitled:')
                    ? 'Save the file first (Ctrl+S), then Run'
                    : 'Open a file to run'
        }
        aria-label={htmlMode ? 'Preview' : 'Run'}
      >
        {htmlMode ? (
          <Globe size={14} strokeWidth={2} />
        ) : (
          <Play size={14} fill="currentColor" strokeWidth={0} />
        )}
      </button>

      {/* Always-visible stop — kills process tree + frees ports (e.g. 8081) */}
      {!sqlMode && !htmlMode && (
        <button
          type="button"
          onClick={() => void stop()}
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-ide-xs',
            busy
              ? 'bg-ide-danger/15 text-ide-danger hover:bg-ide-danger/25'
              : 'text-ide-muted hover:bg-ide-elevated hover:text-ide-danger',
          )}
          title="Stop process (Shift+F5) — kill server and free ports"
          aria-label="Stop process"
        >
          <Square size={11} fill="currentColor" strokeWidth={0} />
          <span className="hidden sm:inline">Stop</span>
        </button>
      )}

      <button
        type="button"
        onClick={onRerun}
        disabled={!canRerun && !busy}
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-md',
          canRerun || busy
            ? 'text-ide-muted hover:bg-ide-elevated hover:text-ide-text'
            : 'cursor-not-allowed text-ide-muted/35',
        )}
        title={
          sqlMode
            ? 'Run SQL again (Ctrl+F5)'
            : busy
              ? 'Rerun — stop and start again (Ctrl+F5)'
              : canRerun
                ? 'Rerun last program (Ctrl+F5)'
                : 'Run a file first, then Rerun'
        }
        aria-label="Rerun"
      >
        <RotateCw size={13} strokeWidth={2} />
      </button>
    </div>
  );
}
