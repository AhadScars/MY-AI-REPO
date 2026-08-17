import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown, X } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { IconButton } from '../common/IconButton';
import { XtermView } from './XtermView';
import { RunOutput } from '../run/RunOutput';
import { ProblemsPanel } from '../run/ProblemsPanel';
import { SqlResultsPanel } from '../sql/SqlResultsPanel';
import { TableDataEditor } from '../sql/TableDataEditor';
import { useSqlStore } from '../../stores/sqlStore';
import { cn } from '../../utils/cn';
import type { BottomPanelTab } from '../../../packages/types/src/layout';
import type { ShellId } from '../../../packages/protocol/src/terminal';

const TABS: Array<{ id: BottomPanelTab; label: string }> = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'problems', label: 'Problems' },
  { id: 'output', label: 'Output' },
  { id: 'sql', label: 'SQL' },
  { id: 'debug', label: 'Debug' },
];

/**
 * Bottom panel with minimal multi-terminal tabs (VS Code quiet style).
 */
export function TerminalPanel() {
  const bottomPanelTab = useLayoutStore((s) => s.bottomPanelTab);
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);
  const closeBottomPanel = useLayoutStore((s) => s.closeBottomPanel);
  const tableEditor = useSqlStore((s) => s.tableEditor);

  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const availableShells = useTerminalStore((s) => s.availableShells);
  const preferredShell = useTerminalStore((s) => s.preferredShell);
  const lastError = useTerminalStore((s) => s.lastError);
  const loadShells = useTerminalStore((s) => s.loadShells);
  const setPreferredShell = useTerminalStore((s) => s.setPreferredShell);
  const createSession = useTerminalStore((s) => s.createSession);
  const closeSession = useTerminalStore((s) => s.closeSession);
  const restartSession = useTerminalStore((s) => s.restartSession);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const renameSession = useTerminalStore((s) => s.renameSession);
  const markExited = useTerminalStore((s) => s.markExited);

  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const defaultShellSetting = useSettingsStore((s) => s.settings.terminal.defaultShell);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [shellMenuOpen, setShellMenuOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const shellMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadShells();
  }, [loadShells]);

  useEffect(() => {
    if (defaultShellSetting) {
      setPreferredShell(defaultShellSetting as ShellId);
    }
  }, [defaultShellSetting, setPreferredShell]);

  useEffect(() => {
    if (bottomPanelTab !== 'terminal') return;
    if (sessions.length > 0) return;
    void createSession({
      cwd: rootPath ?? undefined,
      shell: preferredShell,
    });
  }, [bottomPanelTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  useEffect(() => {
    if (!shellMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!shellMenuRef.current?.contains(e.target as Node)) {
        setShellMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShellMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [shellMenuOpen]);

  const newTerminal = () => {
    void createSession({
      cwd: rootPath ?? undefined,
      shell: preferredShell,
    });
  };

  const startRename = (id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
    setMenu(null);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameSession(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="flex h-full flex-col bg-ide-panel">
      {/* Panel type + minimal actions */}
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-ide-border/50 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBottomPanelTab(tab.id)}
              className={cn(
                'shrink-0 px-2 py-0.5 text-ide-xs transition-colors',
                bottomPanelTab === tab.id
                  ? 'text-ide-text'
                  : 'text-ide-muted hover:text-ide-text',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {bottomPanelTab === 'terminal' && (
          <div className="flex shrink-0 items-center gap-0.5">
            {/* Custom shell picker — native <select> forces white menu on Windows */}
            <div className="relative" ref={shellMenuRef}>
              <button
                type="button"
                title="Shell"
                aria-label="Shell"
                aria-haspopup="listbox"
                aria-expanded={shellMenuOpen}
                onClick={() => setShellMenuOpen((o) => !o)}
                className={cn(
                  'flex h-6 max-w-[9rem] items-center gap-1 rounded-md border border-ide-border/70',
                  'bg-ide-elevated px-1.5 text-[11px] text-ide-text',
                  'hover:border-ide-border hover:bg-ide-surface',
                  shellMenuOpen && 'border-ide-accent/50 bg-ide-surface',
                )}
              >
                <span className="min-w-0 truncate">
                  {availableShells.find((s) => s.id === preferredShell)?.name ??
                    preferredShell ??
                    'Shell'}
                </span>
                <ChevronDown size={10} className="shrink-0 text-ide-muted" />
              </button>
              {shellMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Select shell"
                  className="absolute right-0 top-[calc(100%+2px)] z-[80] min-w-[10rem] overflow-hidden rounded-md border border-ide-border bg-ide-surface py-0.5 shadow-xl"
                >
                  {(availableShells.length > 0
                    ? availableShells
                    : [{ id: 'auto' as ShellId, name: 'Auto', available: true }]
                  ).map((s) => {
                    const disabled = !s.available && s.id !== 'auto';
                    const active = s.id === preferredShell;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={disabled}
                        className={cn(
                          'flex w-full items-center px-2.5 py-1.5 text-left text-[11px]',
                          disabled
                            ? 'cursor-not-allowed text-ide-muted/45'
                            : active
                              ? 'bg-ide-elevated text-ide-text'
                              : 'text-ide-text hover:bg-ide-elevated',
                        )}
                        onClick={() => {
                          if (disabled) return;
                          setPreferredShell(s.id);
                          setShellMenuOpen(false);
                        }}
                      >
                        {s.name}
                        {!s.available && s.id !== 'auto' ? (
                          <span className="ml-auto pl-2 text-[10px] text-ide-muted">n/a</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <IconButton label="New Terminal" size="sm" onClick={newTerminal}>
              <Plus size={13} />
            </IconButton>
          </div>
        )}

        <IconButton label="Close Panel" size="sm" onClick={closeBottomPanel}>
          <X size={13} />
        </IconButton>
      </div>

      {bottomPanelTab === 'terminal' && (
        <>
          {/* Quiet terminal tabs */}
          {sessions.length > 0 && (
            <div className="flex h-7 shrink-0 items-center gap-0.5 overflow-x-auto px-1.5">
              {sessions.map((s) => {
                const isActive = s.id === activeSessionId;
                const isRenaming = renamingId === s.id;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'group flex h-6 max-w-[9rem] shrink-0 items-center rounded-md pl-2 pr-0.5',
                      isActive
                        ? 'bg-ide-elevated text-ide-text'
                        : 'text-ide-muted hover:text-ide-text',
                    )}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ id: s.id, x: e.clientX, y: e.clientY });
                    }}
                  >
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        className="min-w-0 flex-1 bg-transparent text-ide-xs text-ide-text outline-none"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setRenamingId(null);
                          }
                          e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-ide-xs"
                        onClick={() => setActiveSession(s.id)}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          startRename(s.id, s.name);
                        }}
                        title="Double-click to rename"
                      >
                        {s.name}
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-ide-bg group-hover:opacity-100"
                      title="Close"
                      onClick={(e) => {
                        e.stopPropagation();
                        void closeSession(s.id);
                      }}
                    >
                      <X size={10} className="text-ide-muted" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {lastError && (
            <div className="px-3 py-1 text-ide-xs text-ide-danger">{lastError}</div>
          )}

          <div className="relative min-h-0 flex-1 bg-[#1e1e1e]">
            {sessions.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <button
                  type="button"
                  className="text-ide-xs text-ide-muted hover:text-ide-accent"
                  onClick={newTerminal}
                >
                  + New Terminal
                </button>
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="absolute inset-0"
                  style={{
                    visibility: s.id === activeSessionId ? 'visible' : 'hidden',
                    zIndex: s.id === activeSessionId ? 1 : 0,
                  }}
                >
                  <XtermView
                    sessionId={s.id}
                    active={s.id === activeSessionId}
                    onExit={(code) => markExited(s.id, code)}
                  />
                </div>
              ))
            )}
          </div>

          {menu && (
            <div
              className="fixed z-[100] min-w-[8.5rem] overflow-hidden rounded-md border border-ide-border bg-ide-surface py-0.5 shadow-lg"
              style={{ left: menu.x, top: menu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const s = sessions.find((x) => x.id === menu.id);
                if (!s) return null;
                return (
                  <>
                    <MenuBtn label="Rename" onClick={() => startRename(s.id, s.name)} />
                    <MenuBtn
                      label="Restart"
                      onClick={() => {
                        setMenu(null);
                        void restartSession(s.id);
                      }}
                    />
                    <MenuBtn
                      label="New Terminal"
                      onClick={() => {
                        setMenu(null);
                        newTerminal();
                      }}
                    />
                    <div className="my-0.5 border-t border-ide-border/50" />
                    <MenuBtn
                      label="Kill"
                      danger
                      onClick={() => {
                        setMenu(null);
                        void closeSession(s.id);
                      }}
                    />
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}

      {bottomPanelTab === 'problems' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ProblemsPanel />
        </div>
      )}
      {bottomPanelTab === 'output' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <RunOutput />
        </div>
      )}
      {bottomPanelTab === 'sql' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          {tableEditor ? <TableDataEditor /> : <SqlResultsPanel />}
        </div>
      )}
      {bottomPanelTab === 'debug' && (
        <div className="p-3 text-ide-sm text-ide-muted">Debug console</div>
      )}
    </div>
  );
}

function MenuBtn({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full px-3 py-1.5 text-left text-ide-xs hover:bg-ide-elevated',
        danger ? 'text-ide-danger' : 'text-ide-text',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
