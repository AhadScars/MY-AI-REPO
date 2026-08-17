import { RefreshCw, FolderOpen, FilePlus, FolderPlus, X, Minus } from 'lucide-react';
import { useState } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEditorStore } from '../../stores/editorStore';
import { useGitStore } from '../../stores/gitStore';
import { FileTree } from './FileTree';
import { SourceControlPanel } from '../git/SourceControlPanel';
import { SearchPanel } from '../search/SearchPanel';
import { DatabasePanel } from '../sql/DatabasePanel';
import { MavenPanel } from '../maven/MavenPanel';
import { IconButton } from '../common/IconButton';
import { dirname } from '../../../packages/shared/src/path';
import type { TreeNode } from '../../../packages/types/src/workspace';

export function Sidebar() {
  const activityView = useLayoutStore((s) => s.activityView);
  const closeSidebar = useLayoutStore((s) => s.closeSidebar);
  const name = useWorkspaceStore((s) => s.name);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const tree = useWorkspaceStore((s) => s.tree);
  const selectedPath = useWorkspaceStore((s) => s.selectedPath);
  const refresh = useWorkspaceStore((s) => s.refresh);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const collapseAll = useWorkspaceStore((s) => s.collapseAll);
  const createFile = useWorkspaceStore((s) => s.createFile);
  const createFolder = useWorkspaceStore((s) => s.createFolder);
  const openFile = useEditorStore((s) => s.openFile);
  const gitRefresh = useGitStore((s) => s.refresh);
  const stagedCount = useGitStore((s) => s.staged.length);
  const unstagedCount = useGitStore((s) => s.unstaged.length);
  const [prompt, setPrompt] = useState<'file' | 'folder' | null>(null);
  const [nameInput, setNameInput] = useState('');

  // Database / Maven use their own full panel chrome
  if (activityView === 'database') {
    return <DatabasePanel />;
  }
  if (activityView === 'maven') {
    return <MavenPanel />;
  }

  const title =
    activityView === 'explorer'
      ? 'Explorer'
      : activityView === 'search'
        ? 'Search'
        : activityView === 'git'
          ? 'Source Control'
          : 'Explorer';

  const resolveParent = (): string | null => {
    if (!rootPath) return null;
    if (!selectedPath) return rootPath;
    const find = (nodes: TreeNode[], path: string): TreeNode | null => {
      for (const n of nodes) {
        if (n.path === path) return n;
        if (n.children) {
          const f = find(n.children, path);
          if (f) return f;
        }
      }
      return null;
    };
    const node = find(tree, selectedPath);
    if (node?.type === 'directory') return selectedPath;
    return dirname(selectedPath);
  };

  const submitCreate = async () => {
    const parent = resolveParent();
    if (!parent || !prompt || !nameInput.trim()) {
      setPrompt(null);
      setNameInput('');
      return;
    }
    if (prompt === 'file') {
      const path = await createFile(parent, nameInput.trim());
      if (path) void openFile(path, false);
    } else {
      await createFolder(parent, nameInput.trim());
    }
    setPrompt(null);
    setNameInput('');
  };

  return (
    <div className="flex h-full flex-col bg-ide-sidebar">
      <div className="flex h-8 items-center justify-between border-b border-ide-border/60 px-2 pl-3">
        <span className="ide-section-label">{title}</span>
        <div className="flex items-center">
          {activityView === 'explorer' && (
            <>
              <IconButton
                label="New File"
                size="sm"
                disabled={!rootPath}
                onClick={() => {
                  setPrompt('file');
                  setNameInput('');
                }}
              >
                <FilePlus size={14} />
              </IconButton>
              <IconButton
                label="New Folder"
                size="sm"
                disabled={!rootPath}
                onClick={() => {
                  setPrompt('folder');
                  setNameInput('');
                }}
              >
                <FolderPlus size={14} />
              </IconButton>
              <IconButton label="Open Folder" size="sm" onClick={() => void openFolder()}>
                <FolderOpen size={14} />
              </IconButton>
              <IconButton
                label="Refresh"
                size="sm"
                onClick={() => {
                  void refresh();
                  void gitRefresh(rootPath);
                }}
              >
                <RefreshCw size={14} />
              </IconButton>
            </>
          )}
          {activityView === 'git' && (
            <span className="mr-1 text-ide-xs text-ide-muted">
              {stagedCount + unstagedCount > 0 ? stagedCount + unstagedCount : ''}
            </span>
          )}
          <IconButton
            label="Close Sidebar (Ctrl+B)"
            size="sm"
            onClick={closeSidebar}
          >
            <X size={14} />
          </IconButton>
        </div>
      </div>

      {activityView === 'explorer' && (
        <>
          {(name || rootPath) && (
            <div className="flex items-center gap-1 border-b border-ide-border/40 px-2 py-1">
              <span
                className="min-w-0 flex-1 truncate px-1 text-ide-xs font-semibold uppercase tracking-wide text-ide-text"
                title={rootPath ?? name ?? ''}
              >
                {name ?? 'Project'}
              </span>
              <button
                type="button"
                title="Collapse all folders"
                aria-label="Collapse all folders"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ide-muted transition-colors hover:bg-ide-elevated hover:text-ide-text"
                onClick={() => collapseAll()}
              >
                <Minus size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
          {prompt && (
            <div className="border-b border-ide-border px-2 py-1">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitCreate();
                  if (e.key === 'Escape') {
                    setPrompt(null);
                    setNameInput('');
                  }
                }}
                placeholder={prompt === 'file' ? 'filename.ext' : 'folder-name'}
                className="w-full rounded-sm border border-ide-accent bg-ide-bg px-1.5 py-0.5 text-ide-sm text-ide-text outline-none"
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            <FileTree />
          </div>
        </>
      )}

      {activityView === 'search' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <SearchPanel />
        </div>
      )}

      {activityView === 'git' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <SourceControlPanel />
        </div>
      )}

    </div>
  );
}
