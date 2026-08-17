import { useEffect, useRef, useState } from 'react';
import { runMenuAction } from '../../features/menu/runMenuAction';
import { cn } from '../../utils/cn';

type MenuId = 'file' | 'edit' | 'view' | 'help';

interface MenuItem {
  label: string;
  action?: string;
  shortcut?: string;
  separator?: boolean;
}

const MENUS: Array<{ id: MenuId; label: string; items: MenuItem[] }> = [
  {
    id: 'file',
    label: 'File',
    items: [
      { label: 'New Text File', action: 'file.newTextFile', shortcut: 'Ctrl+N' },
      { label: 'New File', action: 'file.newFile' },
      { separator: true, label: '' },
      { label: 'Open Folder…', action: 'file.openFolder', shortcut: 'Ctrl+O' },
      { label: 'Open File…', action: 'file.openFile', shortcut: 'Ctrl+Shift+O' },
      { label: 'Open New Window', action: 'file.openNewWindow', shortcut: 'Ctrl+Shift+N' },
      { separator: true, label: '' },
      { label: 'Close Folder', action: 'file.closeFolder' },
      { label: 'Close Window', action: 'file.closeWindow', shortcut: 'Ctrl+W' },
      { separator: true, label: '' },
      { label: 'Exit', action: 'file.exit', shortcut: 'Alt+F4' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { label: 'Undo', action: 'edit.undo', shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: 'edit.redo', shortcut: 'Ctrl+Y' },
      { separator: true, label: '' },
      { label: 'Cut', action: 'edit.cut', shortcut: 'Ctrl+X' },
      { label: 'Copy', action: 'edit.copy', shortcut: 'Ctrl+C' },
      { label: 'Paste', action: 'edit.paste', shortcut: 'Ctrl+V' },
      { separator: true, label: '' },
      { label: 'Find in Files', action: 'edit.findInFiles', shortcut: 'Ctrl+Shift+F' },
      { label: 'Replace in Files', action: 'edit.replaceInFiles', shortcut: 'Ctrl+Shift+H' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { label: 'Command Palette…', action: 'view.commandPalette', shortcut: 'Ctrl+Shift+P' },
      { separator: true, label: '' },
      { label: 'Explorer', action: 'view.explorer' },
      { label: 'Maven', action: 'view.maven' },
      { label: 'Toggle Sidebar', action: 'view.toggleSidebar', shortcut: 'Ctrl+B' },
      { label: 'Toggle Terminal', action: 'view.toggleTerminal', shortcut: 'Ctrl+`' },
      { label: 'Toggle Sephora', action: 'view.toggleAiChat', shortcut: 'Ctrl+L' },
      { separator: true, label: '' },
      { label: 'Settings', action: 'view.settings', shortcut: 'Ctrl+,' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { label: 'Welcome', action: 'help.welcome' },
      {
        label: 'Show All Commands',
        action: 'help.showCommands',
        shortcut: 'Ctrl+Shift+P',
      },
      { label: 'About Terminal - IDE', action: 'help.about' },
      { separator: true, label: '' },
      { label: 'Developer: Abdul Ahad', action: 'help.developer' },
    ],
  },
];

/**
 * In-app File / View / Help menus on the left of the top bar.
 */
export function AppMenuBar() {
  const [openId, setOpenId] = useState<MenuId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  const run = (action?: string) => {
    if (!action) return;
    setOpenId(null);
    runMenuAction(action);
  };

  return (
    <div
      ref={rootRef}
      className="titlebar-no-drag flex h-full items-center gap-0.5"
      role="menubar"
      aria-label="Application"
    >
      {MENUS.map((menu) => {
        const isOpen = openId === menu.id;
        return (
          <div key={menu.id} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              className={cn(
                'h-7 rounded-md px-2.5 text-ide-xs transition-colors',
                isOpen
                  ? 'bg-ide-elevated text-ide-text'
                  : 'text-ide-muted hover:bg-ide-elevated/80 hover:text-ide-text',
              )}
              onClick={() => setOpenId(isOpen ? null : menu.id)}
              onMouseEnter={() => {
                // Hover-open while another menu is open (desktop menubar feel)
                if (openId) setOpenId(menu.id);
              }}
            >
              {menu.label}
            </button>

            {isOpen && (
              <div
                role="menu"
                className="absolute left-0 top-[calc(100%+2px)] z-[100] min-w-[15rem] overflow-hidden rounded-md border border-ide-border bg-ide-surface py-1 shadow-xl"
              >
                {menu.items.map((item, i) => {
                  if (item.separator) {
                    return (
                      <div
                        key={`sep-${menu.id}-${i}`}
                        className="my-1 border-t border-ide-border/70"
                        role="separator"
                      />
                    );
                  }
                  return (
                    <button
                      key={`${menu.id}-${item.label}`}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center justify-between gap-6 whitespace-nowrap px-3 py-1.5 text-left text-ide-xs text-ide-text hover:bg-ide-elevated"
                      onClick={() => run(item.action)}
                    >
                      <span className="whitespace-nowrap">{item.label}</span>
                      {item.shortcut && (
                        <span className="shrink-0 whitespace-nowrap text-[10px] text-ide-muted">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
