import { useEffect, useState } from 'react';
import {
  FolderOpen,
  FilePlus,
  FolderPlus,
  GitBranch,
  Clock,
  Keyboard,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { requireApi } from '../../services/platform';
import { basename } from '../../../packages/shared/src/path';
import { cn } from '../../utils/cn';
import { APP_LOGO_PNG } from '../../utils/assets';

/**
 * Minimal professional welcome / start screen shown when no editor tab is open.
 */
export function WelcomePage() {
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const recentPaths = useWorkspaceStore((s) => s.recentPaths);
  const loadRecent = useWorkspaceStore((s) => s.loadRecent);
  const removeRecent = useWorkspaceStore((s) => s.removeRecent);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const createFolder = useWorkspaceStore((s) => s.createFolder);
  const openUntitled = useEditorStore((s) => s.openUntitled);
  const openCommandPalette = useLayoutStore((s) => s.openCommandPalette);
  const openQuickOpen = useLayoutStore((s) => s.openQuickOpen);
  const openSettings = useLayoutStore((s) => s.openSettings);

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneBusy, setCloneBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Refresh Recent from disk, but loadRecent merges and never wipes a non-empty list
    void loadRecent();
  }, [loadRecent, rootPath]);

  const onNewFolder = async () => {
    setError(null);
    try {
      const api = requireApi();
      // Pick parent directory
      const pick = await api.openFolder();
      if (pick.canceled || !pick.path) return;
      const name = window.prompt('Folder name');
      if (!name?.trim()) return;
      const path = await createFolder(pick.path, name.trim());
      if (path) {
        setStatus(`Created folder: ${name.trim()}`);
        // Open parent as workspace so the new folder appears in the tree
        await openFolder(pick.path);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create folder');
    }
  };

  const onClone = async () => {
    const url = cloneUrl.trim();
    if (!url) {
      setError('Enter a Git repository URL');
      return;
    }
    setCloneBusy(true);
    setError(null);
    setStatus(null);
    try {
      const api = requireApi();
      const pick = await api.openFolder();
      if (pick.canceled || !pick.path) {
        setCloneBusy(false);
        return;
      }
      setStatus('Cloning repository…');
      const result = await api.gitClone({ url, parentDir: pick.path });
      setStatus(`Cloned to ${result.path}`);
      setCloneOpen(false);
      setCloneUrl('');
      await openFolder(result.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clone failed');
    } finally {
      setCloneBusy(false);
    }
  };

  const startItem =
    'group flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-ide-sm text-ide-text transition-colors hover:bg-ide-elevated';

  const recentLimit = recentPaths.slice(0, 4);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* Watermark — stays inside the pane, never causes scroll */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
        aria-hidden
      >
        <img
          src={APP_LOGO_PNG}
          alt=""
          className="h-[min(40%,16rem)] w-[min(40%,16rem)] max-h-[220px] max-w-[220px] select-none object-contain opacity-[0.12]"
          draggable={false}
        />
      </div>

      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
        {/* Header */}
        <header className="flex shrink-0 flex-col items-center gap-1.5 pb-3 text-center sm:gap-2 sm:pb-4">
          <img
            src={APP_LOGO_PNG}
            alt="Terminal - IDE"
            width={56}
            height={56}
            className="h-10 w-10 shrink-0 select-none object-contain drop-shadow-md sm:h-14 sm:w-14"
            draggable={false}
          />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-ide-text sm:text-xl">
              Terminal - IDE
            </h1>
            <p className="mt-0.5 truncate text-ide-xs text-ide-muted sm:text-ide-sm">
              Your Personal Code Editor
            </p>
          </div>
        </header>

        {/* Start + Recent — fills leftover height, no page scroll */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden sm:grid-cols-2 sm:gap-8">
          <section className="flex min-h-0 flex-col overflow-hidden">
            <h2 className="ide-section-label mb-1.5 shrink-0">Start</h2>
            <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
              <button type="button" className={startItem} onClick={() => void openFolder()}>
                <FolderOpen size={15} className="shrink-0 text-ide-muted group-hover:text-ide-accent" />
                <span className="truncate">Open Folder…</span>
              </button>
              <button type="button" className={startItem} onClick={() => openUntitled()}>
                <FilePlus size={15} className="shrink-0 text-ide-muted group-hover:text-ide-accent" />
                <span className="truncate">New File</span>
              </button>
              <button type="button" className={startItem} onClick={() => void onNewFolder()}>
                <FolderPlus size={15} className="shrink-0 text-ide-muted group-hover:text-ide-accent" />
                <span className="truncate">New Folder…</span>
              </button>
              <button
                type="button"
                className={startItem}
                onClick={() => {
                  setCloneOpen((v) => !v);
                  setError(null);
                }}
              >
                <GitBranch size={15} className="shrink-0 text-ide-muted group-hover:text-ide-accent" />
                <span className="truncate">Clone Git Repository…</span>
              </button>
            </div>

            {cloneOpen && (
              <div className="mt-2 shrink-0 rounded-md border border-ide-border bg-ide-surface p-2">
                <label className="mb-1 block text-ide-xs text-ide-muted">Repository URL</label>
                <input
                  type="url"
                  autoFocus
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="mb-1.5 w-full rounded-md border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm text-ide-text outline-none focus:border-ide-accent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void onClone();
                  }}
                  disabled={cloneBusy}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={cloneBusy || !cloneUrl.trim()}
                    onClick={() => void onClone()}
                    className="rounded-md bg-ide-accent px-2.5 py-1 text-ide-xs font-medium text-white hover:bg-ide-accent-hover disabled:opacity-40"
                  >
                    {cloneBusy ? 'Cloning…' : 'Clone & Open'}
                  </button>
                  <button
                    type="button"
                    disabled={cloneBusy}
                    onClick={() => {
                      setCloneOpen(false);
                      setCloneUrl('');
                    }}
                    className="rounded-md border border-ide-border px-2.5 py-1 text-ide-xs text-ide-muted hover:bg-ide-elevated"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden">
            <h2 className="ide-section-label mb-1.5 shrink-0">Recent</h2>
            {recentLimit.length === 0 ? (
              <p className="px-2 text-ide-sm text-ide-muted">No recent folders yet.</p>
            ) : (
              <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {recentLimit.map((p) => (
                  <li key={p} className="group flex min-w-0 shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={cn(startItem, 'min-w-0 flex-1')}
                      onClick={() => void openFolder(p)}
                      title={p}
                    >
                      <Clock size={15} className="shrink-0 text-ide-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ide-text">{basename(p)}</span>
                        <span className="block truncate text-ide-xs text-ide-muted">{p}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mr-1 hidden shrink-0 rounded px-1.5 py-1 text-ide-xs text-ide-muted hover:bg-ide-elevated hover:text-ide-text group-hover:inline"
                      title="Remove from recent"
                      onClick={() => void removeRecent(p)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {rootPath && (
              <p className="mt-1.5 shrink-0 truncate px-2 text-ide-xs text-ide-muted">
                Current: <span className="text-ide-text">{basename(rootPath)}</span>
              </p>
            )}
          </section>
        </div>

        {/* Help — compact, wraps instead of overflowing */}
        <section className="mt-3 shrink-0 border-t border-ide-border pt-2.5 sm:mt-4 sm:pt-3">
          <h2 className="ide-section-label mb-1.5">Help</h2>
          <div className="grid grid-cols-1 gap-0.5 min-[480px]:grid-cols-2">
            <button type="button" className={startItem} onClick={openCommandPalette}>
              <Keyboard size={15} className="shrink-0 text-ide-muted" />
              <span className="min-w-0 truncate">
                Show All Commands
                <span className="ml-1.5 text-ide-xs text-ide-muted">Ctrl+Shift+P</span>
              </span>
            </button>
            <button type="button" className={startItem} onClick={openQuickOpen}>
              <BookOpen size={15} className="shrink-0 text-ide-muted" />
              <span className="min-w-0 truncate">
                Go to File
                <span className="ml-1.5 text-ide-xs text-ide-muted">Ctrl+P</span>
              </span>
            </button>
            <button type="button" className={startItem} onClick={openSettings}>
              <Keyboard size={15} className="shrink-0 text-ide-muted" />
              <span className="min-w-0 truncate">
                Settings
                <span className="ml-1.5 text-ide-xs text-ide-muted">Ctrl+,</span>
              </span>
            </button>
            <button
              type="button"
              className={startItem}
              onClick={() =>
                void requireApi().showMessage({
                  type: 'info',
                  title: 'About Terminal - IDE',
                  message: 'Terminal - IDE',
                  detail:
                    'Minimal AI-powered code editor for Windows.\n\nShortcuts:\n• F5 Run file\n• Ctrl+F Find\n• Ctrl+Shift+F Search workspace\n• Ctrl+` Terminal\n• Ctrl+B Sidebar',
                })
              }
            >
              <ExternalLink size={15} className="shrink-0 text-ide-muted" />
              <span className="truncate">About & shortcuts</span>
            </button>
          </div>
        </section>

        {(error || status) && (
          <p
            className={cn(
              'mt-2 shrink-0 truncate text-ide-xs',
              error ? 'text-ide-danger' : 'text-ide-success',
            )}
            title={error ?? status ?? undefined}
          >
            {error ?? status}
          </p>
        )}

        <footer className="mt-2 shrink-0 border-t border-ide-border/70 pt-2 text-center">
          <p className="truncate text-ide-xs tracking-wide text-ide-muted">
            <span className="font-medium text-ide-text/80">Terminal - IDE</span>
            <span className="mx-2 text-ide-border">·</span>
            Start coding
          </p>
        </footer>
      </div>
    </div>
  );
}
