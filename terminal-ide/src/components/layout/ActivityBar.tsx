import { Files, Search, GitBranch, Database, Settings, Coffee } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import type { ActivityView } from '../../../packages/types/src/layout';
import { IconButton } from '../common/IconButton';
import { cn } from '../../utils/cn';

/** Left activity rail — file explorer + other views (always available). */
const ITEMS: Array<{ id: ActivityView; label: string; icon: typeof Files }> = [
  { id: 'explorer', label: 'Explorer (files)', icon: Files },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'git', label: 'Source Control', icon: GitBranch },
  { id: 'maven', label: 'Maven / Dependencies', icon: Coffee },
  { id: 'database', label: 'Database (SQL)', icon: Database },
];

export function ActivityBar() {
  const activityView = useLayoutStore((s) => s.activityView);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const openSettings = useLayoutStore((s) => s.openSettings);

  return (
    <aside
      className="flex w-activity shrink-0 flex-col items-center border-r border-ide-border bg-ide-activity py-2"
      aria-label="Activity Bar"
    >
      <div className="flex flex-1 flex-col items-center gap-1">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = sidebarVisible && activityView === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={active}
              onClick={() => {
                // Always open the chosen view (file explorer first item)
                if (active) {
                  useLayoutStore.setState({ sidebarVisible: false });
                } else {
                  useLayoutStore.setState({
                    sidebarVisible: true,
                    activityView: id,
                  });
                }
              }}
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-md text-ide-muted transition-colors',
                'hover:bg-ide-elevated hover:text-ide-text',
                active && 'bg-ide-elevated text-ide-text',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ide-accent" />
              )}
              <Icon size={18} strokeWidth={1.6} />
            </button>
          );
        })}
      </div>
      <IconButton
        label="Settings"
        onClick={openSettings}
        className="mb-1 h-9 w-9 rounded-md text-ide-muted"
      >
        <Settings size={18} strokeWidth={1.6} />
      </IconButton>
    </aside>
  );
}
