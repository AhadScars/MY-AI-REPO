import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  ExternalLink,
  Globe,
  Plus,
} from 'lucide-react';
import { useBrowserStore } from '../../stores/browserStore';
import { requireApi } from '../../services/platform';
import { cn } from '../../utils/cn';

/**
 * Built-in browser for HTML/CSS/JS previews and simple web pages.
 */
export function BrowserPanel() {
  const open = useBrowserStore((s) => s.open);
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const lastError = useBrowserStore((s) => s.lastError);
  const closeTab = useBrowserStore((s) => s.closeTab);
  const closeBrowser = useBrowserStore((s) => s.closeBrowser);
  const setActiveTab = useBrowserStore((s) => s.setActiveTab);
  const reloadActive = useBrowserStore((s) => s.reloadActive);
  const goBack = useBrowserStore((s) => s.goBack);
  const goForward = useBrowserStore((s) => s.goForward);
  const navigateActive = useBrowserStore((s) => s.navigateActive);
  const openUrl = useBrowserStore((s) => s.openUrl);

  const active = tabs.find((t) => t.id === activeTabId) ?? null;
  const [address, setAddress] = useState('');
  const [frameError, setFrameError] = useState<string | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setAddress(active?.url ?? '');
    setFrameError(null);
    setFrameLoaded(false);
  }, [active?.id, active?.url]);

  if (!open) return null;

  const canBack = Boolean(active && active.historyIndex > 0);
  const canForward = Boolean(
    active && active.historyIndex < active.history.length - 1,
  );

  const submitAddress = () => {
    if (!address.trim()) return;
    navigateActive(address.trim());
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-ide-panel">
      {/* Single compact chrome: tabs + nav + URL */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-ide-border/70 px-1.5">
        <div className="flex min-w-0 max-w-[40%] items-center gap-0.5 overflow-x-auto">
          {tabs.map((t) => {
            const isActive = t.id === activeTabId;
            return (
              <div
                key={t.id}
                className={cn(
                  'group flex h-6 max-w-[8rem] shrink-0 items-center rounded-md pl-2 pr-0.5',
                  isActive ? 'bg-ide-elevated text-ide-text' : 'text-ide-muted hover:text-ide-text',
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-ide-xs"
                  onClick={() => setActiveTab(t.id)}
                  title={t.url}
                >
                  {t.title}
                </button>
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded opacity-0 hover:bg-ide-bg group-hover:opacity-100"
                  onClick={() => closeTab(t.id)}
                  title="Close"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
            title="New tab"
            onClick={() => openUrl('https://', 'New Tab')}
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-ide-border/80" />

        <NavBtn label="Back" disabled={!canBack} onClick={goBack}>
          <ArrowLeft size={13} />
        </NavBtn>
        <NavBtn label="Forward" disabled={!canForward} onClick={goForward}>
          <ArrowRight size={13} />
        </NavBtn>
        <NavBtn label="Reload" onClick={reloadActive}>
          <RotateCw size={12} />
        </NavBtn>

        <form
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-ide-border/80 bg-ide-bg px-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitAddress();
          }}
        >
          <Globe size={11} className="shrink-0 text-ide-muted" />
          <input
            className="h-6 min-w-0 flex-1 bg-transparent text-ide-xs text-ide-text outline-none placeholder:text-ide-muted/50"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="URL or path…"
            spellCheck={false}
          />
        </form>

        {active && (
          <NavBtn
            label="Open in system browser"
            onClick={() => {
              void requireApi().openExternal({ url: active.url.split('?_r=')[0] ?? active.url });
            }}
          >
            <ExternalLink size={13} />
          </NavBtn>
        )}
        <NavBtn label="Close browser" onClick={closeBrowser}>
          <X size={13} />
        </NavBtn>
      </div>

      {lastError && (
        <div className="shrink-0 border-b border-ide-danger/25 bg-ide-danger/10 px-3 py-1 text-ide-xs text-ide-danger">
          {lastError}
        </div>
      )}

      <div className="relative min-h-0 flex-1 bg-white">
        {active ? (
          <>
            <iframe
              ref={iframeRef}
              key={active.url}
              title={active.title}
              src={active.url}
              className="absolute inset-0 h-full w-full border-0 bg-white"
              // Local preview server (http://127.0.0.1) — multi-file CSS/JS resolve correctly
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              onLoad={() => {
                setFrameLoaded(true);
                setFrameError(null);
              }}
              onError={() => {
                setFrameLoaded(true);
                setFrameError('Failed to load page in the built-in browser');
              }}
            />
            {!frameLoaded && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 text-ide-sm text-ide-muted">
                Loading preview…
              </div>
            )}
            {frameError && (
              <div className="absolute inset-x-0 bottom-0 border-t border-ide-danger/25 bg-ide-danger/10 px-3 py-2 text-ide-xs text-ide-danger">
                {frameError}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-ide-sm text-ide-muted">
            Open an .html file from the explorer to preview
          </div>
        )}
      </div>
    </div>
  );
}

function NavBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ide-muted transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-30'
          : 'hover:bg-ide-elevated hover:text-ide-text',
      )}
    >
      {children}
    </button>
  );
}
