import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useEditorStore } from '../stores/editorStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditStore } from '../stores/editStore';
import { useInlineAiStore } from '../stores/inlineAiStore';
import { useRunStore } from '../stores/runStore';
import { useSqlStore } from '../stores/sqlStore';
import { useTerminalStore } from '../stores/terminalStore';
import { useBrowserStore } from '../stores/browserStore';
import { emitEditorCommand } from '../features/editor/editorCommands';

/**
 * Global keyboard shortcuts for the IDE shell.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Ctrl+Shift+P — Command Palette
      if (ctrl && shift && key === 'p') {
        e.preventDefault();
        useLayoutStore.getState().toggleCommandPalette();
        return;
      }

      // Ctrl+P — Quick Open
      if (ctrl && !shift && key === 'p') {
        e.preventDefault();
        useLayoutStore.getState().openQuickOpen();
        return;
      }

      // Ctrl+B — Toggle sidebar
      if (ctrl && !shift && key === 'b') {
        e.preventDefault();
        useLayoutStore.getState().toggleSidebar();
        return;
      }

      // Ctrl+Shift+` — New terminal
      if (ctrl && shift && (key === '`' || key === 'backquote' || e.code === 'Backquote')) {
        e.preventDefault();
        const layout = useLayoutStore.getState();
        layout.setBottomPanelTab('terminal');
        if (!layout.bottomPanelVisible) layout.setBottomPanelVisible(true);
        const root = useWorkspaceStore.getState().rootPath;
        void useTerminalStore.getState().createSession({ cwd: root ?? undefined });
        return;
      }

      // Ctrl+` — Toggle terminal panel
      if (ctrl && !shift && (key === '`' || key === 'backquote' || e.code === 'Backquote')) {
        e.preventDefault();
        const layout = useLayoutStore.getState();
        if (!layout.bottomPanelVisible) {
          layout.setBottomPanelVisible(true);
          layout.setBottomPanelTab('terminal');
        } else if (layout.bottomPanelTab !== 'terminal') {
          layout.setBottomPanelTab('terminal');
        } else {
          layout.toggleBottomPanel();
        }
        return;
      }

      // Ctrl+PageDown / PageUp — next/prev terminal when panel focused on terminal
      if (ctrl && !shift && key === 'pagedown') {
        const layout = useLayoutStore.getState();
        if (layout.bottomPanelVisible && layout.bottomPanelTab === 'terminal') {
          e.preventDefault();
          useTerminalStore.getState().activateNext();
          return;
        }
      }
      if (ctrl && !shift && key === 'pageup') {
        const layout = useLayoutStore.getState();
        if (layout.bottomPanelVisible && layout.bottomPanelTab === 'terminal') {
          e.preventDefault();
          useTerminalStore.getState().activatePrev();
          return;
        }
      }

      // Ctrl+L — Toggle AI chat
      if (ctrl && !shift && key === 'l') {
        e.preventDefault();
        useLayoutStore.getState().toggleAiPanel();
        return;
      }

      // Ctrl+K — open inline AI (selection handled in Monaco; global fallback opens panel hint)
      if (ctrl && !shift && key === 'k') {
        // Let Monaco handle when focused; still open empty prompt if store closed
        if (!useInlineAiStore.getState().open) {
          // Monaco command runs when editor focused; otherwise show edits panel if pending
          if (useEditStore.getState().pendingCount() > 0) {
            e.preventDefault();
            useEditStore.getState().openPanel();
          }
        }
        return;
      }

      // Ctrl+Shift+E — toggle edit review
      if (ctrl && shift && key === 'e') {
        e.preventDefault();
        const edits = useEditStore.getState();
        if (edits.panelOpen) edits.closePanel();
        else edits.openPanel();
        return;
      }

      // F5 — Run current file / SQL / HTML preview
      if (key === 'f5' && !ctrl && !shift) {
        e.preventDefault();
        const tab = useEditorStore.getState().getActiveTab();
        const isSql =
          tab &&
          (tab.language === 'sql' || /\.sql$/i.test(tab.path));
        const isHtml =
          tab &&
          !tab.path.startsWith('untitled:') &&
          (tab.language === 'html' || /\.html?$/i.test(tab.path));
        if (isSql) {
          void useSqlStore.getState().runActiveSql();
        } else if (isHtml && tab) {
          void useBrowserStore.getState().openHtmlFile(tab.path);
        } else {
          void useRunStore.getState().runActiveFile();
        }
        return;
      }

      // Ctrl+F5 — Rerun (stop + run again) / re-run SQL
      if (key === 'f5' && ctrl && !shift) {
        e.preventDefault();
        const tab = useEditorStore.getState().getActiveTab();
        const isSql =
          tab &&
          (tab.language === 'sql' || /\.sql$/i.test(tab.path));
        if (isSql) {
          void useSqlStore.getState().runActiveSql();
        } else {
          void useRunStore.getState().rerun();
        }
        return;
      }

      // Ctrl+Shift+Q — Database panel
      if (ctrl && shift && key === 'q') {
        e.preventDefault();
        useLayoutStore.getState().setActivityView('database');
        return;
      }

      // Shift+F5 — Stop
      if (key === 'f5' && shift && !ctrl) {
        e.preventDefault();
        void useRunStore.getState().stop();
        return;
      }

      // Ctrl+F — Find in file
      if (ctrl && !shift && key === 'f') {
        e.preventDefault();
        emitEditorCommand('find');
        return;
      }

      // Ctrl+H — Find and replace in file
      if (ctrl && !shift && key === 'h') {
        e.preventDefault();
        emitEditorCommand('replace');
        return;
      }

      // Ctrl+Shift+F — Search in workspace
      if (ctrl && shift && key === 'f') {
        e.preventDefault();
        useLayoutStore.getState().setActivityView('search');
        if (!useLayoutStore.getState().sidebarVisible) {
          useLayoutStore.getState().toggleSidebar();
        }
        return;
      }

      // F3 / Shift+F3 — find next / previous
      if (key === 'f3' && !ctrl) {
        e.preventDefault();
        emitEditorCommand(shift ? 'findPrevious' : 'findNext');
        return;
      }

      // Ctrl+S — Save
      if (ctrl && !shift && key === 's') {
        e.preventDefault();
        void useEditorStore.getState().saveActive();
        return;
      }

      // Ctrl+Shift+S — Save As
      if (ctrl && shift && key === 's') {
        e.preventDefault();
        void useEditorStore.getState().saveAs();
        return;
      }

      // Ctrl+W — Close tab
      if (ctrl && !shift && key === 'w') {
        e.preventDefault();
        void useEditorStore.getState().closeActiveTab();
        return;
      }

      // Ctrl+Tab / Ctrl+PageDown — next tab
      if (ctrl && !shift && (key === 'tab' || key === 'pagedown')) {
        e.preventDefault();
        useEditorStore.getState().activateNextTab();
        return;
      }

      // Ctrl+Shift+Tab / Ctrl+PageUp — previous tab
      if (ctrl && shift && (key === 'tab' || key === 'pageup')) {
        e.preventDefault();
        useEditorStore.getState().activatePrevTab();
        return;
      }

      // Ctrl+N — New file
      if (ctrl && !shift && key === 'n') {
        e.preventDefault();
        useEditorStore.getState().openUntitled();
        return;
      }

      // Ctrl+O — Open folder
      if (ctrl && !shift && key === 'o') {
        e.preventDefault();
        void useWorkspaceStore.getState().openFolder();
        return;
      }

      // Ctrl+, — Settings
      if (ctrl && key === ',') {
        e.preventDefault();
        useLayoutStore.getState().toggleSettings();
        return;
      }

      // Escape — close overlays
      if (key === 'escape') {
        const layout = useLayoutStore.getState();
        if (layout.quickOpenOpen) {
          layout.closeQuickOpen();
          return;
        }
        if (layout.commandPaletteOpen) {
          layout.closeCommandPalette();
          return;
        }
        if (layout.settingsOpen) {
          layout.closeSettings();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

/** Optional autosave after delay when enabled in settings. */
export function useAutosave(): void {
  useEffect(() => {
    const interval = window.setInterval(() => {
      const settings = useSettingsStore.getState().settings.editor;
      if (settings.autoSave !== 'afterDelay') return;
      const dirty = useEditorStore.getState().tabs.filter(
        (t) => t.isDirty && !t.path.startsWith('untitled:'),
      );
      if (dirty.length === 0) return;
      void useEditorStore.getState().saveAll();
    }, 2000);

    return () => window.clearInterval(interval);
  }, []);
}
