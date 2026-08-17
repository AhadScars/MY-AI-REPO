/**
 * Git IPC contracts — safe SCM operations via main-process GitService.
 */

export type GitFileStatusCode =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflict'
  | 'ignored'
  | 'typechange';

export interface GitChange {
  /** Absolute path */
  path: string;
  /** Path relative to repo root */
  relativePath: string;
  /** Original path if renamed */
  oldPath?: string;
  status: GitFileStatusCode;
  staged: boolean;
  /** Both index and worktree dirty */
  both?: boolean;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
}

export interface GitStatusResult {
  isRepo: boolean;
  rootPath: string | null;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitChange[];
  unstaged: GitChange[];
  conflicted: GitChange[];
  /** relativePath -> status for explorer decorations */
  statusMap: Record<string, GitFileStatusCode>;
}

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
}

export interface GitDiffResult {
  path: string;
  staged: boolean;
  diff: string;
  isBinary: boolean;
}

export interface GitRepoRequest {
  cwd: string;
}

export interface GitPathsRequest {
  cwd: string;
  paths: string[];
}

export interface GitCommitRequest {
  cwd: string;
  message: string;
  amend?: boolean;
}

export interface GitBranchRequest {
  cwd: string;
  name: string;
  checkout?: boolean;
}

export interface GitCheckoutRequest {
  cwd: string;
  ref: string;
}

export interface GitDiffRequest {
  cwd: string;
  path: string;
  staged?: boolean;
}

export interface GitLogRequest {
  cwd: string;
  limit?: number;
}

export interface GitRemoteRequest {
  cwd: string;
  remote?: string;
}

export interface GitRemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface GitSetRemoteRequest {
  cwd: string;
  /** Remote name, default origin */
  name?: string;
  /** e.g. https://github.com/user/repo.git */
  url: string;
}

export interface GitCloneRequest {
  /** Repository URL */
  url: string;
  /** Parent directory where the repo folder will be created */
  parentDir: string;
  /** Optional folder name (defaults to repo name from URL) */
  directoryName?: string;
}
