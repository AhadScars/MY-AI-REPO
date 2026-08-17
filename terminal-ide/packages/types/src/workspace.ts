export interface WorkspaceFolder {
  name: string;
  path: string;
}

export interface WorkspaceState {
  rootPath: string | null;
  name: string | null;
  folders: WorkspaceFolder[];
  recentPaths: string[];
  isLoading: boolean;
  error: string | null;
}

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  extension?: string;
  gitStatus?: GitFileStatus;
}

export type GitFileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'conflict'
  | 'ignored';
