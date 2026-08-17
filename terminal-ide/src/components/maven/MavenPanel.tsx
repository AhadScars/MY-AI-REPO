import { useEffect } from 'react';
import {
  Package,
  Download,
  RefreshCw,
  Hammer,
  FolderOpen,
  X,
  AlertCircle,
  CheckCircle2,
  Coffee,
} from 'lucide-react';
import { useMavenStore, ensureMavenRunExitHook } from '../../stores/mavenStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useRunStore } from '../../stores/runStore';
import { IconButton } from '../common/IconButton';
import { basename } from '../../../packages/shared/src/path';
import { cn } from '../../utils/cn';

/**
 * IntelliJ-style Maven / Gradle tool window:
 * Install or Reinstall dependencies on user choice.
 */
export function MavenPanel() {
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const closeSidebar = useLayoutStore((s) => s.closeSidebar);
  const project = useMavenStore((s) => s.project);
  const loading = useMavenStore((s) => s.loading);
  const busy = useMavenStore((s) => s.busy);
  const error = useMavenStore((s) => s.error);
  const status = useMavenStore((s) => s.status);
  const refresh = useMavenStore((s) => s.refresh);
  const installDependencies = useMavenStore((s) => s.installDependencies);
  const reinstallDependencies = useMavenStore((s) => s.reinstallDependencies);
  const compile = useMavenStore((s) => s.compile);
  const isRunning = useRunStore((s) => s.isRunning);
  const stop = useRunStore((s) => s.stop);

  const actionBusy = busy || isRunning;

  useEffect(() => {
    ensureMavenRunExitHook();
    void refresh();
  }, [rootPath, refresh]);

  const toolName =
    project?.tool === 'maven' ? 'Maven' : project?.tool === 'gradle' ? 'Gradle' : 'Maven';

  return (
    <div className="flex h-full flex-col bg-ide-sidebar">
      <div className="flex h-8 items-center justify-between border-b border-ide-border/60 px-2 pl-3">
        <span className="ide-section-label flex items-center gap-1.5">
          <Coffee size={12} className="text-ide-muted" />
          Maven
        </span>
        <div className="flex items-center">
          <IconButton
            label="Reload project"
            size="sm"
            disabled={!rootPath || loading}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
          </IconButton>
          <IconButton label="Close Sidebar (Ctrl+B)" size="sm" onClick={closeSidebar}>
            <X size={14} />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!rootPath ? (
          <div className="flex flex-col gap-3 text-ide-sm text-ide-muted">
            <p>Open a project folder that contains a <code className="text-ide-text">pom.xml</code> or <code className="text-ide-text">build.gradle</code>.</p>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-ide-accent/15 px-3 py-2 text-ide-sm text-ide-accent hover:bg-ide-accent/25"
              onClick={() => void openFolder()}
            >
              <FolderOpen size={14} />
              Open Folder…
            </button>
          </div>
        ) : loading && !project ? (
          <p className="text-ide-sm text-ide-muted">Detecting project…</p>
        ) : !project?.found ? (
          <div className="flex flex-col gap-2 text-ide-sm text-ide-muted">
            <div className="flex items-start gap-2 text-ide-warning">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{project?.reason ?? 'No Maven/Gradle project found in this folder.'}</span>
            </div>
            <p className="text-ide-xs">
              Looking under: <span className="text-ide-text">{basename(rootPath)}</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Project card */}
            <div className="rounded-md border border-ide-border/70 bg-ide-surface/60 p-3">
              <div className="flex items-start gap-2">
                <Package size={18} className="mt-0.5 shrink-0 text-ide-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ide-sm font-medium text-ide-text">
                    {basename(project.root ?? rootPath)}
                  </p>
                  <p className="mt-0.5 text-ide-xs text-ide-muted">{project.label}</p>
                  {project.buildFile && (
                    <p
                      className="mt-1 truncate text-[11px] text-ide-muted"
                      title={project.buildFile}
                    >
                      {basename(project.buildFile)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {project.isSpringBoot && (
                  <span className="rounded bg-ide-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-ide-accent">
                    Spring Boot
                  </span>
                )}
                {project.wrapper && (
                  <span className="rounded bg-ide-elevated px-1.5 py-0.5 text-[10px] text-ide-muted">
                    Wrapper
                  </span>
                )}
                {project.dependenciesMissing ? (
                  <span className="rounded bg-ide-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-ide-warning">
                    Dependencies not installed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-ide-success/15 px-1.5 py-0.5 text-[10px] font-medium text-ide-success">
                    <CheckCircle2 size={10} />
                    Build ready
                  </span>
                )}
              </div>
            </div>

            {/* Actions — user choice like IntelliJ */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ide-muted">
                Dependencies
              </p>
              <div className="flex flex-col gap-1.5">
                <ActionButton
                  icon={Download}
                  label="Install Dependencies"
                  description={`Download ${toolName} deps from the build file`}
                  disabled={!project.runnerAvailable || actionBusy}
                  primary={project.dependenciesMissing}
                  onClick={() => void installDependencies()}
                />
                <ActionButton
                  icon={RefreshCw}
                  label="Reinstall Dependencies"
                  description="Clean + re-download (force update)"
                  disabled={!project.runnerAvailable || actionBusy}
                  onClick={() => void reinstallDependencies()}
                />
                <ActionButton
                  icon={Hammer}
                  label="Compile Project"
                  description={`${toolName} compile / classes`}
                  disabled={!project.runnerAvailable || actionBusy}
                  onClick={() => void compile()}
                />
              </div>
            </div>

            {actionBusy && (
              <button
                type="button"
                className="rounded-md border border-ide-danger/40 px-3 py-1.5 text-ide-xs text-ide-danger hover:bg-ide-danger/10"
                onClick={() => void stop()}
              >
                Stop
              </button>
            )}

            {!project.runnerAvailable && project.reason && (
              <div className="flex gap-2 rounded-md border border-ide-warning/30 bg-ide-warning/5 p-2 text-ide-xs text-ide-warning">
                <AlertCircle size={14} className="shrink-0" />
                <span>{project.reason}</span>
              </div>
            )}

            {error && (
              <p className="text-ide-xs text-ide-danger">{error}</p>
            )}
            {status && !error && (
              <p className="text-ide-xs text-ide-muted">{status}</p>
            )}

            <p className="text-[11px] leading-relaxed text-ide-muted">
              Like IntelliJ: install dependencies here when you choose, then press{' '}
              <kbd className="rounded bg-ide-elevated px-1 text-ide-text">F5</kbd> to run the app.
              Progress appears in the <span className="text-ide-text">Output</span> panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  description,
  disabled,
  primary,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  description: string;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors',
        primary
          ? 'border-ide-accent/40 bg-ide-accent/10 hover:bg-ide-accent/15'
          : 'border-ide-border/60 bg-ide-surface/40 hover:bg-ide-elevated',
        disabled && 'cursor-not-allowed opacity-45 hover:bg-ide-surface/40',
      )}
    >
      <Icon
        size={15}
        className={cn('mt-0.5 shrink-0', primary ? 'text-ide-accent' : 'text-ide-muted')}
      />
      <span className="min-w-0">
        <span className="block text-ide-sm text-ide-text">{label}</span>
        <span className="block text-[11px] text-ide-muted">{description}</span>
      </span>
    </button>
  );
}
