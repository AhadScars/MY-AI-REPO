/**
 * Program run/execute IPC contracts.
 */

export interface RunProgramRequest {
  /** Absolute path to the source file */
  filePath: string;
  /** Working directory (defaults to file's directory) */
  cwd?: string;
  /** Optional extra args for the program */
  args?: string[];
}

export interface RunProgramResult {
  runId: string;
  command: string;
  cwd: string;
}

export interface RunStopRequest {
  runId?: string;
}

/** Result of stopping a run — includes ports freed (Spring Boot, etc.). */
export interface RunStopResult {
  killed: boolean;
  freedPorts: number[];
  message: string;
}

/** Write text to the running program's stdin (interactive input). */
export interface RunWriteRequest {
  runId?: string;
  /** Text to send; typically includes a trailing newline for Scanner/readline. */
  data: string;
}

export interface RunOutputEvent {
  runId: string;
  stream: 'stdout' | 'stderr' | 'system' | 'stdin';
  data: string;
}

export interface RunExitEvent {
  runId: string;
  code: number | null;
  signal?: string | null;
  durationMs: number;
}

export interface RunDetectResult {
  language: string;
  label: string;
  available: boolean;
  /** Human message if not available */
  reason?: string;
}

/** Maven / Gradle project detection for the sidebar tool. */
export interface ProjectToolDetectResult {
  found: boolean;
  tool: 'maven' | 'gradle' | null;
  root: string | null;
  buildFile: string | null;
  isSpringBoot: boolean;
  /** true when target/build output is missing */
  dependenciesMissing: boolean;
  wrapper: string | null;
  runnerAvailable: boolean;
  label: string;
  reason?: string;
}

export type ProjectDepsAction = 'install' | 'reinstall' | 'compile';

export interface ProjectDepsRequest {
  /** Workspace or project root (or any path inside the project) */
  rootPath: string;
  action: ProjectDepsAction;
}
