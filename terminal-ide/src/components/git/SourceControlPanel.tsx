import { useEffect, useState } from 'react';
import {
  RefreshCw,
  Plus,
  Minus,
  Check,
  GitBranch,
  ArrowDown,
  ArrowUp,
  Upload,
  FileWarning,
  Download,
  History,
} from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEditorStore } from '../../stores/editorStore';
import { IconButton } from '../common/IconButton';
import { DiffViewer } from './DiffViewer';
import { basename } from '../../../packages/shared/src/path';
import type { GitChange, GitFileStatusCode, GitLogEntry } from '../../../packages/protocol/src/git';
import { cn } from '../../utils/cn';

function statusLetter(status: GitFileStatusCode): string {
  switch (status) {
    case 'modified':
      return 'M';
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'untracked':
      return 'U';
    case 'conflict':
      return 'C';
    case 'copied':
      return 'C';
    default:
      return status[0]?.toUpperCase() ?? '?';
  }
}

function statusColor(status: GitFileStatusCode): string {
  switch (status) {
    case 'modified':
      return 'text-ide-warning';
    case 'added':
    case 'untracked':
      return 'text-ide-success';
    case 'deleted':
    case 'conflict':
      return 'text-ide-danger';
    default:
      return 'text-ide-muted';
  }
}

/**
 * Simplified Source Control: stage → commit → push in a few clicks.
 */
export function SourceControlPanel() {
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const {
    isRepo,
    branch,
    ahead,
    behind,
    staged,
    unstaged,
    conflicted,
    branches,
    isLoading,
    isCommitting,
    isPushing,
    error,
    lastMessage,
    needsRemote,
    remotes,
    log,
    selectedDiff,
    diffLoading,
    refresh,
    setRemote,
    stage,
    unstage,
    discard,
    stageAll,
    unstageAll,
    commit,
    commitAndPush,
    checkout,
    createBranch,
    fetch,
    pull,
    push,
    initRepo,
    showDiff,
    clearDiff,
  } = useGitStore();

  const openFile = useEditorStore((s) => s.openFile);
  const saveAll = useEditorStore((s) => s.saveAll);
  const [message, setMessage] = useState('');
  const [branchName, setBranchName] = useState('');
  const [showBranchUi, setShowBranchUi] = useState(false);
  const [amend, setAmend] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRemote, setShowRemote] = useState(false);
  // Local edit buffer for Repo URL — re-seeded when project/remotes change
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteDirty, setRemoteDirty] = useState(false);

  const originUrl =
    remotes.find((r) => r.name === 'origin')?.pushUrl ||
    remotes[0]?.pushUrl ||
    remotes[0]?.fetchUrl ||
    '';

  // Project changed → reload git for this folder and reset message UI
  useEffect(() => {
    setMessage('');
    setBranchName('');
    setShowBranchUi(false);
    setAmend(false);
    setShowHistory(false);
    setShowRemote(false);
    setRemoteDirty(false);
    setRemoteUrl('');
    void refresh(rootPath);
  }, [rootPath, refresh]);

  // When remotes load for the current project, show that URL (or empty)
  useEffect(() => {
    if (!remoteDirty) {
      setRemoteUrl(originUrl);
    }
  }, [rootPath, originUrl, remoteDirty]);

  // Refresh SCM when window regains focus (everyday use)
  useEffect(() => {
    const onFocus = () => {
      if (rootPath) void refresh(rootPath);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [rootPath, refresh]);

  if (!rootPath) {
    return (
      <div className="p-3 text-ide-sm text-ide-muted">
        Open a folder to use Source Control.
      </div>
    );
  }

  if (!isRepo) {
    return (
      <div className="flex flex-col gap-3 p-3 text-ide-sm text-ide-muted">
        <p>This folder is not a Git repository yet.</p>
        <button
          type="button"
          className="rounded-sm bg-ide-accent px-3 py-2 text-ide-sm text-white hover:bg-ide-accent-hover"
          onClick={() => void initRepo()}
        >
          Initialize Repository
        </button>
        {error && <p className="text-ide-xs text-ide-danger">{error}</p>}
      </div>
    );
  }

  const totalChanges = staged.length + unstaged.length;
  const busy = isCommitting || isPushing;

  const onCommitOnly = async () => {
    await saveAll();
    if (unstaged.length > 0) {
      await stageAll();
    }
    const ok = await commit(message, { amend });
    if (ok) {
      setMessage('');
      setAmend(false);
    }
  };

  const onCommitAndPush = async () => {
    await saveAll();
    // Save remote first if user typed/changed the URL
    if (remoteUrl.trim() && remoteUrl.trim() !== originUrl) {
      const remoteOk = await setRemote(remoteUrl.trim());
      if (!remoteOk) return;
      setRemoteDirty(false);
    }
    if (!remoteUrl.trim() && !originUrl) {
      // No repo URL for this project yet
      return;
    }
    if (totalChanges === 0 && ahead > 0 && !amend) {
      await push({ confirm: false });
      return;
    }
    const ok = await commitAndPush(message, { push: true, amend });
    if (ok) {
      setMessage('');
      setAmend(false);
    }
  };

  const onSaveRemote = async () => {
    const ok = await setRemote(remoteUrl.trim());
    if (ok) {
      setRemoteDirty(false);
      setRemoteUrl(remoteUrl.trim());
    }
  };

  // Auto-expand remote if missing (push needs it)
  const remoteMissing = !originUrl;

  return (
    <div className="flex h-full min-h-0 flex-col" key={rootPath ?? 'no-project'}>
      {/* Branch + sync */}
      <div className="flex h-9 items-center gap-0.5 border-b border-ide-border/70 px-1.5">
        <GitBranch size={13} className="ml-1 shrink-0 text-ide-muted" />
        <button
          type="button"
          className="min-w-0 flex-1 truncate px-1 text-left text-ide-sm text-ide-text hover:text-ide-accent"
          onClick={() => setShowBranchUi((v) => !v)}
          title={branch ?? ''}
        >
          {branch ?? 'unknown'}
          {(ahead > 0 || behind > 0) && (
            <span className="ml-1 text-ide-xs text-ide-muted">
              {ahead > 0 && `↑${ahead}`}
              {behind > 0 && `↓${behind}`}
            </span>
          )}
        </button>
        <IconButton label="Refresh" size="sm" onClick={() => void refresh(rootPath)}>
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
        </IconButton>
        <IconButton label="Fetch" size="sm" onClick={() => void fetch()}>
          <Download size={13} />
        </IconButton>
        <IconButton label="Pull" size="sm" onClick={() => void pull()}>
          <ArrowDown size={13} />
        </IconButton>
        <IconButton label="Push" size="sm" onClick={() => void push({ confirm: true })}>
          <ArrowUp size={13} />
        </IconButton>
        <IconButton label="History" size="sm" onClick={() => setShowHistory((v) => !v)}>
          <History size={13} />
        </IconButton>
      </div>

      {showBranchUi && (
        <div className="border-b border-ide-border/70 px-2 py-2">
          <div className="mb-1.5 flex gap-1">
            <input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="New branch"
              className="min-w-0 flex-1 rounded-md border border-ide-border bg-ide-bg px-2 py-1 text-ide-xs text-ide-text outline-none focus:border-ide-accent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && branchName.trim()) {
                  void createBranch(branchName.trim()).then(() => {
                    setBranchName('');
                    setShowBranchUi(false);
                  });
                }
              }}
            />
            <button
              type="button"
              className="rounded-md bg-ide-accent px-2 py-1 text-ide-xs text-white disabled:opacity-40"
              disabled={!branchName.trim()}
              onClick={() => {
                if (branchName.trim()) {
                  void createBranch(branchName.trim()).then(() => {
                    setBranchName('');
                    setShowBranchUi(false);
                  });
                }
              }}
            >
              Create
            </button>
          </div>
          <div className="max-h-28 overflow-auto">
            {branches.map((b) => (
              <button
                key={b.name}
                type="button"
                className={cn(
                  'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-ide-xs hover:bg-ide-elevated',
                  b.current && 'text-ide-accent',
                )}
                onClick={() => {
                  if (!b.current) void checkout(b.name);
                  setShowBranchUi(false);
                }}
              >
                <GitBranch size={11} className="opacity-60" />
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Remote — collapsed unless needed */}
      <div className="border-b border-ide-border/70">
        <button
          type="button"
          className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-ide-xs text-ide-muted hover:bg-ide-elevated/50 hover:text-ide-text"
          onClick={() => setShowRemote((v) => !v)}
        >
          <span className="truncate">
            Remote
            {originUrl ? (
              <span className="ml-1.5 text-ide-muted/80">
                · {originUrl.replace(/^https?:\/\//, '').slice(0, 28)}
                {originUrl.length > 36 ? '…' : ''}
              </span>
            ) : (
              <span className="ml-1.5 text-ide-warning">· not set</span>
            )}
          </span>
          <span className="text-[10px] opacity-60">{showRemote || remoteMissing ? '▲' : '▼'}</span>
        </button>
        {(showRemote || remoteMissing || needsRemote) && (
          <div className="flex gap-1 px-2 pb-2">
            <input
              type="url"
              value={remoteUrl}
              onChange={(e) => {
                setRemoteUrl(e.target.value);
                setRemoteDirty(true);
              }}
              placeholder="https://github.com/user/repo.git"
              className={cn(
                'min-w-0 flex-1 rounded-md border bg-ide-bg px-2 py-1 text-ide-xs text-ide-text outline-none focus:border-ide-accent',
                remoteMissing ? 'border-ide-warning/50' : 'border-ide-border',
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSaveRemote();
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-md bg-ide-elevated px-2 py-1 text-ide-xs text-ide-text hover:bg-ide-border disabled:opacity-40"
              disabled={!remoteUrl.trim() || remoteUrl.trim() === originUrl}
              onClick={() => void onSaveRemote()}
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Commit box */}
      <div className="border-b border-ide-border/70 p-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder={
            totalChanges > 0
              ? `Message · ${totalChanges} change${totalChanges === 1 ? '' : 's'}`
              : ahead > 0
                ? `${ahead} commit(s) ready to push`
                : 'Commit message'
          }
          className="mb-1.5 w-full resize-none rounded-md border border-ide-border bg-ide-bg px-2.5 py-2 text-ide-sm text-ide-text outline-none placeholder:text-ide-muted/50 focus:border-ide-accent"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void onCommitAndPush();
            }
          }}
        />

        <div className="mb-1.5 flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-ide-xs text-ide-muted">
            <input
              type="checkbox"
              className="accent-ide-accent"
              checked={amend}
              onChange={(e) => setAmend(e.target.checked)}
            />
            Amend
          </label>
        </div>

        <button
          type="button"
          disabled={
            busy ||
            (totalChanges === 0 && ahead === 0 && !amend) ||
            (totalChanges > 0 && !message.trim() && !amend)
          }
          className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-md bg-ide-accent py-1.5 text-ide-sm font-medium text-white transition-colors hover:bg-ide-accent-hover disabled:opacity-40"
          onClick={() => void onCommitAndPush()}
          title="Stage all → Commit → Push (Ctrl+Enter)"
        >
          <Upload size={14} />
          {busy
            ? isPushing
              ? 'Pushing…'
              : 'Working…'
            : amend
              ? 'Amend & Push'
              : totalChanges > 0
                ? 'Commit & Push'
                : ahead > 0
                  ? `Push ${ahead}`
                  : 'Commit & Push'}
        </button>

        <div className="flex gap-1">
          <button
            type="button"
            disabled={busy || ((!message.trim() && !amend) || (totalChanges === 0 && !amend))}
            className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-ide-xs text-ide-muted transition-colors hover:bg-ide-elevated hover:text-ide-text disabled:opacity-30"
            onClick={() => void onCommitOnly()}
            title="Commit only"
          >
            <Check size={12} />
            Commit
          </button>
          <button
            type="button"
            disabled={busy || unstaged.length === 0}
            className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-ide-xs text-ide-muted transition-colors hover:bg-ide-elevated hover:text-ide-text disabled:opacity-30"
            onClick={() => void stageAll()}
            title="Stage all"
          >
            <Plus size={12} />
            Stage
          </button>
          <button
            type="button"
            disabled={busy || ahead === 0}
            className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-ide-xs text-ide-muted transition-colors hover:bg-ide-elevated hover:text-ide-text disabled:opacity-30"
            onClick={() => void push({ confirm: false })}
            title="Push"
          >
            <ArrowUp size={12} />
            Push
          </button>
        </div>
      </div>

      {showHistory && log.length > 0 && (
        <CommitHistory log={log} onClose={() => setShowHistory(false)} />
      )}

      {(error || lastMessage) && (
        <div
          className={cn(
            'border-b border-ide-border/70 px-2.5 py-1.5 text-ide-xs',
            error ? 'bg-ide-danger/10 text-ide-danger' : 'text-ide-success',
          )}
        >
          {error ?? lastMessage}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {conflicted.length > 0 && (
          <ChangeSection
            title="Merge Conflicts"
            count={conflicted.length}
            icon={<FileWarning size={12} className="text-ide-danger" />}
            changes={conflicted}
            onOpen={(c) => void openFile(c.path, false)}
            onDiff={(c) => void showDiff(c.path, false)}
          />
        )}

        <ChangeSection
          title="Staged"
          count={staged.length}
          actions={
            staged.length > 0 ? (
              <button
                type="button"
                className="text-ide-xs text-ide-muted hover:text-ide-text"
                onClick={() => void unstageAll()}
              >
                Unstage all
              </button>
            ) : null
          }
          changes={staged}
          onOpen={(c) => void openFile(c.path, false)}
          onDiff={(c) => void showDiff(c.path, true)}
          primaryAction={{
            icon: <Minus size={12} />,
            label: 'Unstage',
            onClick: (c) => void unstage([c.path]),
          }}
        />

        <ChangeSection
          title="Changes"
          count={unstaged.length}
          actions={
            unstaged.length > 0 ? (
              <button
                type="button"
                className="text-ide-xs text-ide-muted hover:text-ide-text"
                onClick={() => void stageAll()}
              >
                Stage all
              </button>
            ) : null
          }
          changes={unstaged}
          onOpen={(c) => void openFile(c.path, false)}
          onDiff={(c) => void showDiff(c.path, false)}
          primaryAction={{
            icon: <Plus size={12} />,
            label: 'Stage',
            onClick: (c) => void stage([c.path]),
          }}
          secondaryAction={{
            icon: <Minus size={12} />,
            label: 'Discard',
            onClick: (c) => void discard([c.path]),
          }}
        />

        {totalChanges === 0 && conflicted.length === 0 && (
          <div className="px-3 py-6 text-center text-ide-xs text-ide-muted">
            {ahead > 0 ? `${ahead} commit(s) ready to push` : 'No changes'}
          </div>
        )}
      </div>

      {(selectedDiff || diffLoading) && (
        <div className="flex h-[40%] min-h-[120px] flex-col">
          {diffLoading && (
            <div className="p-2 text-ide-xs text-ide-muted">Loading diff…</div>
          )}
          {selectedDiff && <DiffViewer diff={selectedDiff} onClose={clearDiff} />}
        </div>
      )}
    </div>
  );
}

function CommitHistory({
  log,
  onClose,
}: {
  log: GitLogEntry[];
  onClose: () => void;
}) {
  return (
    <div className="max-h-36 shrink-0 overflow-auto border-b border-ide-border/70">
      <div className="flex h-7 items-center justify-between px-2.5">
        <span className="text-ide-xs text-ide-muted">History</span>
        <button type="button" className="text-ide-xs text-ide-muted hover:text-ide-text" onClick={onClose}>
          Hide
        </button>
      </div>
      <ul>
        {log.slice(0, 12).map((entry) => (
          <li key={entry.hash} className="px-2.5 py-1 hover:bg-ide-elevated/40" title={entry.hash}>
            <div className="truncate text-ide-xs text-ide-text">{entry.subject}</div>
            <div className="truncate text-[10px] text-ide-muted">
              <span className="font-mono">{entry.shortHash || entry.hash.slice(0, 7)}</span>
              {entry.author ? ` · ${entry.author}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangeSection({
  title,
  count,
  icon,
  actions,
  changes,
  onOpen,
  onDiff,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  changes: GitChange[];
  onOpen: (c: GitChange) => void;
  onDiff: (c: GitChange) => void;
  primaryAction?: {
    icon: React.ReactNode;
    label: string;
    onClick: (c: GitChange) => void;
  };
  secondaryAction?: {
    icon: React.ReactNode;
    label: string;
    onClick: (c: GitChange) => void;
  };
}) {
  if (count === 0 && !icon) return null;
  if (count === 0) return null;

  return (
    <div className="border-b border-ide-border/50">
      <div className="flex h-7 items-center justify-between px-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ide-muted">
          {icon}
          {title}
          <span className="font-normal tabular-nums opacity-70">{count}</span>
        </span>
        {actions}
      </div>
      <ul>
        {changes.map((c) => (
          <li
            key={`${c.staged ? 's' : 'u'}:${c.path}`}
            className="group flex items-center gap-0.5 px-1 py-0.5 hover:bg-ide-elevated/60"
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate px-1.5 py-0.5 text-left text-ide-sm text-ide-text"
              title={c.path}
              onClick={() => onOpen(c)}
              onDoubleClick={() => onDiff(c)}
            >
              <span className={cn('mr-1.5 inline-block w-3 font-mono text-[11px]', statusColor(c.status))}>
                {statusLetter(c.status)}
              </span>
              {basename(c.relativePath || c.path)}
            </button>
            {primaryAction && (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-ide-muted opacity-0 hover:bg-ide-border/50 hover:text-ide-text group-hover:opacity-100"
                title={primaryAction.label}
                onClick={() => primaryAction.onClick(c)}
              >
                {primaryAction.icon}
              </button>
            )}
            {secondaryAction && (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-ide-muted opacity-0 hover:bg-ide-border/50 hover:text-ide-text group-hover:opacity-100"
                title={secondaryAction.label}
                onClick={() => secondaryAction.onClick(c)}
              >
                {secondaryAction.icon}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
