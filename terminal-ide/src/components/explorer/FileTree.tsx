import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  Globe,
} from 'lucide-react';
import type { TreeNode } from '../../../packages/types/src/workspace';
import type { GitFileStatusCode } from '../../../packages/protocol/src/git';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEditorStore } from '../../stores/editorStore';
import { useGitStore } from '../../stores/gitStore';
import { useBrowserStore } from '../../stores/browserStore';
import { requireApi } from '../../services/platform';
import { dirname } from '../../../packages/shared/src/path';
import { cn } from '../../utils/cn';

function gitLetter(status: GitFileStatusCode): string {
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
    default:
      return '';
  }
}

function gitColor(status: GitFileStatusCode): string {
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

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode | null;
  /** null node = root context */
}

interface InlineEditState {
  mode: 'create-file' | 'create-folder' | 'rename';
  parentPath: string;
  targetPath?: string;
  initial: string;
}

function FileTreeNode({
  node,
  depth,
  onContextMenu,
}: {
  node: TreeNode;
  depth: number;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
}) {
  const toggleExpand = useWorkspaceStore((s) => s.toggleExpand);
  const selectedPath = useWorkspaceStore((s) => s.selectedPath);
  const setSelectedPath = useWorkspaceStore((s) => s.setSelectedPath);
  const openFile = useEditorStore((s) => s.openFile);
  const activeTab = useEditorStore((s) => s.getActiveTab());
  const gitStatus = useGitStore((s) => s.getStatusForPath(node.path));
  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
  const isActive = !!activeTab && norm(activeTab.path) === norm(node.path);
  const isSelected = !!selectedPath && norm(selectedPath) === norm(node.path);

  const onClick = () => {
    setSelectedPath(node.path);
    if (node.type === 'directory') {
      void toggleExpand(node.path);
    } else {
      // Open each file in its own permanent tab (switch if already open)
      void openFile(node.path, false);
    }
  };

  const onDoubleClick = () => {
    if (node.type === 'file') {
      void openFile(node.path, false);
    }
  };

  const onDragStart = (e: React.DragEvent) => {
    if (node.type !== 'file') {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/x-terminal-ide-path', node.path);
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div>
      <button
        type="button"
        draggable={node.type === 'file'}
        onDragStart={onDragStart}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        className={cn(
          'flex w-full items-center gap-1 py-0.5 pr-2 text-left text-ide-sm hover:bg-ide-elevated',
          (isActive || isSelected) && 'bg-ide-selection text-ide-text',
          node.type === 'file' && 'cursor-grab active:cursor-grabbing',
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
        title={node.path}
      >
        {node.type === 'directory' ? (
          <>
            {node.isExpanded ? (
              <ChevronDown size={14} className="shrink-0 text-ide-muted" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-ide-muted" />
            )}
            {node.isExpanded ? (
              <FolderOpen size={14} className="shrink-0 text-ide-warning" />
            ) : (
              <Folder size={14} className="shrink-0 text-ide-warning" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <File size={14} className="shrink-0 text-ide-muted" />
          </>
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            gitStatus === 'modified' && 'text-ide-warning',
            (gitStatus === 'added' || gitStatus === 'untracked') && 'text-ide-success',
            (gitStatus === 'deleted' || gitStatus === 'conflict') && 'text-ide-danger',
          )}
        >
          {node.name}
        </span>
        {gitStatus && node.type === 'file' && (
          <span className={cn('ml-auto shrink-0 text-ide-xs font-semibold', gitColor(gitStatus))}>
            {gitLetter(gitStatus)}
          </span>
        )}
      </button>
      {node.type === 'directory' && node.isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InlineNameInput({
  state,
  onSubmit,
  onCancel,
}: {
  state: InlineEditState;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(state.initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <div className="px-2 py-1">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit(value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim()) onSubmit(value);
          else onCancel();
        }}
        className="w-full rounded-sm border border-ide-accent bg-ide-bg px-1.5 py-0.5 text-ide-sm text-ide-text outline-none"
        placeholder={
          state.mode === 'create-folder'
            ? 'Folder name'
            : state.mode === 'create-file'
              ? 'File name'
              : 'New name'
        }
        aria-label="Name"
      />
    </div>
  );
}

export function FileTree() {
  const tree = useWorkspaceStore((s) => s.tree);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const error = useWorkspaceStore((s) => s.error);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const refresh = useWorkspaceStore((s) => s.refresh);
  const createFile = useWorkspaceStore((s) => s.createFile);
  const createFolder = useWorkspaceStore((s) => s.createFolder);
  const renameEntry = useWorkspaceStore((s) => s.renameEntry);
  const deleteEntry = useWorkspaceStore((s) => s.deleteEntry);
  const selectedPath = useWorkspaceStore((s) => s.selectedPath);

  const openFile = useEditorStore((s) => s.openFile);
  const closeTabsForPath = useEditorStore((s) => s.closeTabsForPath);
  const renameTabPath = useEditorStore((s) => s.renameTabPath);
  const openHtmlFile = useBrowserStore((s) => s.openHtmlFile);

  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [inline, setInline] = useState<InlineEditState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [menu]);

  const parentForCreate = () => {
    if (!rootPath) return null;
    if (!selectedPath) return rootPath;
    // If file selected, use its parent; if folder, use it
    const findType = (nodes: TreeNode[], path: string): TreeNode | null => {
      for (const n of nodes) {
        if (n.path === path) return n;
        if (n.children) {
          const f = findType(n.children, path);
          if (f) return f;
        }
      }
      return null;
    };
    const node = findType(tree, selectedPath);
    if (node?.type === 'directory') return selectedPath;
    return dirname(selectedPath);
  };

  const onContextMenu = (e: React.MouseEvent, node: TreeNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleInlineSubmit = async (name: string) => {
    if (!inline) return;
    const mode = inline.mode;
    setInline(null);

    if (mode === 'create-file') {
      const path = await createFile(inline.parentPath, name);
      if (path) void openFile(path, false);
    } else if (mode === 'create-folder') {
      await createFolder(inline.parentPath, name);
    } else if (mode === 'rename' && inline.targetPath) {
      const newPath = await renameEntry(inline.targetPath, name);
      if (newPath) renameTabPath(inline.targetPath, newPath);
    }
  };

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 text-center text-ide-sm text-ide-muted">
        <p>You have not yet opened a folder.</p>
        <button
          type="button"
          onClick={() => void openFolder()}
          className="rounded-sm bg-ide-accent px-3 py-1.5 text-white hover:bg-ide-accent-hover"
        >
          Open Folder
        </button>
      </div>
    );
  }

  if (isLoading && tree.length === 0) {
    return <div className="p-3 text-ide-sm text-ide-muted">Loading…</div>;
  }

  return (
    <div
      className="relative h-full overflow-auto py-1"
      role="tree"
      onContextMenu={(e) => {
        // Empty area → root menu
        if ((e.target as HTMLElement).getAttribute('role') === 'tree') {
          onContextMenu(e, null);
        }
      }}
    >
      {error && (
        <div className="mx-2 mb-1 rounded-sm bg-ide-danger/15 px-2 py-1 text-ide-xs text-ide-danger">
          {error}
        </div>
      )}

      {inline && (
        <InlineNameInput
          state={inline}
          onSubmit={(n) => void handleInlineSubmit(n)}
          onCancel={() => setInline(null)}
        />
      )}

      {tree.map((node) => (
        <FileTreeNode
          key={node.id}
          node={node}
          depth={0}
          onContextMenu={onContextMenu}
        />
      ))}

      {menu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-sm border border-ide-border bg-ide-surface py-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            icon={<FilePlus size={14} />}
            label="New File"
            onClick={() => {
              const parent =
                menu.node?.type === 'directory'
                  ? menu.node.path
                  : menu.node
                    ? dirname(menu.node.path)
                    : rootPath;
              setMenu(null);
              setInline({ mode: 'create-file', parentPath: parent, initial: '' });
            }}
          />
          <MenuItem
            icon={<FolderPlus size={14} />}
            label="New Folder"
            onClick={() => {
              const parent =
                menu.node?.type === 'directory'
                  ? menu.node.path
                  : menu.node
                    ? dirname(menu.node.path)
                    : rootPath;
              setMenu(null);
              setInline({ mode: 'create-folder', parentPath: parent, initial: '' });
            }}
          />
          {menu.node && (
            <>
              <div className="my-1 border-t border-ide-border" />
              {menu.node.type === 'file' && /\.html?$/i.test(menu.node.path) && (
                <MenuItem
                  icon={<Globe size={14} />}
                  label="Open in Browser"
                  onClick={() => {
                    const path = menu.node!.path;
                    setMenu(null);
                    void openHtmlFile(path);
                  }}
                />
              )}
              <MenuItem
                icon={<Pencil size={14} />}
                label="Rename"
                onClick={() => {
                  setMenu(null);
                  setInline({
                    mode: 'rename',
                    parentPath: dirname(menu.node!.path),
                    targetPath: menu.node!.path,
                    initial: menu.node!.name,
                  });
                }}
              />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Delete"
                danger
                onClick={() => {
                  const path = menu.node!.path;
                  setMenu(null);
                  void (async () => {
                    const ok = await deleteEntry(path);
                    if (ok) closeTabsForPath(path);
                  })();
                }}
              />
              <div className="my-1 border-t border-ide-border" />
              <MenuItem
                icon={<ExternalLink size={14} />}
                label="Reveal in File Manager"
                onClick={() => {
                  const path = menu.node!.path;
                  setMenu(null);
                  void requireApi().revealInOs({ path });
                }}
              />
            </>
          )}
          <div className="my-1 border-t border-ide-border" />
          <MenuItem
            icon={<RefreshCw size={14} />}
            label="Refresh"
            onClick={() => {
              setMenu(null);
              void refresh();
            }}
          />
        </div>
      )}

      {/* Toolbar actions via keyboard-friendly create from parent */}
      <span className="sr-only" data-parent={parentForCreate() ?? ''} />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-ide-sm hover:bg-ide-elevated',
        danger ? 'text-ide-danger' : 'text-ide-text',
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
