import { useEffect } from 'react';
import { RefreshCw, X, Cable, Unplug } from 'lucide-react';
import { useSqlStore } from '../../stores/sqlStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { XAMPP_MYSQL_DEFAULTS } from '../../../packages/protocol/src/sql';
import { IconButton } from '../common/IconButton';
import { DbExplorerTree } from './DbExplorerTree';

/**
 * Left sidebar: tables list + connect / disconnect.
 */
export function DatabasePanel() {
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const engineType = useSqlStore((s) => s.engineType);
  const connectionLabel = useSqlStore((s) => s.connectionLabel);
  const mysql = useSqlStore((s) => s.mysql);
  const discovering = useSqlStore((s) => s.discovering);
  const lastError = useSqlStore((s) => s.lastError);
  const configDialogOpen = useSqlStore((s) => s.configDialogOpen);
  const refreshOpen = useSqlStore((s) => s.refreshOpen);
  const discoverProject = useSqlStore((s) => s.discoverProject);
  const refreshTables = useSqlStore((s) => s.refreshTables);
  const openConfigDialog = useSqlStore((s) => s.openConfigDialog);
  const closeDatabase = useSqlStore((s) => s.closeDatabase);
  const closeSidebar = useLayoutStore((s) => s.closeSidebar);

  useEffect(() => {
    void refreshOpen();
  }, [refreshOpen]);

  useEffect(() => {
    if (rootPath) void discoverProject(rootPath);
  }, [rootPath, discoverProject]);

  const openSettings = () => {
    openConfigDialog(
      mysql
        ? {
            ...XAMPP_MYSQL_DEFAULTS,
            host: mysql.host,
            port: mysql.port,
            user: mysql.user,
            database: mysql.database ?? '',
            password: mysql.password ?? '',
          }
        : { ...XAMPP_MYSQL_DEFAULTS },
    );
  };

  return (
    <div className="flex h-full flex-col bg-ide-sidebar">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-ide-border/50 px-3">
        <span className="ide-section-label shrink-0">Tables</span>
        {connectionLabel && (
          <span
            className="min-w-0 flex-1 truncate text-ide-xs text-ide-muted"
            title={connectionLabel}
          >
            {connectionLabel}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center">
          <IconButton
            label={engineType ? 'Connection settings' : 'Connect'}
            size="sm"
            onClick={openSettings}
          >
            <Cable size={13} className="text-ide-muted" />
          </IconButton>
          {engineType && (
            <IconButton
              label="Disconnect DB"
              size="sm"
              onClick={() => void closeDatabase()}
            >
              <Unplug size={13} className="text-ide-danger" />
            </IconButton>
          )}
          <IconButton
            label="Refresh"
            size="sm"
            onClick={() => {
              void refreshTables();
              if (rootPath) void discoverProject(rootPath);
            }}
          >
            <RefreshCw
              size={13}
              className={discovering ? 'animate-spin text-ide-muted' : 'text-ide-muted'}
            />
          </IconButton>
          <IconButton label="Close" size="sm" onClick={closeSidebar}>
            <X size={13} className="text-ide-muted" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {engineType ? (
          <>
            <DbExplorerTree />
            <div className="border-t border-ide-border/50 p-2">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-ide-danger/30 px-2 py-1.5 text-ide-xs text-ide-danger transition-colors hover:bg-ide-danger/10"
                onClick={() => void closeDatabase()}
              >
                <Unplug size={12} />
                Disconnect DB
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2 px-3 py-4 text-ide-sm text-ide-muted">
            <p>Not connected.</p>
            <button
              type="button"
              className="rounded-md bg-ide-accent px-2.5 py-1.5 text-ide-xs font-medium text-white hover:bg-ide-accent-hover"
              onClick={() => openConfigDialog({ ...XAMPP_MYSQL_DEFAULTS })}
            >
              Connect to MySQL…
            </button>
          </div>
        )}

        {lastError && !configDialogOpen && (
          <p className="mx-3 mt-2 rounded-md border border-ide-danger/25 bg-ide-danger/10 px-2 py-1.5 text-ide-xs text-ide-danger">
            {lastError}
          </p>
        )}
      </div>
    </div>
  );
}
