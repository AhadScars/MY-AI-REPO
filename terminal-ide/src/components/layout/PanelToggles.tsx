import { Files, TerminalSquare, Bot, Database } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSqlStore } from '../../stores/sqlStore';
import { cn } from '../../utils/cn';

/**
 * Top-right panel toggles: Explorer · Database · Terminal · Sephora
 * Active = accent icon color only (no fill / border).
 */
export function PanelToggles({ className }: { className?: string }) {
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const activityView = useLayoutStore((s) => s.activityView);
  const aiPanelVisible = useLayoutStore((s) => s.aiPanelVisible);
  const toggleAiPanel = useLayoutStore((s) => s.toggleAiPanel);
  const bottomPanelVisible = useLayoutStore((s) => s.bottomPanelVisible);
  const bottomPanelTab = useLayoutStore((s) => s.bottomPanelTab);
  const setBottomPanelVisible = useLayoutStore((s) => s.setBottomPanelVisible);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const engineType = useSqlStore((s) => s.engineType);
  const connectionLabel = useSqlStore((s) => s.connectionLabel);
  const mysql = useSqlStore((s) => s.mysql);

  // File explorer sidebar (not only when view === explorer — opens file tree)
  const explorerOn = sidebarVisible && activityView === 'explorer';
  const databaseOn = sidebarVisible && activityView === 'database';
  const terminalOn = bottomPanelVisible && bottomPanelTab === 'terminal';
  const aiOn = aiPanelVisible;
  const dbConnected = Boolean(engineType);

  const dbTitle = dbConnected
    ? engineType === 'mysql' && mysql
      ? `Database · ${mysql.database || mysql.host}`
      : `Database · ${connectionLabel?.split(/[/\\]/).pop() ?? 'connected'}`
    : 'Database';

  const toggleExplorer = () => {
    // Always show file tree when turning on; hide only if already on explorer
    if (sidebarVisible && activityView === 'explorer') {
      useLayoutStore.setState({ sidebarVisible: false });
    } else {
      useLayoutStore.setState({ sidebarVisible: true, activityView: 'explorer' });
    }
  };

  const toggleDatabase = () => {
    if (sidebarVisible && activityView === 'database') {
      useLayoutStore.setState({ sidebarVisible: false });
    } else {
      useLayoutStore.setState({ sidebarVisible: true, activityView: 'database' });
    }
  };

  const toggleTerminal = () => {
    if (terminalOn) setBottomPanelVisible(false);
    else setBottomPanelTab('terminal');
  };

  return (
    <div
      className={cn('flex shrink-0 items-center gap-0.5', className)}
      role="toolbar"
      aria-label="Show or hide panels"
    >
      <ToggleBtn label="Explorer" active={explorerOn} onClick={toggleExplorer}>
        <Files size={15} strokeWidth={explorerOn ? 1.9 : 1.5} />
      </ToggleBtn>
      <ToggleBtn label={dbTitle} active={databaseOn} onClick={toggleDatabase}>
        <span className="relative inline-flex">
          <Database size={15} strokeWidth={databaseOn ? 1.9 : 1.5} />
          {dbConnected && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-ide-success"
              aria-hidden
            />
          )}
        </span>
      </ToggleBtn>
      <ToggleBtn label="Terminal" active={terminalOn} onClick={toggleTerminal}>
        <TerminalSquare size={15} strokeWidth={terminalOn ? 1.9 : 1.5} />
      </ToggleBtn>
      <ToggleBtn label="Sephora" active={aiOn} onClick={toggleAiPanel}>
        <Bot size={15} strokeWidth={aiOn ? 1.9 : 1.5} />
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md bg-transparent transition-colors',
        active ? 'text-ide-accent' : 'text-ide-muted hover:text-ide-text',
      )}
    >
      {children}
    </button>
  );
}
