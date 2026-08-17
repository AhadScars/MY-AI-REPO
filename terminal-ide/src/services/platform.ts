import type { TerminalIdeApi } from '../../packages/protocol/src/api';

/**
 * Access the preload API. Returns null when running in a plain browser (dev without Electron).
 */
export function getApi(): TerminalIdeApi | null {
  if (typeof window !== 'undefined' && window.terminalIde) {
    return window.terminalIde;
  }
  return null;
}

export function isElectron(): boolean {
  return getApi()?.isElectron === true;
}

/**
 * Browser fallback stubs for UI development without Electron.
 * Real FS/dialogs only work inside Electron.
 */
export const browserStubApi: Partial<TerminalIdeApi> = {
  isElectron: true,
  platform: 'linux',
  getVersion: async () => '0.1.0-browser',
  getPath: async () => '/',
  quit: async () => undefined,
  minimize: async () => undefined,
  maximize: async () => undefined,
  close: async () => undefined,
  isMaximized: async () => false,
  toggleDevTools: async () => undefined,
  newWindow: async () => undefined,
  onMaximizedChange: () => () => undefined,
  openFolder: async () => ({ canceled: true }),
  openFile: async () => ({ canceled: true, paths: [] }),
  saveFile: async () => ({ canceled: true }),
  showMessage: async () => ({ response: 0 }),
  readDir: async () => [],
  readFile: async () => ({ content: '', encoding: 'utf-8', size: 0 }),
  writeFile: async () => undefined,
  createFile: async () => undefined,
  createDir: async () => undefined,
  delete: async () => undefined,
  rename: async () => undefined,
  copy: async () => undefined,
  exists: async () => false,
  stat: async () => ({
    path: '',
    isDirectory: false,
    isFile: true,
    isSymbolicLink: false,
    size: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
  }),
  revealInOs: async () => undefined,
  getSetting: async () => undefined,
  setSetting: async () => undefined,
  setSettingsMany: async () => undefined,
  getAllSettings: async () => ({}),
  resetSettings: async () => undefined,
  onPrepareQuit: () => () => undefined,
  notifySessionFlushed: () => undefined,
  openExternal: async () => undefined,
  openPath: async () => undefined,
  previewOpen: async () => {
    throw new Error('Preview requires Electron');
  },
  previewStop: async () => ({ ok: true }),
  previewStatus: async () => ({ running: false, port: null, root: null }),
  listShells: async () => [{ id: 'auto', name: 'Auto', available: true }],
  createTerminal: async () => {
    throw new Error('Terminal requires Electron + node-pty');
  },
  writeTerminal: async () => undefined,
  resizeTerminal: async () => undefined,
  killTerminal: async () => undefined,
  restartTerminal: async () => {
    throw new Error('Terminal requires Electron + node-pty');
  },
  listTerminals: async () => [],
  onTerminalData: () => () => undefined,
  onTerminalExit: () => () => undefined,
  gitStatus: async () => ({
    isRepo: false,
    rootPath: null,
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    conflicted: [],
    statusMap: {},
  }),
  gitStage: async () => undefined,
  gitUnstage: async () => undefined,
  gitDiscard: async () => undefined,
  gitCommit: async () => undefined,
  gitBranches: async () => [],
  gitCheckout: async () => undefined,
  gitCreateBranch: async () => undefined,
  gitDiff: async () => ({ path: '', staged: false, diff: '', isBinary: false }),
  gitLog: async () => [],
  gitFetch: async () => 'ok',
  gitPull: async () => 'ok',
  gitPush: async () => 'ok',
  gitInit: async () => undefined,
  gitListRemotes: async () => [],
  gitSetRemote: async () => undefined,
  gitClone: async () => {
    throw new Error('Clone requires Electron');
  },
  aiChatStart: async () => ({ streamId: 'stub' }),
  aiChatStop: async () => undefined,
  aiComplete: async () => ({ text: 'AI requires Electron.' }),
  aiSetCredential: async () => undefined,
  aiHasCredential: async () => false,
  aiDeleteCredential: async () => undefined,
  aiListTools: async () => [],
  aiSetPermission: async () => undefined,
  aiListModels: async () => [],
  aiTestConnection: async () => ({ ok: false, message: 'Not in Electron' }),
  aiInlineEdit: async () => ({ code: '' }),
  aiAutocomplete: async () => ({ suggestion: '' }),
  onAiStream: () => () => undefined,
  editsList: async () => ({ proposals: [] }),
  editsPropose: async () => ({ proposals: [] }),
  editsApply: async () => ({ ok: false, error: 'Not in Electron' }),
  editsApplyAll: async () => ({ applied: 0, failed: 0 }),
  editsReject: async () => undefined,
  editsRejectAll: async () => undefined,
  editsClear: async () => undefined,
  onEditsChanged: () => () => undefined,
  indexStart: async () => ({ started: false }),
  indexStop: async () => undefined,
  indexStatus: async () => ({
    root: null,
    chunkCount: 0,
    running: false,
    progress: null,
  }),
  indexSearch: async () => [],
  indexSearchSemantic: async () => [],
  onIndexProgress: () => () => undefined,
  runDetect: async () => ({
    language: 'unknown',
    label: 'Run',
    available: false,
    reason: 'Not in Electron',
  }),
  runStart: async () => {
    throw new Error('Run requires Electron');
  },
  runStop: async () => ({ killed: false, freedPorts: [], message: 'Not in Electron' }),
  runWrite: async () => undefined,
  runProjectDetect: async () => ({
    found: false,
    tool: null,
    root: null,
    buildFile: null,
    isSpringBoot: false,
    dependenciesMissing: true,
    wrapper: null,
    runnerAvailable: false,
    label: 'No project',
    reason: 'Not in Electron',
  }),
  runProjectDeps: async () => {
    throw new Error('Maven requires Electron');
  },
  onRunOutput: () => () => undefined,
  onRunExit: () => () => undefined,
  sqlOpen: async () => {
    throw new Error('SQL requires Electron');
  },
  sqlNewDatabase: async () => ({ canceled: true as const }),
  sqlClose: async () => ({ ok: true }),
  sqlExecute: async () => ({
    results: [],
    statementCount: 0,
    durationMs: 0,
    error: 'SQL requires Electron',
  }),
  sqlListTables: async () => ({ tables: [] }),
  sqlTableInfo: async () => ({ name: '', columns: [] }),
  sqlGetOpen: async () => ({ path: null, tables: [], type: null, label: null, mysql: null, databases: [] }),
  sqlConnectMysql: async () => {
    throw new Error('SQL requires Electron');
  },
  sqlUseDatabase: async () => ({ tables: [], database: '', label: '' }),
  sqlListMysqlDatabases: async () => ({ databases: [] }),
  sqlSaveMysqlConfig: async () => ({ configPath: '' }),
  sqlDiscoverProject: async () => ({
    rootPath: '',
    configPath: '',
    hasConfig: false,
    needsSetup: true,
    databases: [],
    sqlite3Available: false,
    sqlite3Path: null,
  }),
  sqlEnsureProjectDb: async () => ({
    configPath: '',
    absolutePath: '',
    tables: [],
    createdFile: false,
  }),
  sqlRegisterProjectDb: async () => ({ configPath: '' }),
  sqlTerminalCommand: async () => ({
    command: '',
    label: 'info',
    sqlite3Available: false,
    mysqlCliAvailable: false,
    dbPath: '',
  }),
  sqlOpenConfig: async () => ({ configPath: '' }),
  onMenuAction: () => () => undefined,
};

export function requireApi(): TerminalIdeApi {
  const api = getApi();
  if (api) return api;
  // Dev fallback so React shell can render outside Electron
  return browserStubApi as TerminalIdeApi;
}
