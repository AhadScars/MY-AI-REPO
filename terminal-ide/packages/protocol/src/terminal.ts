/**
 * Terminal IPC contracts — PTY sessions between main and renderer.
 */

export type ShellId = 'auto' | 'powershell' | 'cmd' | 'git-bash' | 'wsl' | 'bash' | 'zsh';

export interface ShellInfo {
  id: ShellId;
  name: string;
  available: boolean;
  path?: string;
}

export interface TerminalCreateRequest {
  cwd?: string;
  shell?: ShellId;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export interface TerminalCreateResult {
  id: string;
  shell: ShellId;
  shellPath: string;
  cwd: string;
  cols: number;
  rows: number;
  pid: number;
}

export interface TerminalWriteRequest {
  id: string;
  data: string;
}

export interface TerminalResizeRequest {
  id: string;
  cols: number;
  rows: number;
}

export interface TerminalKillRequest {
  id: string;
}

export interface TerminalRestartRequest {
  id: string;
  cwd?: string;
  shell?: ShellId;
  cols?: number;
  rows?: number;
}

export interface TerminalDataEvent {
  id: string;
  data: string;
}

export interface TerminalExitEvent {
  id: string;
  exitCode: number;
  signal?: number;
}

export interface TerminalListItem {
  id: string;
  shell: ShellId;
  cwd: string;
  pid: number;
  title?: string;
}
