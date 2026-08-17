import { useEffect, useMemo, useRef, useState } from 'react';
import { COMMANDS, type CommandDefinition } from '../../constants/commands';
import { useLayoutStore } from '../../stores/layoutStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEditorStore } from '../../stores/editorStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { useChatStore } from '../../stores/chatStore';
import { useGitStore } from '../../stores/gitStore';
import { useRunStore } from '../../stores/runStore';
import { useSqlStore } from '../../stores/sqlStore';
import { useMavenStore } from '../../stores/mavenStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { emitEditorCommand } from '../../features/editor/editorCommands';
import { cn } from '../../utils/cn';

function isSqlTab(): boolean {
  const tab = useEditorStore.getState().getActiveTab();
  if (!tab) return false;
  return tab.language === 'sql' || /\.sql$/i.test(tab.path);
}

function runCommand(cmd: CommandDefinition): void {
  const layout = useLayoutStore.getState();
  layout.closeCommandPalette();

  switch (cmd.id) {
    case 'workbench.action.files.openFolder':
      void useWorkspaceStore.getState().openFolder();
      break;
    case 'workbench.action.files.newUntitledFile':
      useEditorStore.getState().openUntitled();
      break;
    case 'workbench.action.files.save':
      void useEditorStore.getState().saveActive();
      break;
    case 'workbench.action.files.saveAll':
      void useEditorStore.getState().saveAll();
      break;
    case 'workbench.action.toggleSidebarVisibility':
      layout.toggleSidebar();
      break;
    case 'workbench.action.terminal.toggle':
      layout.toggleBottomPanel();
      break;
    case 'workbench.action.terminal.new': {
      layout.setBottomPanelTab('terminal');
      if (!layout.bottomPanelVisible) layout.setBottomPanelVisible(true);
      void useTerminalStore.getState().createSession({
        cwd: useWorkspaceStore.getState().rootPath ?? undefined,
      });
      break;
    }
    case 'workbench.action.terminal.kill':
      void useTerminalStore.getState().killActive();
      break;
    case 'workbench.action.terminal.rename': {
      const term = useTerminalStore.getState();
      const id = term.activeSessionId;
      if (!id) break;
      const current = term.sessions.find((s) => s.id === id);
      const name = window.prompt('Terminal name', current?.name ?? 'Terminal');
      if (name?.trim()) term.renameSession(id, name.trim());
      break;
    }
    case 'workbench.action.toggleAiChat':
      layout.toggleAiPanel();
      break;
    case 'workbench.action.openSettings':
      layout.openSettings();
      break;
    case 'ai.newChat':
      useChatStore.getState().newConversation();
      layout.toggleAiPanel();
      if (!useLayoutStore.getState().aiPanelVisible) {
        useLayoutStore.setState({ aiPanelVisible: true });
      }
      break;
    case 'git.commit':
    case 'git.branch':
      layout.setActivityView('git');
      void useGitStore.getState().refresh(useWorkspaceStore.getState().rootPath);
      break;
    case 'git.push':
      layout.setActivityView('git');
      void useGitStore.getState().push({ confirm: true });
      break;
    case 'git.pull':
      layout.setActivityView('git');
      void useGitStore.getState().pull();
      break;
    case 'ai.toggleAgent': {
      const settings = useSettingsStore.getState();
      const next = !settings.settings.ai.agentMode;
      void settings.updateSetting('ai', { agentMode: next });
      if (!layout.aiPanelVisible) layout.toggleAiPanel();
      break;
    }
    case 'workbench.action.showCommands':
      // already open
      break;
    case 'workbench.action.quickOpen':
      layout.openQuickOpen();
      break;
    case 'actions.find':
      emitEditorCommand('find');
      break;
    case 'editor.action.startFindReplaceAction':
      emitEditorCommand('replace');
      break;
    case 'workbench.action.findInFiles':
      layout.setActivityView('search');
      if (!layout.sidebarVisible) layout.toggleSidebar();
      break;
    case 'workbench.action.debug.run':
      if (isSqlTab()) void useSqlStore.getState().runActiveSql();
      else void useRunStore.getState().runActiveFile();
      break;
    case 'workbench.action.debug.rerun':
      if (isSqlTab()) void useSqlStore.getState().runActiveSql();
      else void useRunStore.getState().rerun();
      break;
    case 'workbench.action.debug.stop':
      void useRunStore.getState().stop();
      break;
    case 'maven.showPanel':
      useMavenStore.getState().openMavenTool();
      break;
    case 'maven.installDependencies':
      useMavenStore.getState().openMavenTool();
      void useMavenStore.getState().installDependencies();
      break;
    case 'maven.reinstallDependencies':
      useMavenStore.getState().openMavenTool();
      void useMavenStore.getState().reinstallDependencies();
      break;
    case 'sql.openDatabase':
      void useSqlStore.getState().openDatabase();
      break;
    case 'sql.newDatabase':
      void useSqlStore.getState().newDatabase();
      break;
    case 'sql.runQuery':
      void useSqlStore.getState().runActiveSql();
      break;
    case 'sql.showDatabase':
      layout.setActivityView('database');
      break;
    case 'sql.newQuery':
      useEditorStore.getState().openUntitled(
        `-- Project SQL\n-- F5 runs against the open project database\n\nSELECT name FROM sqlite_master WHERE type='table';\n`,
        'sql',
      );
      break;
    case 'sql.initProjectDatabase':
      void useSqlStore.getState().createProjectDatabase();
      layout.setActivityView('database');
      break;
    case 'sql.openInTerminal':
      void useSqlStore.getState().openInTerminal();
      break;
    case 'sql.editConfig':
      void useSqlStore.getState().openProjectConfig();
      break;
    default:
      break;
  }

  if (cmd.id === 'workbench.action.terminal.toggle') {
    const term = useTerminalStore.getState();
    if (term.sessions.length === 0) {
      void term.createSession({ cwd: useWorkspaceStore.getState().rootPath ?? undefined });
    }
  }
}

export function CommandPalette() {
  const open = useLayoutStore((s) => s.commandPaletteOpen);
  const close = useLayoutStore((s) => s.closeCommandPalette);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => {
      const hay = `${c.label} ${c.category} ${(c.keywords ?? []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selected];
      if (cmd) runCommand(cmd);
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
        aria-label="Close command palette"
        onClick={close}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-md border border-ide-border bg-ide-surface shadow-2xl">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command or search…"
          className="w-full border-b border-ide-border bg-transparent px-4 py-3 text-ide-md text-ide-text outline-none placeholder:text-ide-muted"
          aria-label="Command palette"
        />
        <ul className="max-h-80 overflow-auto py-1" role="listbox">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-ide-sm text-ide-muted">No matching commands</li>
          )}
          {filtered.map((cmd, i) => (
            <li key={cmd.id} role="option" aria-selected={i === selected}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2 text-left text-ide-sm',
                  i === selected ? 'bg-ide-accent text-white' : 'hover:bg-ide-elevated',
                )}
                onMouseEnter={() => setSelected(i)}
                onClick={() => runCommand(cmd)}
              >
                <span>
                  <span className="mr-2 text-ide-xs opacity-70">{cmd.category}</span>
                  {cmd.label}
                </span>
                {cmd.shortcut && (
                  <span
                    className={cn(
                      'text-ide-xs',
                      i === selected ? 'text-white/80' : 'text-ide-muted',
                    )}
                  >
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
