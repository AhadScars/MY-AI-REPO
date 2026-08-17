/**
 * Strongly typed API surface exposed to the renderer via preload.
 * This is the only bridge between renderer and main process.
 */

import type {
  AppPathRequest,
  CopyRequest,
  CreateDirRequest,
  CreateFileRequest,
  DeleteRequest,
  DialogMessageRequest,
  DialogMessageResult,
  DialogOpenFileRequest,
  DialogOpenFileResult,
  DialogOpenFolderResult,
  DialogSaveFileRequest,
  DialogSaveFileResult,
  ExistsRequest,
  FileEntry,
  FileStat,
  MenuActionEvent,
  ReadDirRequest,
  ReadFileRequest,
  ReadFileResult,
  RenameRequest,
  RevealInOsRequest,
  SettingsGetRequest,
  SettingsSetRequest,
  ShellOpenExternalRequest,
  ShellOpenPathRequest,
  StatRequest,
  WriteFileRequest,
} from './ipc-channels';
import type {
  ShellInfo,
  TerminalCreateRequest,
  TerminalCreateResult,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalKillRequest,
  TerminalListItem,
  TerminalResizeRequest,
  TerminalRestartRequest,
  TerminalWriteRequest,
} from './terminal';
import type {
  GitBranchInfo,
  GitBranchRequest,
  GitCheckoutRequest,
  GitCommitRequest,
  GitDiffRequest,
  GitDiffResult,
  GitLogEntry,
  GitLogRequest,
  GitPathsRequest,
  GitRemoteInfo,
  GitRemoteRequest,
  GitRepoRequest,
  GitSetRemoteRequest,
  GitCloneRequest,
  GitStatusResult,
} from './git';
import type {
  AIAutocompleteRequest,
  AIAutocompleteResult,
  AIChatStartRequest,
  AIChatStartResult,
  AIChatStopRequest,
  AICompleteRequest,
  AICompleteResult,
  AIDeleteCredentialRequest,
  AIHasCredentialRequest,
  AIInlineEditRequest,
  AIInlineEditResult,
  AIListModelsRequest,
  AIPermissionDecisionRequest,
  AISetCredentialRequest,
  AIStreamChunkEvent,
  AIToolDescriptor,
} from './ai';
import type {
  ApplyAllEditsRequest,
  ApplyEditRequest,
  ApplyEditResult,
  FileEditProposal,
  ListPendingEditsResult,
  ProposeEditsRequest,
  ProposeEditsResult,
  RejectEditRequest,
} from './edits';
import type { IndexingProgress, SearchResult } from '../../indexing/src/index';
import type {
  ProjectDepsRequest,
  ProjectToolDetectResult,
  RunDetectResult,
  RunExitEvent,
  RunOutputEvent,
  RunProgramRequest,
  RunProgramResult,
  RunStopRequest,
  RunStopResult,
  RunWriteRequest,
} from './run';
import type {
  SqlConnectMysqlRequest,
  SqlConnectMysqlResult,
  SqlDiscoverProjectResult,
  SqlEnsureProjectDbRequest,
  SqlEnsureProjectDbResult,
  SqlExecuteRequest,
  SqlExecuteResult,
  SqlListTablesResult,
  SqlOpenResult,
  SqlRegisterProjectDbRequest,
  SqlSaveMysqlConfigRequest,
  SqlTableInfo,
  SqlTerminalCommandRequest,
  SqlTerminalCommandResult,
} from './sql';

export interface TerminalIdeApi {
  // App
  getVersion: () => Promise<string>;
  getPath: (request: AppPathRequest) => Promise<string>;
  quit: () => Promise<void>;

  // Window
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  toggleDevTools: () => Promise<void>;
  /** Open another Terminal - IDE window */
  newWindow: () => Promise<void>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;

  // Dialogs
  openFolder: () => Promise<DialogOpenFolderResult>;
  openFile: (request?: DialogOpenFileRequest) => Promise<DialogOpenFileResult>;
  saveFile: (request?: DialogSaveFileRequest) => Promise<DialogSaveFileResult>;
  showMessage: (request: DialogMessageRequest) => Promise<DialogMessageResult>;

  // Filesystem
  readDir: (request: ReadDirRequest) => Promise<FileEntry[]>;
  readFile: (request: ReadFileRequest) => Promise<ReadFileResult>;
  writeFile: (request: WriteFileRequest) => Promise<void>;
  createFile: (request: CreateFileRequest) => Promise<void>;
  createDir: (request: CreateDirRequest) => Promise<void>;
  delete: (request: DeleteRequest) => Promise<void>;
  rename: (request: RenameRequest) => Promise<void>;
  copy: (request: CopyRequest) => Promise<void>;
  exists: (request: ExistsRequest) => Promise<boolean>;
  stat: (request: StatRequest) => Promise<FileStat>;
  revealInOs: (request: RevealInOsRequest) => Promise<void>;

  // Settings
  getSetting: <T = unknown>(request: SettingsGetRequest) => Promise<T | undefined>;
  setSetting: (request: SettingsSetRequest) => Promise<void>;
  /** Atomic multi-key write (single disk flush). */
  setSettingsMany: (request: { values: Record<string, unknown> }) => Promise<void>;
  getAllSettings: () => Promise<Record<string, unknown>>;
  resetSettings: () => Promise<void>;

  // Shell
  openExternal: (request: ShellOpenExternalRequest) => Promise<void>;
  openPath: (request: ShellOpenPathRequest) => Promise<void>;

  // Built-in browser / HTML preview
  previewOpen: (request: {
    filePath: string;
    rootPath?: string;
  }) => Promise<{
    url: string;
    port: number;
    root: string;
    filePath: string;
    title: string;
  }>;
  previewStop: () => Promise<{ ok: boolean }>;
  previewStatus: () => Promise<{
    running: boolean;
    port: number | null;
    root: string | null;
  }>;

  // Terminal (PTY)
  listShells: () => Promise<ShellInfo[]>;
  createTerminal: (request?: TerminalCreateRequest) => Promise<TerminalCreateResult>;
  writeTerminal: (request: TerminalWriteRequest) => Promise<void>;
  resizeTerminal: (request: TerminalResizeRequest) => Promise<void>;
  killTerminal: (request: TerminalKillRequest) => Promise<void>;
  restartTerminal: (request: TerminalRestartRequest) => Promise<TerminalCreateResult>;
  listTerminals: () => Promise<TerminalListItem[]>;
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => () => void;
  onTerminalExit: (callback: (event: TerminalExitEvent) => void) => () => void;

  // Git SCM
  gitStatus: (request: GitRepoRequest) => Promise<GitStatusResult>;
  gitStage: (request: GitPathsRequest) => Promise<void>;
  gitUnstage: (request: GitPathsRequest) => Promise<void>;
  gitDiscard: (request: GitPathsRequest) => Promise<void>;
  gitCommit: (request: GitCommitRequest) => Promise<void>;
  gitBranches: (request: GitRepoRequest) => Promise<GitBranchInfo[]>;
  gitCheckout: (request: GitCheckoutRequest) => Promise<void>;
  gitCreateBranch: (request: GitBranchRequest) => Promise<void>;
  gitDiff: (request: GitDiffRequest) => Promise<GitDiffResult>;
  gitLog: (request: GitLogRequest) => Promise<GitLogEntry[]>;
  gitFetch: (request: GitRemoteRequest) => Promise<string>;
  gitPull: (request: GitRemoteRequest) => Promise<string>;
  gitPush: (request: GitRemoteRequest) => Promise<string>;
  gitInit: (request: GitRepoRequest) => Promise<void>;
  gitListRemotes: (request: GitRepoRequest) => Promise<GitRemoteInfo[]>;
  gitSetRemote: (request: GitSetRemoteRequest) => Promise<void>;
  gitClone: (request: GitCloneRequest) => Promise<{ path: string }>;

  // AI
  aiChatStart: (request: AIChatStartRequest) => Promise<AIChatStartResult>;
  aiChatStop: (request: AIChatStopRequest) => Promise<void>;
  aiComplete: (request: AICompleteRequest) => Promise<AICompleteResult>;
  aiSetCredential: (request: AISetCredentialRequest) => Promise<void>;
  aiHasCredential: (request: AIHasCredentialRequest) => Promise<boolean>;
  aiDeleteCredential: (request: AIDeleteCredentialRequest) => Promise<void>;
  aiListTools: () => Promise<AIToolDescriptor[]>;
  aiSetPermission: (request: AIPermissionDecisionRequest) => Promise<void>;
  aiListModels: (request: AIListModelsRequest) => Promise<string[]>;
  aiTestConnection: (request: {
    providerId: string;
    baseUrl?: string;
  }) => Promise<{ ok: boolean; message: string }>;
  aiInlineEdit: (request: AIInlineEditRequest) => Promise<AIInlineEditResult>;
  aiAutocomplete: (request: AIAutocompleteRequest) => Promise<AIAutocompleteResult>;
  onAiStream: (callback: (event: AIStreamChunkEvent) => void) => () => void;

  // Edit proposals
  editsList: () => Promise<ListPendingEditsResult>;
  editsPropose: (request: ProposeEditsRequest) => Promise<ProposeEditsResult>;
  editsApply: (request: ApplyEditRequest) => Promise<ApplyEditResult>;
  editsApplyAll: (request?: ApplyAllEditsRequest) => Promise<{ applied: number; failed: number }>;
  editsReject: (request: RejectEditRequest) => Promise<void>;
  editsRejectAll: () => Promise<void>;
  editsClear: () => Promise<void>;
  onEditsChanged: (callback: (event: { proposals: FileEditProposal[] }) => void) => () => void;

  // Indexing
  indexStart: (request: { rootPath: string }) => Promise<{ started: boolean }>;
  indexStop: () => Promise<void>;
  indexStatus: () => Promise<{
    root: string | null;
    chunkCount: number;
    running: boolean;
    progress: IndexingProgress | null;
  }>;
  indexSearch: (request: {
    query: string;
    limit?: number;
    rootPath?: string;
    caseSensitive?: boolean;
  }) => Promise<SearchResult[]>;
  indexSearchSemantic: (request: {
    query: string;
    limit?: number;
    rootPath?: string;
    caseSensitive?: boolean;
  }) => Promise<SearchResult[]>;
  onIndexProgress: (callback: (progress: IndexingProgress) => void) => () => void;

  // Run programs
  runDetect: (request: { filePath: string }) => Promise<RunDetectResult>;
  runStart: (request: RunProgramRequest) => Promise<RunProgramResult>;
  runStop: (request?: RunStopRequest) => Promise<RunStopResult | void>;
  runWrite: (request: RunWriteRequest) => Promise<void>;
  runProjectDetect: (request: { rootPath: string }) => Promise<ProjectToolDetectResult>;
  runProjectDeps: (request: ProjectDepsRequest) => Promise<RunProgramResult>;
  onRunOutput: (callback: (event: RunOutputEvent) => void) => () => void;
  onRunExit: (callback: (event: RunExitEvent) => void) => () => void;

  // SQLite / SQL
  sqlOpen: (request?: { path?: string }) => Promise<SqlOpenResult>;
  sqlNewDatabase: (request?: {
    defaultPath?: string;
  }) => Promise<{ canceled: true } | ({ canceled: false } & SqlOpenResult)>;
  sqlClose: () => Promise<{ ok: boolean }>;
  sqlExecute: (request: SqlExecuteRequest) => Promise<SqlExecuteResult>;
  sqlListTables: () => Promise<SqlListTablesResult>;
  sqlTableInfo: (request: { name: string }) => Promise<SqlTableInfo>;
  sqlGetOpen: () => Promise<{
    path: string | null;
    tables: string[];
    type?: 'sqlite' | 'mysql' | null;
    label?: string | null;
    mysql?: { host: string; port: number; user: string; database: string | null } | null;
    databases?: string[];
  }>;
  sqlConnectMysql: (request: SqlConnectMysqlRequest) => Promise<SqlConnectMysqlResult>;
  sqlUseDatabase: (request: {
    database: string;
  }) => Promise<{ tables: string[]; database: string; label: string }>;
  sqlListMysqlDatabases: () => Promise<{ databases: string[] }>;
  sqlSaveMysqlConfig: (request: SqlSaveMysqlConfigRequest) => Promise<{ configPath: string }>;
  sqlDiscoverProject: (request: { rootPath: string }) => Promise<SqlDiscoverProjectResult>;
  sqlEnsureProjectDb: (request: SqlEnsureProjectDbRequest) => Promise<SqlEnsureProjectDbResult>;
  sqlRegisterProjectDb: (
    request: SqlRegisterProjectDbRequest,
  ) => Promise<{ configPath: string }>;
  sqlTerminalCommand: (request: SqlTerminalCommandRequest) => Promise<SqlTerminalCommandResult>;
  sqlOpenConfig: (request: {
    rootPath: string;
    createIfMissing?: boolean;
  }) => Promise<{ configPath: string }>;

  // Menu events
  onMenuAction: (callback: (event: MenuActionEvent) => void) => () => void;

  /** Main process asks renderer to flush session before closing the window. */
  onPrepareQuit: (callback: () => void) => () => void;
  /** Tell main that session flush finished (safe to destroy window). */
  notifySessionFlushed: () => void;

  // Platform
  platform: NodeJS.Platform;
  isElectron: true;

  /**
   * Resolve absolute filesystem path for a File from a drag/drop (Electron webUtils).
   * Returns empty string when path cannot be resolved.
   */
  getPathForFile?: (file: File) => string;
}

export {};
