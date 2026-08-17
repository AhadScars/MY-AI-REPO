import { useEffect } from 'react';
import { IDELayout } from './components/layout/IDELayout';
import { useKeyboardShortcuts, useAutosave } from './hooks/useKeyboardShortcuts';
import { useMenuActions } from './hooks/useMenuActions';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useSettingsStore } from './stores/settingsStore';
import { useAIStore } from './stores/aiStore';
import { useEditStore } from './stores/editStore';
import { useIndexingStore } from './stores/indexingStore';
import { useRunStore } from './stores/runStore';
import { useWorkspaceStore } from './stores/workspaceStore';
import { useEditorStore } from './stores/editorStore';
import { requireApi } from './services/platform';

export function App() {
  const loadSettings = useSettingsStore((s) => s.load);

  useKeyboardShortcuts();
  useAutosave();
  useMenuActions();
  useResponsiveLayout();

  useEffect(() => {
    /** Atomic save of workspace + explorer + open tabs (used on quit). */
    const flushAllState = async () => {
      const api = requireApi();
      const ws = useWorkspaceStore.getState();
      const ed = useEditorStore.getState();

      // Cancel debounced timers and read latest UI state
      await ws.flushExplorer().catch(() => undefined);

      const tabs = ed.tabs;
      const openPaths = tabs
        .filter((t) => !t.path.startsWith('untitled:') && !t.isPreview)
        .map((t) => t.path);
      const active = tabs.find((t) => t.id === ed.activeTabId);
      const activePath =
        active && !active.path.startsWith('untitled:') && !active.isPreview
          ? active.path
          : (openPaths[openPaths.length - 1] ?? null);

      const root = ws.rootPath;
      const recent = root
        ? [root, ...ws.recentPaths.filter((p) => p.toLowerCase() !== root.toLowerCase())].slice(
            0,
            5,
          )
        : ws.recentPaths.slice(0, 5);

      const values: Record<string, unknown> = {
        'workspace.recentPaths': recent,
        'workspace.lastPath': root,
        'workspace.expandedPaths': root ? [...ws.expandedPaths] : [],
        'workspace.selectedPath': root ? ws.selectedPath : null,
        session: { openPaths, activePath },
      };

      if (api.setSettingsMany) {
        await api.setSettingsMany({ values });
      } else {
        for (const [key, value] of Object.entries(values)) {
          await api.setSetting({ key, value });
        }
      }

      // Keep in-memory recent in sync
      if (root) {
        useWorkspaceStore.setState({ recentPaths: recent });
      }
    };

    void (async () => {
      await loadSettings();
      const ai = useSettingsStore.getState().settings.ai;
      if (ai.provider) {
        useAIStore.getState().setProvider(ai.provider, ai.model);
      }
      await useEditStore.getState().load();
      useRunStore.getState().ensureSubscribed();
      await useWorkspaceStore.getState().loadRecent();

      // Restore last working folder + explorer tree + open tabs
      try {
        const api = requireApi();
        const openLast =
          useSettingsStore.getState().settings.general.openLastWorkspace !== false;

        // Prefer full snapshot for lastPath
        let lastPath: string | null | undefined;
        try {
          const all = (await api.getAllSettings()) as {
            workspace?: { lastPath?: string | null; recentPaths?: string[] };
          };
          lastPath = all?.workspace?.lastPath ?? null;
          if (Array.isArray(all?.workspace?.recentPaths) && all.workspace.recentPaths.length > 0) {
            useWorkspaceStore.setState({
              recentPaths: all.workspace.recentPaths.filter(
                (p) => typeof p === 'string' && p.length > 0,
              ).slice(0, 5),
            });
          }
        } catch {
          lastPath = await api.getSetting<string | null>({ key: 'workspace.lastPath' });
        }

        if (openLast && lastPath && typeof lastPath === 'string') {
          const exists = await api.exists({ path: lastPath });
          if (exists) {
            // openFolder also restores explorer expanded/selected state
            await useWorkspaceStore.getState().openFolder(lastPath);
          }
        } else {
          // Ensure Recent is loaded for welcome page even when not auto-opening
          await useWorkspaceStore.getState().loadRecent();
        }

        // Re-open last tabs and focus last active tab.
        // Empty session → welcome; folder still listed under Recent.
        await useEditorStore.getState().restoreSession();
      } catch (err) {
        console.error('Session restore failed:', err);
      }
    })();

    const flush = () => {
      void flushAllState();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);

    let unsubPrepareQuit: (() => void) | undefined;
    try {
      const api = requireApi();
      unsubPrepareQuit = api.onPrepareQuit?.(() => {
        void (async () => {
          try {
            await flushAllState();
          } catch (err) {
            console.error('Session flush on quit failed:', err);
          } finally {
            api.notifySessionFlushed?.();
          }
        })();
      });
    } catch {
      // browser stub
    }

    const unsubEdits = useEditStore.getState().subscribe();
    const unsubIndex = useIndexingStore.getState().subscribe();
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      unsubPrepareQuit?.();
      unsubEdits();
      unsubIndex();
    };
  }, [loadSettings]);

  return <IDELayout />;
}
