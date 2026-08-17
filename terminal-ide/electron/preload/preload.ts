/**
 * Secure preload bridge.
 * Exposes only the typed TerminalIdeApi — never raw Node or Electron APIs.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IpcChannels } from '../../packages/protocol/src/ipc-channels.js';
import type { TerminalIdeApi } from '../../packages/protocol/src/api.js';
import type {
  MenuActionEvent,
} from '../../packages/protocol/src/ipc-channels.js';
import type {
  TerminalDataEvent,
  TerminalExitEvent,
} from '../../packages/protocol/src/terminal.js';
import type { AIStreamChunkEvent } from '../../packages/protocol/src/ai.js';
import type { FileEditProposal } from '../../packages/protocol/src/edits.js';
import type { IndexingProgress } from '../../packages/indexing/src/index.js';
import type { RunExitEvent, RunOutputEvent } from '../../packages/protocol/src/run.js';

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

const api: TerminalIdeApi = {
  // App
  getVersion: () => invoke(IpcChannels.APP_GET_VERSION),
  getPath: (request) => invoke(IpcChannels.APP_GET_PATH, request),
  quit: () => invoke(IpcChannels.APP_QUIT),

  // Window
  minimize: () => invoke(IpcChannels.WINDOW_MINIMIZE),
  maximize: () => invoke(IpcChannels.WINDOW_MAXIMIZE),
  close: () => invoke(IpcChannels.WINDOW_CLOSE),
  isMaximized: () => invoke(IpcChannels.WINDOW_IS_MAXIMIZED),
  toggleDevTools: () => invoke(IpcChannels.WINDOW_TOGGLE_DEVTOOLS),
  newWindow: () => invoke(IpcChannels.WINDOW_NEW),
  onMaximizedChange: (callback) => {
    const onMax = () => callback(true);
    const onUnmax = () => callback(false);
    ipcRenderer.on(IpcChannels.EVENT_WINDOW_MAXIMIZED, onMax);
    ipcRenderer.on(IpcChannels.EVENT_WINDOW_UNMAXIMIZED, onUnmax);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_WINDOW_MAXIMIZED, onMax);
      ipcRenderer.removeListener(IpcChannels.EVENT_WINDOW_UNMAXIMIZED, onUnmax);
    };
  },

  // Dialogs
  openFolder: () => invoke(IpcChannels.DIALOG_OPEN_FOLDER),
  openFile: (request) => invoke(IpcChannels.DIALOG_OPEN_FILE, request),
  saveFile: (request) => invoke(IpcChannels.DIALOG_SAVE_FILE, request),
  showMessage: (request) => invoke(IpcChannels.DIALOG_SHOW_MESSAGE, request),

  // Filesystem
  readDir: (request) => invoke(IpcChannels.FS_READ_DIR, request),
  readFile: (request) => invoke(IpcChannels.FS_READ_FILE, request),
  writeFile: (request) => invoke(IpcChannels.FS_WRITE_FILE, request),
  createFile: (request) => invoke(IpcChannels.FS_CREATE_FILE, request),
  createDir: (request) => invoke(IpcChannels.FS_CREATE_DIR, request),
  delete: (request) => invoke(IpcChannels.FS_DELETE, request),
  rename: (request) => invoke(IpcChannels.FS_RENAME, request),
  copy: (request) => invoke(IpcChannels.FS_COPY, request),
  exists: (request) => invoke(IpcChannels.FS_EXISTS, request),
  stat: (request) => invoke(IpcChannels.FS_STAT, request),
  revealInOs: (request) => invoke(IpcChannels.FS_REVEAL_IN_OS, request),

  // Settings
  getSetting: (request) => invoke(IpcChannels.SETTINGS_GET, request),
  setSetting: (request) => invoke(IpcChannels.SETTINGS_SET, request),
  setSettingsMany: (request) => invoke(IpcChannels.SETTINGS_SET_MANY, request),
  getAllSettings: () => invoke(IpcChannels.SETTINGS_GET_ALL),
  resetSettings: () => invoke(IpcChannels.SETTINGS_RESET),

  // Shell
  openExternal: (request) => invoke(IpcChannels.SHELL_OPEN_EXTERNAL, request),
  openPath: (request) => invoke(IpcChannels.SHELL_OPEN_PATH, request),

  // Built-in browser / HTML preview
  previewOpen: (request) => invoke(IpcChannels.PREVIEW_OPEN, request),
  previewStop: () => invoke(IpcChannels.PREVIEW_STOP),
  previewStatus: () => invoke(IpcChannels.PREVIEW_STATUS),

  // Terminal
  listShells: () => invoke(IpcChannels.TERMINAL_LIST_SHELLS),
  createTerminal: (request) => invoke(IpcChannels.TERMINAL_CREATE, request),
  writeTerminal: (request) => invoke(IpcChannels.TERMINAL_WRITE, request),
  resizeTerminal: (request) => invoke(IpcChannels.TERMINAL_RESIZE, request),
  killTerminal: (request) => invoke(IpcChannels.TERMINAL_KILL, request),
  restartTerminal: (request) => invoke(IpcChannels.TERMINAL_RESTART, request),
  listTerminals: () => invoke(IpcChannels.TERMINAL_LIST),
  onTerminalData: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: TerminalDataEvent) => {
      callback(data);
    };
    ipcRenderer.on(IpcChannels.EVENT_TERMINAL_DATA, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_TERMINAL_DATA, handler);
    };
  },
  onTerminalExit: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: TerminalExitEvent) => {
      callback(data);
    };
    ipcRenderer.on(IpcChannels.EVENT_TERMINAL_EXIT, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_TERMINAL_EXIT, handler);
    };
  },

  // Git
  gitStatus: (request) => invoke(IpcChannels.GIT_STATUS, request),
  gitStage: (request) => invoke(IpcChannels.GIT_STAGE, request),
  gitUnstage: (request) => invoke(IpcChannels.GIT_UNSTAGE, request),
  gitDiscard: (request) => invoke(IpcChannels.GIT_DISCARD, request),
  gitCommit: (request) => invoke(IpcChannels.GIT_COMMIT, request),
  gitBranches: (request) => invoke(IpcChannels.GIT_BRANCHES, request),
  gitCheckout: (request) => invoke(IpcChannels.GIT_CHECKOUT, request),
  gitCreateBranch: (request) => invoke(IpcChannels.GIT_CREATE_BRANCH, request),
  gitDiff: (request) => invoke(IpcChannels.GIT_DIFF, request),
  gitLog: (request) => invoke(IpcChannels.GIT_LOG, request),
  gitFetch: (request) => invoke(IpcChannels.GIT_FETCH, request),
  gitPull: (request) => invoke(IpcChannels.GIT_PULL, request),
  gitPush: (request) => invoke(IpcChannels.GIT_PUSH, request),
  gitInit: (request) => invoke(IpcChannels.GIT_INIT, request),
  gitListRemotes: (request) => invoke(IpcChannels.GIT_LIST_REMOTES, request),
  gitSetRemote: (request) => invoke(IpcChannels.GIT_SET_REMOTE, request),
  gitClone: (request) => invoke(IpcChannels.GIT_CLONE, request),

  // AI
  aiChatStart: (request) => invoke(IpcChannels.AI_CHAT_START, request),
  aiChatStop: (request) => invoke(IpcChannels.AI_CHAT_STOP, request),
  aiComplete: (request) => invoke(IpcChannels.AI_COMPLETE, request),
  aiSetCredential: (request) => invoke(IpcChannels.AI_SET_CREDENTIAL, request),
  aiHasCredential: (request) => invoke(IpcChannels.AI_HAS_CREDENTIAL, request),
  aiDeleteCredential: (request) => invoke(IpcChannels.AI_DELETE_CREDENTIAL, request),
  aiListTools: () => invoke(IpcChannels.AI_LIST_TOOLS),
  aiSetPermission: (request) => invoke(IpcChannels.AI_SET_PERMISSION, request),
  aiListModels: (request) => invoke(IpcChannels.AI_LIST_MODELS, request),
  aiTestConnection: (request) => invoke(IpcChannels.AI_TEST_CONNECTION, request),
  aiInlineEdit: (request) => invoke(IpcChannels.AI_INLINE_EDIT, request),
  aiAutocomplete: (request) => invoke(IpcChannels.AI_AUTOCOMPLETE, request),
  onAiStream: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: AIStreamChunkEvent) => {
      callback(data);
    };
    ipcRenderer.on(IpcChannels.EVENT_AI_STREAM, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_AI_STREAM, handler);
    };
  },

  // Edits
  editsList: () => invoke(IpcChannels.EDITS_LIST),
  editsPropose: (request) => invoke(IpcChannels.EDITS_PROPOSE, request),
  editsApply: (request) => invoke(IpcChannels.EDITS_APPLY, request),
  editsApplyAll: (request) => invoke(IpcChannels.EDITS_APPLY_ALL, request),
  editsReject: (request) => invoke(IpcChannels.EDITS_REJECT, request),
  editsRejectAll: () => invoke(IpcChannels.EDITS_REJECT_ALL),
  editsClear: () => invoke(IpcChannels.EDITS_CLEAR),
  onEditsChanged: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { proposals: FileEditProposal[] },
    ) => {
      callback(data);
    };
    ipcRenderer.on(IpcChannels.EVENT_EDITS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_EDITS_CHANGED, handler);
    };
  },

  // Index
  indexStart: (request) => invoke(IpcChannels.INDEX_START, request),
  indexStop: () => invoke(IpcChannels.INDEX_STOP),
  indexStatus: () => invoke(IpcChannels.INDEX_STATUS),
  indexSearch: (request) => invoke(IpcChannels.INDEX_SEARCH, request),
  indexSearchSemantic: (request) => invoke(IpcChannels.INDEX_SEARCH_SEMANTIC, request),
  onIndexProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: IndexingProgress) => {
      callback(data);
    };
    ipcRenderer.on(IpcChannels.EVENT_INDEX_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_INDEX_PROGRESS, handler);
    };
  },

  // Run
  runDetect: (request) => invoke(IpcChannels.RUN_DETECT, request),
  runStart: (request) => invoke(IpcChannels.RUN_START, request),
  runStop: (request) => invoke(IpcChannels.RUN_STOP, request),
  runWrite: (request) => invoke(IpcChannels.RUN_WRITE, request),
  runProjectDetect: (request) => invoke(IpcChannels.RUN_PROJECT_DETECT, request),
  runProjectDeps: (request) => invoke(IpcChannels.RUN_PROJECT_DEPS, request),
  onRunOutput: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RunOutputEvent) => {
      callback(data);
    };
    ipcRenderer.on(IpcChannels.EVENT_RUN_OUTPUT, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_RUN_OUTPUT, handler);
    };
  },
  onRunExit: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RunExitEvent) => {
      callback(data);
    };
    ipcRenderer.on(IpcChannels.EVENT_RUN_EXIT, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_RUN_EXIT, handler);
    };
  },

  // SQLite / SQL
  sqlOpen: (request) => invoke(IpcChannels.SQL_OPEN, request ?? {}),
  sqlNewDatabase: (request) => invoke(IpcChannels.SQL_NEW_DATABASE, request),
  sqlClose: () => invoke(IpcChannels.SQL_CLOSE),
  sqlExecute: (request) => invoke(IpcChannels.SQL_EXECUTE, request),
  sqlListTables: () => invoke(IpcChannels.SQL_LIST_TABLES),
  sqlTableInfo: (request) => invoke(IpcChannels.SQL_TABLE_INFO, request),
  sqlGetOpen: () => invoke(IpcChannels.SQL_GET_OPEN),
  sqlConnectMysql: (request) => invoke(IpcChannels.SQL_CONNECT_MYSQL, request),
  sqlUseDatabase: (request) => invoke(IpcChannels.SQL_USE_DATABASE, request),
  sqlListMysqlDatabases: () => invoke(IpcChannels.SQL_LIST_MYSQL_DATABASES),
  sqlSaveMysqlConfig: (request) => invoke(IpcChannels.SQL_SAVE_MYSQL_CONFIG, request),
  sqlDiscoverProject: (request) => invoke(IpcChannels.SQL_DISCOVER_PROJECT, request),
  sqlEnsureProjectDb: (request) => invoke(IpcChannels.SQL_ENSURE_PROJECT_DB, request),
  sqlRegisterProjectDb: (request) => invoke(IpcChannels.SQL_REGISTER_PROJECT_DB, request),
  sqlTerminalCommand: (request) => invoke(IpcChannels.SQL_TERMINAL_COMMAND, request),
  sqlOpenConfig: (request) => invoke(IpcChannels.SQL_OPEN_CONFIG, request),

  // Menu
  onMenuAction: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: MenuActionEvent) => {
      callback(data);
    };
    ipcRenderer.on(IpcChannels.EVENT_MENU_ACTION, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_MENU_ACTION, handler);
    };
  },

  onPrepareQuit: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IpcChannels.EVENT_PREPARE_QUIT, handler);
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENT_PREPARE_QUIT, handler);
    };
  },
  notifySessionFlushed: () => {
    ipcRenderer.send(IpcChannels.APP_SESSION_FLUSHED);
  },

  platform: process.platform,
  isElectron: true,

  /** Absolute path for an OS-dropped File (Electron File.path replacement). */
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch {
      return '';
    }
  },
};

contextBridge.exposeInMainWorld('terminalIde', api);
