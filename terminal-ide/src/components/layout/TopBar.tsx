import { AppMenuBar } from './AppMenuBar';
import { PanelToggles } from './PanelToggles';
import { APP_LOGO_PNG } from '../../utils/assets';

/**
 * Top toolbar:
 * Left  — app icon · File · View · Help
 * Right — Explorer · DB · Terminal · Sephora toggles
 */
export function TopBar() {
  return (
    <header className="titlebar-drag flex h-9 shrink-0 items-center border-b border-ide-border bg-ide-surface">
      {/* Left: app icon + menus */}
      <div className="titlebar-no-drag flex shrink-0 items-center gap-1.5 pl-2 pr-1">
        <img
          src={APP_LOGO_PNG}
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px] shrink-0 select-none rounded-sm object-contain"
          draggable={false}
          title="Terminal - IDE"
        />
        <AppMenuBar />
      </div>

      {/* Center drag region */}
      <div className="min-w-0 flex-1 self-stretch" aria-hidden />

      {/* Right: panel toggles (clear of Windows − □ ×) */}
      <div className="titlebar-no-drag flex shrink-0 items-center pr-[138px] pl-1">
        <PanelToggles />
      </div>
    </header>
  );
}
