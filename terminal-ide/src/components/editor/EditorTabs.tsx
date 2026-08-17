import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { cn } from '../../utils/cn';

/**
 * Multi-file editor tab strip: switch, close, scroll when many tabs are open.
 */
export function EditorTabs() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const closeOtherTabs = useEditorStore((s) => s.closeOtherTabs);
  const closeAllTabs = useEditorStore((s) => s.closeAllTabs);
  const promotePreview = useEditorStore((s) => s.promotePreview);
  const listRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  // Keep the active tab visible in the horizontal scroller
  useEffect(() => {
    if (!activeTabId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-tab-id="${activeTabId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);

  // Horizontal wheel scroll over the tab bar
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        node.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [tabs.length]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  if (tabs.length === 0) return null;

  return (
    <div className="relative flex min-w-0 flex-1 items-stretch">
      <div
        ref={listRef}
        className="editor-tabs flex h-8 min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden border-b border-ide-border bg-ide-surface"
        role="tablist"
        aria-label="Open editors"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={active}
              className={cn(
                'group flex h-full min-w-[88px] max-w-[min(200px,40vw)] shrink-0 items-center gap-1 border-r border-ide-border px-2.5 text-ide-xs',
                active
                  ? 'border-b border-b-ide-accent bg-ide-tab-active text-ide-text'
                  : 'bg-transparent text-ide-muted hover:bg-ide-elevated/60 hover:text-ide-text',
              )}
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={() => promotePreview(tab.id)}
              onAuxClick={(e) => {
                // Middle mouse button closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  e.stopPropagation();
                  void closeTab(tab.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
              }}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                title={tab.path}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(tab.id);
                }}
              >
                {tab.isDirty && <span className="mr-1 text-ide-text">●</span>}
                {tab.isPreview ? (
                  <em className="opacity-80">{tab.name}</em>
                ) : (
                  tab.name
                )}
              </button>
              <button
                type="button"
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-ide-border',
                  active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                )}
                aria-label={`Close ${tab.name}`}
                title="Close (Ctrl+W)"
                onClick={(e) => {
                  e.stopPropagation();
                  void closeTab(tab.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {menu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-sm border border-ide-border bg-ide-surface py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-ide-sm text-ide-text hover:bg-ide-elevated"
            role="menuitem"
            onClick={() => {
              void closeTab(menu.tabId);
              setMenu(null);
            }}
          >
            Close
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-ide-sm text-ide-text hover:bg-ide-elevated"
            role="menuitem"
            onClick={() => {
              void closeOtherTabs(menu.tabId);
              setMenu(null);
            }}
          >
            Close Others
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-ide-sm text-ide-text hover:bg-ide-elevated"
            role="menuitem"
            onClick={() => {
              void closeAllTabs();
              setMenu(null);
            }}
          >
            Close All
          </button>
        </div>
      )}
    </div>
  );
}
