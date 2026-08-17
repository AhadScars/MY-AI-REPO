import { requireApi } from '../../services/platform';
import { useLayoutStore } from '../../stores/layoutStore';
import { useEditorStore } from '../../stores/editorStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { useRunStore } from '../../stores/runStore';
import { emitEditorCommand } from '../editor/editorCommands';

/**
 * Shared menu actions for native Electron menu + in-app File/Edit/View/Help bar.
 */
export function runMenuAction(action: string): void {
  switch (action) {
    // ── File ───────────────────────────────────────────────────────────────
    case 'file.newTextFile':
      useEditorStore.getState().openUntitled('', 'plaintext');
      break;
    case 'file.newFile':
      useEditorStore.getState().openUntitled();
      break;
    case 'file.openFolder':
      void useWorkspaceStore.getState().openFolder();
      break;
    case 'file.openFile':
      void (async () => {
        const api = requireApi();
        const result = await api.openFile();
        if (!result.canceled && result.paths[0]) {
          await useEditorStore.getState().openFile(result.paths[0], false);
        }
      })();
      break;
    case 'file.openNewWindow':
      void (async () => {
        try {
          await requireApi().newWindow();
        } catch {
          // Platform stub / older builds
        }
      })();
      break;
    case 'file.closeFolder':
      useWorkspaceStore.getState().closeWorkspace();
      break;
    case 'file.closeWindow':
      void requireApi().close();
      break;
    case 'file.save':
      void useEditorStore.getState().saveActive();
      break;
    case 'file.saveAll':
      void useEditorStore.getState().saveAll();
      break;
    case 'file.quit':
    case 'file.exit':
      void requireApi().quit();
      break;

    // ── Edit ───────────────────────────────────────────────────────────────
    case 'edit.undo':
      emitEditorCommand('undo');
      break;
    case 'edit.redo':
      emitEditorCommand('redo');
      break;
    case 'edit.cut':
      emitEditorCommand('cut');
      break;
    case 'edit.copy':
      emitEditorCommand('copy');
      break;
    case 'edit.paste':
      emitEditorCommand('paste');
      break;
    case 'edit.addNextOccurrence':
      emitEditorCommand('addNextOccurrence');
      break;
    case 'edit.selectAllOccurrences':
      emitEditorCommand('selectAllOccurrences');
      break;
    case 'edit.insertCursorAbove':
      emitEditorCommand('insertCursorAbove');
      break;
    case 'edit.insertCursorBelow':
      emitEditorCommand('insertCursorBelow');
      break;
    case 'edit.cursorsAtLineEnds':
      emitEditorCommand('cursorsAtLineEnds');
      break;
    case 'edit.collapseToEnd':
      emitEditorCommand('collapseToEnd');
      break;
    case 'edit.collapseToStart':
      emitEditorCommand('collapseToStart');
      break;
    case 'edit.find':
      emitEditorCommand('find');
      break;
    case 'edit.replace':
      emitEditorCommand('replace');
      break;
    case 'edit.findInFiles':
      useLayoutStore.getState().setActivityView('search');
      if (!useLayoutStore.getState().sidebarVisible) {
        useLayoutStore.setState({ sidebarVisible: true });
      }
      break;
    case 'edit.replaceInFiles':
      // Open workspace search panel (replace-in-files UI lives there)
      useLayoutStore.getState().setActivityView('search');
      if (!useLayoutStore.getState().sidebarVisible) {
        useLayoutStore.setState({ sidebarVisible: true });
      }
      break;

    // ── View ───────────────────────────────────────────────────────────────
    case 'view.commandPalette':
      useLayoutStore.getState().openCommandPalette();
      break;
    case 'view.toggleSidebar':
      useLayoutStore.getState().toggleSidebar();
      break;
    case 'view.toggleTerminal':
      useLayoutStore.getState().toggleBottomPanel();
      break;
    case 'view.toggleAiChat':
      useLayoutStore.getState().toggleAiPanel();
      break;
    case 'view.explorer':
      useLayoutStore.setState({ sidebarVisible: true, activityView: 'explorer' });
      break;
    case 'view.maven':
      useLayoutStore.setState({ sidebarVisible: true, activityView: 'maven' });
      break;
    case 'view.settings':
      useLayoutStore.getState().openSettings();
      break;

    // ── Terminal / Run ─────────────────────────────────────────────────────
    case 'terminal.new': {
      const root = useWorkspaceStore.getState().rootPath;
      useLayoutStore.getState().setBottomPanelTab('terminal');
      void useTerminalStore.getState().createSession({ cwd: root ?? undefined });
      break;
    }
    case 'run.program':
      void useRunStore.getState().runActiveFile();
      break;
    case 'run.rerun':
      void useRunStore.getState().rerun();
      break;
    case 'run.stop':
      void useRunStore.getState().stop();
      break;

    // ── Help ───────────────────────────────────────────────────────────────
    case 'help.welcome':
      void useEditorStore.getState().closeAllTabs();
      break;
    case 'help.showCommands':
      useLayoutStore.getState().openCommandPalette();
      break;
    case 'help.about':
      void requireApi().showMessage({
  type: 'info',
  title: 'About Terminal - IDE',
  message: 'Terminal - IDE',
  detail: 'AI-powered code editor for Windows.\nVersion 0.1.2\n\nA modern, intelligent development environment designed to help developers write, understand, debug, and improve code faster with AI.\n\nDeveloper: Abdul Ahad',
});
      break;
    case 'help.developer':
      void requireApi().showMessage({
        type: 'info',
        title: 'Developer',
        message: 'Abdul Ahad | AI Developer',
        detail: 'Developer of Terminal - IDE.',
      });
      break;
    default:
      break;
  }
}
