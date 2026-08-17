import { useCallback } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { ActivityBar } from './ActivityBar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { Sidebar } from '../explorer/Sidebar';
import { EditorArea } from '../editor/EditorArea';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { AIChatPanel } from '../chat/AIChatPanel';
import { ResizeHandle } from '../common/ResizeHandle';
import { CommandPalette } from '../command-palette/CommandPalette';
import { QuickOpen } from '../command-palette/QuickOpen';
import { SettingsPanel } from '../settings/SettingsPanel';
import { EditReviewPanel } from '../diff/EditReviewPanel';
import { DbConfigDialog } from '../sql/DbConfigDialog';
import { BrowserPanel } from '../browser/BrowserPanel';
import { useSqlStore } from '../../stores/sqlStore';
import { useBrowserStore } from '../../stores/browserStore';

export function IDELayout() {
  const configDialogOpen = useSqlStore((s) => s.configDialogOpen);
  const configDraft = useSqlStore((s) => s.configDraft);
  const mysqlDatabases = useSqlStore((s) => s.mysqlDatabases);
  const isRunning = useSqlStore((s) => s.isRunning);
  const lastError = useSqlStore((s) => s.lastError);
  const closeConfigDialog = useSqlStore((s) => s.closeConfigDialog);
  const connectMysql = useSqlStore((s) => s.connectMysql);
  const browserOpen = useBrowserStore((s) => s.open);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);
  const aiPanelVisible = useLayoutStore((s) => s.aiPanelVisible);
  const aiPanelWidth = useLayoutStore((s) => s.aiPanelWidth);
  const bottomPanelVisible = useLayoutStore((s) => s.bottomPanelVisible);
  const bottomPanelHeight = useLayoutStore((s) => s.bottomPanelHeight);

  // Always read latest size from the store so drag does not use a stale React closure
  const resizeSidebar = useCallback((delta: number) => {
    const { sidebarWidth: w, setSidebarWidth } = useLayoutStore.getState();
    setSidebarWidth(w + delta);
  }, []);

  const resizeAiPanel = useCallback((delta: number) => {
    const { aiPanelWidth: w, setAiPanelWidth } = useLayoutStore.getState();
    // Handle is on the left edge of the AI panel: drag right → narrower panel
    setAiPanelWidth(w - delta);
  }, []);

  const resizeBottomPanel = useCallback((delta: number) => {
    const { bottomPanelHeight: h, setBottomPanelHeight } = useLayoutStore.getState();
    // Handle is on the top edge: drag down → shorter panel
    setBottomPanelHeight(h - delta);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <TopBar />
      <DbConfigDialog
        open={configDialogOpen}
        initial={configDraft}
        availableDatabases={mysqlDatabases}
        busy={isRunning}
        error={configDialogOpen ? lastError : null}
        onClose={closeConfigDialog}
        onConnect={(cfg, { save }) => {
          void connectMysql(cfg, { save });
        }}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar />

        {sidebarVisible && (
          <>
            <div
              style={{ width: sidebarWidth }}
              className="flex h-full shrink-0 flex-col overflow-hidden"
            >
              <Sidebar />
            </div>
            <ResizeHandle direction="vertical" onResize={resizeSidebar} />
          </>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <EditorArea />

            {browserOpen && (
              <div className="flex min-h-0 min-w-[280px] flex-[1.15] flex-col overflow-hidden border-l border-ide-border/70">
                <BrowserPanel />
              </div>
            )}

            {aiPanelVisible && (
              <>
                <ResizeHandle direction="vertical" onResize={resizeAiPanel} />
                <div
                  style={{ width: aiPanelWidth, minWidth: 240, maxWidth: '100%' }}
                  className="flex h-full min-w-0 shrink-0 flex-col overflow-hidden border-l border-ide-border/70"
                >
                  <AIChatPanel />
                </div>
              </>
            )}
          </div>

          {bottomPanelVisible && (
            <>
              <ResizeHandle direction="horizontal" onResize={resizeBottomPanel} />
              <div
                style={{ height: bottomPanelHeight }}
                className="flex shrink-0 flex-col overflow-hidden border-t border-ide-border"
              >
                <TerminalPanel />
              </div>
            </>
          )}

          <EditReviewPanel />
        </div>
      </div>

      <StatusBar />
      <CommandPalette />
      <QuickOpen />
      <SettingsPanel />
    </div>
  );
}
