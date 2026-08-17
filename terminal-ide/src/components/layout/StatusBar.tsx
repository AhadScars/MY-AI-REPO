import { GitBranch, AlertCircle } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useGitStore } from '../../stores/gitStore';
import { useAIStore } from '../../stores/aiStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditStore } from '../../stores/editStore';
import { useDiagnosticsStore } from '../../stores/diagnosticsStore';

export function StatusBar() {
  const activeTab = useEditorStore((s) => s.getActiveTab());
  const branch = useGitStore((s) => s.branch);
  const isRepo = useGitStore((s) => s.isRepo);
  const ahead = useGitStore((s) => s.ahead);
  const behind = useGitStore((s) => s.behind);
  const changeCount =
    useGitStore((s) => s.staged.length) + useGitStore((s) => s.unstaged.length);
  const activeModel = useAIStore((s) => s.activeModel);
  const toggleAi = useLayoutStore((s) => s.toggleAiPanel);
  const setActivityView = useLayoutStore((s) => s.setActivityView);
  const tabSize = useSettingsStore((s) => s.settings.editor.tabSize);
  const insertSpaces = useSettingsStore((s) => s.settings.editor.insertSpaces);
  const pendingEdits = useEditStore((s) => s.pendingCount());
  const openEdits = useEditStore((s) => s.openPanel);
  const diagCount = useDiagnosticsStore(
    (s) => s.diagnostics.filter((d) => d.severity === 'error').length,
  );
  const warnCount = useDiagnosticsStore(
    (s) => s.diagnostics.filter((d) => d.severity === 'warning').length,
  );
  const setBottomPanelTab = useLayoutStore((s) => s.setBottomPanelTab);

  const item =
    'flex items-center gap-1 rounded px-1.5 py-0.5 text-ide-muted transition-colors hover:bg-ide-elevated hover:text-ide-text';

  return (
    <footer
      className="flex h-status shrink-0 items-center justify-between border-t border-ide-border bg-[var(--ide-status)] px-2 text-ide-xs"
      role="status"
    >
      <div className="flex items-center gap-0.5">
        {isRepo && branch && (
          <button
            type="button"
            className={item}
            onClick={() => setActivityView('git')}
            title="Source Control"
          >
            <GitBranch size={11} />
            <span className="text-ide-text">{branch}</span>
            {(ahead > 0 || behind > 0) && (
              <span>
                {ahead > 0 ? `↑${ahead}` : ''}
                {behind > 0 ? `↓${behind}` : ''}
              </span>
            )}
            {changeCount > 0 && <span>·{changeCount}</span>}
          </button>
        )}
        <button
          type="button"
          className={item}
          title="Problems"
          onClick={() => {
            setBottomPanelTab('problems');
            if (!useLayoutStore.getState().bottomPanelVisible) {
              useLayoutStore.setState({ bottomPanelVisible: true });
            }
          }}
        >
          <AlertCircle size={11} />
          <span>
            {diagCount}
            {warnCount > 0 ? `/${warnCount}` : ''}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-0.5">
        {activeTab && (
          <>
            <span className="px-1.5 text-ide-muted" title={activeTab.path}>
              {activeTab.language}
            </span>
            <span className="px-1.5 text-ide-muted">
              {insertSpaces ? 'Spaces' : 'Tabs'}: {tabSize}
            </span>
            {activeTab.isDirty && (
              <span className="px-1.5 text-ide-warning">Unsaved</span>
            )}
          </>
        )}
        {pendingEdits > 0 && (
          <button type="button" onClick={openEdits} className={item} title="Review AI edits">
            Edits {pendingEdits}
          </button>
        )}
        <button type="button" onClick={toggleAi} className={item} title="Sephora">
          {activeModel}
        </button>
      </div>
    </footer>
  );
}
