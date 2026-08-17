/**
 * Typed IPC channel definitions for Terminal - IDE.
 * Main and renderer must only communicate through these contracts.
 */

// ─── Channel name constants ─────────────────────────────────────────────────

export const IpcChannels = {
  // App lifecycle
  APP_GET_VERSION: 'app:get-version',
  APP_GET_PATH: 'app:get-path',
  APP_QUIT: 'app:quit',

  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_TOGGLE_DEVTOOLS: 'window:toggle-devtools',
  WINDOW_NEW: 'window:new',

  // Dialogs
  DIALOG_OPEN_FOLDER: 'dialog:open-folder',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  DIALOG_SHOW_MESSAGE: 'dialog:show-message',

  // Filesystem
  FS_READ_DIR: 'fs:read-dir',
  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_CREATE_FILE: 'fs:create-file',
  FS_CREATE_DIR: 'fs:create-dir',
  FS_DELETE: 'fs:delete',
  FS_RENAME: 'fs:rename',
  FS_COPY: 'fs:copy',
  FS_EXISTS: 'fs:exists',
  FS_STAT: 'fs:stat',
  FS_REVEAL_IN_OS: 'fs:reveal-in-os',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SET_MANY: 'settings:set-many',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_RESET: 'settings:reset',

  // Shell / OS
  SHELL_OPEN_EXTERNAL: 'shell:open-external',
  SHELL_OPEN_PATH: 'shell:open-path',

  // Built-in browser / HTML preview
  PREVIEW_OPEN: 'preview:open',
  PREVIEW_STOP: 'preview:stop',
  PREVIEW_STATUS: 'preview:status',

  // Terminal (PTY)
  TERMINAL_LIST_SHELLS: 'terminal:list-shells',
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_RESTART: 'terminal:restart',
  TERMINAL_LIST: 'terminal:list',

  // Git SCM
  GIT_STATUS: 'git:status',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_DISCARD: 'git:discard',
  GIT_COMMIT: 'git:commit',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_CREATE_BRANCH: 'git:create-branch',
  GIT_DIFF: 'git:diff',
  GIT_LOG: 'git:log',
  GIT_FETCH: 'git:fetch',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push',
  GIT_INIT: 'git:init',
  GIT_LIST_REMOTES: 'git:list-remotes',
  GIT_SET_REMOTE: 'git:set-remote',
  GIT_CLONE: 'git:clone',

  // AI
  AI_CHAT_START: 'ai:chat-start',
  AI_CHAT_STOP: 'ai:chat-stop',
  AI_COMPLETE: 'ai:complete',
  AI_SET_CREDENTIAL: 'ai:set-credential',
  AI_HAS_CREDENTIAL: 'ai:has-credential',
  AI_DELETE_CREDENTIAL: 'ai:delete-credential',
  AI_LIST_TOOLS: 'ai:list-tools',
  AI_SET_PERMISSION: 'ai:set-permission',
  AI_LIST_MODELS: 'ai:list-models',
  AI_TEST_CONNECTION: 'ai:test-connection',
  AI_INLINE_EDIT: 'ai:inline-edit',
  AI_AUTOCOMPLETE: 'ai:autocomplete',

  // Edit proposals (multi-file review)
  EDITS_LIST: 'edits:list',
  EDITS_PROPOSE: 'edits:propose',
  EDITS_APPLY: 'edits:apply',
  EDITS_APPLY_ALL: 'edits:apply-all',
  EDITS_REJECT: 'edits:reject',
  EDITS_REJECT_ALL: 'edits:reject-all',
  EDITS_CLEAR: 'edits:clear',

  // Indexing / search
  INDEX_START: 'index:start',
  INDEX_STOP: 'index:stop',
  INDEX_STATUS: 'index:status',
  INDEX_SEARCH: 'index:search',
  INDEX_SEARCH_SEMANTIC: 'index:search-semantic',

  // Run / execute programs
  RUN_DETECT: 'run:detect',
  RUN_START: 'run:start',
  RUN_STOP: 'run:stop',
  RUN_WRITE: 'run:write',
  /** Detect Maven/Gradle project under a folder */
  RUN_PROJECT_DETECT: 'run:project-detect',
  /** Install / reinstall / compile dependencies (user-triggered, IntelliJ-style) */
  RUN_PROJECT_DEPS: 'run:project-deps',

  // SQLite / SQL
  SQL_OPEN: 'sql:open',
  SQL_CLOSE: 'sql:close',
  SQL_EXECUTE: 'sql:execute',
  SQL_LIST_TABLES: 'sql:list-tables',
  SQL_TABLE_INFO: 'sql:table-info',
  SQL_GET_OPEN: 'sql:get-open',
  SQL_NEW_DATABASE: 'sql:new-database',
  SQL_DISCOVER_PROJECT: 'sql:discover-project',
  SQL_ENSURE_PROJECT_DB: 'sql:ensure-project-db',
  SQL_REGISTER_PROJECT_DB: 'sql:register-project-db',
  SQL_TERMINAL_COMMAND: 'sql:terminal-command',
  SQL_OPEN_CONFIG: 'sql:open-config',
  SQL_CONNECT_MYSQL: 'sql:connect-mysql',
  SQL_USE_DATABASE: 'sql:use-database',
  SQL_LIST_MYSQL_DATABASES: 'sql:list-mysql-databases',
  SQL_SAVE_MYSQL_CONFIG: 'sql:save-mysql-config',

  // Events (main → renderer)
  EVENT_WINDOW_MAXIMIZED: 'event:window-maximized',
  EVENT_WINDOW_UNMAXIMIZED: 'event:window-unmaximized',
  EVENT_MENU_ACTION: 'event:menu-action',
  EVENT_TERMINAL_DATA: 'event:terminal-data',
  EVENT_TERMINAL_EXIT: 'event:terminal-exit',
  EVENT_AI_STREAM: 'event:ai-stream',
  EVENT_AI_PERMISSION_REQUEST: 'event:ai-permission-request',
  EVENT_EDITS_CHANGED: 'event:edits-changed',
  EVENT_INDEX_PROGRESS: 'event:index-progress',
  EVENT_RUN_OUTPUT: 'event:run-output',
  EVENT_RUN_EXIT: 'event:run-exit',
  /** Main asks renderer to flush session before window closes */
  EVENT_PREPARE_QUIT: 'event:prepare-quit',
  /** Renderer → main: session flush finished, safe to close */
  APP_SESSION_FLUSHED: 'app:session-flushed',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

// ─── Request / Response types ───────────────────────────────────────────────

export interface AppPathRequest {
  name: 'home' | 'appData' | 'userData' | 'temp' | 'documents' | 'downloads';
}

export interface DialogOpenFolderResult {
  canceled: boolean;
  path?: string;
}

export interface DialogOpenFileRequest {
  filters?: Array<{ name: string; extensions: string[] }>;
  multiSelections?: boolean;
}

export interface DialogOpenFileResult {
  canceled: boolean;
  paths: string[];
}

export interface DialogSaveFileRequest {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface DialogSaveFileResult {
  canceled: boolean;
  path?: string;
}

export interface DialogMessageRequest {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
}

export interface DialogMessageResult {
  response: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
  size?: number;
  mtimeMs?: number;
  extension?: string;
}

export interface ReadDirRequest {
  path: string;
  includeHidden?: boolean;
}

export interface ReadFileRequest {
  path: string;
  encoding?: BufferEncoding;
}

export interface ReadFileResult {
  content: string;
  encoding: string;
  size: number;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  encoding?: BufferEncoding;
}

export interface CreateFileRequest {
  path: string;
  content?: string;
}

export interface CreateDirRequest {
  path: string;
  recursive?: boolean;
}

export interface DeleteRequest {
  path: string;
  recursive?: boolean;
}

export interface RenameRequest {
  oldPath: string;
  newPath: string;
}

export interface CopyRequest {
  source: string;
  destination: string;
}

export interface ExistsRequest {
  path: string;
}

export interface StatRequest {
  path: string;
}

export interface FileStat {
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
}

export interface RevealInOsRequest {
  path: string;
}

export interface SettingsGetRequest {
  key: string;
}

export interface SettingsSetRequest {
  key: string;
  value: unknown;
}

export interface ShellOpenExternalRequest {
  url: string;
}

export interface ShellOpenPathRequest {
  path: string;
}

export type MenuAction =
  | 'file.openFolder'
  | 'file.openFile'
  | 'file.closeFolder'
  | 'file.save'
  | 'file.saveAll'
  | 'file.newFile'
  | 'edit.find'
  | 'edit.replace'
  | 'edit.findInFiles'
  | 'view.commandPalette'
  | 'view.toggleSidebar'
  | 'view.toggleTerminal'
  | 'view.toggleAiChat'
  | 'terminal.new'
  | 'run.program'
  | 'run.rerun'
  | 'run.stop'
  | 'help.about'
  | 'help.welcome'
  | 'help.showCommands'
  | 'help.developer';

export interface MenuActionEvent {
  action: MenuAction;
}
