import { useEditorStore } from '../../stores/editorStore';
import { EditorTabs } from './EditorTabs';
import { MonacoEditor } from './MonacoEditor';
import { Breadcrumbs } from './Breadcrumbs';
import { InlineAiPrompt } from './InlineAiPrompt';
import { WelcomePage } from './WelcomePage';
import { RunToolbar } from '../run/RunToolbar';
import { cn } from '../../utils/cn';

export function EditorArea() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTab = useEditorStore((s) => s.getActiveTab());
  const updateContent = useEditorStore((s) => s.updateContent);
  const saveActive = useEditorStore((s) => s.saveActive);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-ide-bg">
      <div className="flex shrink-0 items-stretch">
        <div className="min-w-0 flex-1 overflow-hidden">
          <EditorTabs />
        </div>
        <RunToolbar />
      </div>
      <InlineAiPrompt />

      {tabs.length === 0 || !activeTab ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <WelcomePage />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <Breadcrumbs filePath={activeTab.path} />
          {/* Keep each open tab mounted so switching is instant and scroll/cursor persist */}
          <div className="relative min-h-0 flex-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              return (
                <div
                  key={tab.id}
                  className={cn(
                    'absolute inset-0 min-h-0',
                    isActive ? 'z-10 block' : 'pointer-events-none invisible z-0',
                  )}
                  aria-hidden={!isActive}
                >
                  <MonacoEditor
                    tabId={tab.id}
                    path={tab.path}
                    value={tab.content}
                    language={tab.language}
                    onChange={(value) => updateContent(tab.id, value)}
                    onSave={() => void saveActive()}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
