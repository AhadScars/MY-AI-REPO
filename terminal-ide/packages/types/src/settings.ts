export type ThemeMode = 'dark' | 'light' | 'system';

export interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  autoSave: 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange';
  autoSaveDelay: number;
  formatOnSave: boolean;
  rulers: number[];
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  renderWhitespace: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
}

export interface TerminalSettings {
  defaultShell: 'powershell' | 'cmd' | 'git-bash' | 'wsl' | 'auto';
  fontFamily: string;
  fontSize: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  scrollback: number;
}

export interface AISettings {
  provider: string;
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  enableAutocomplete: boolean;
  autocompleteDebounceMs: number;
  /** Agent uses tools and can edit multiple files */
  agentMode: boolean;
  /** In agent mode, apply file edits immediately (skip review panel) */
  autoApplyEdits: boolean;
  streamResponses: boolean;
}

export interface GitSettings {
  autoFetch: boolean;
  autoFetchIntervalMinutes: number;
  gitPath: string;
  confirmSync: boolean;
}

export interface PrivacySettings {
  telemetry: boolean;
  indexingEnabled: boolean;
  shareCodeWithAI: boolean;
  localModelsPreferred: boolean;
}

export interface GeneralSettings {
  theme: ThemeMode;
  language: string;
  openLastWorkspace: boolean;
  confirmBeforeClose: boolean;
  showWelcomeOnStartup: boolean;
}

export interface LayoutSettings {
  sidebarVisible: boolean;
  sidebarWidth: number;
  aiPanelVisible: boolean;
  aiPanelWidth: number;
  bottomPanelVisible: boolean;
  bottomPanelHeight: number;
  bottomPanelTab: 'terminal' | 'problems' | 'output' | 'debug';
  activityBarVisible: boolean;
  statusBarVisible: boolean;
  zenMode: boolean;
}

/** Last project folder + recent list (welcome page) + explorer tree UI. */
export interface WorkspaceSettings {
  lastPath: string | null;
  recentPaths: string[];
  /** Expanded folder paths in the file tree (for lastPath). */
  expandedPaths: string[];
  /** Selected file/folder in the explorer tree. */
  selectedPath: string | null;
}

/** Open editor tabs restored on next launch. */
export interface EditorSessionSettings {
  openPaths: string[];
  activePath: string | null;
}

export interface AppSettings {
  general: GeneralSettings;
  editor: EditorSettings;
  terminal: TerminalSettings;
  ai: AISettings;
  git: GitSettings;
  privacy: PrivacySettings;
  layout: LayoutSettings;
  workspace: WorkspaceSettings;
  /** Persisted open tabs / active file */
  session: EditorSessionSettings;
  shortcuts: Record<string, string>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    theme: 'dark',
    language: 'en',
    openLastWorkspace: true,
    confirmBeforeClose: true,
    showWelcomeOnStartup: true,
  },
  editor: {
    fontFamily: "Cascadia Code, 'JetBrains Mono', Consolas, monospace",
    fontSize: 14,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'off',
    minimap: true,
    lineNumbers: 'on',
    autoSave: 'off',
    autoSaveDelay: 1000,
    formatOnSave: false,
    rulers: [],
    cursorBlinking: 'blink',
    renderWhitespace: 'selection',
  },
  terminal: {
    defaultShell: 'auto',
    fontFamily: "Cascadia Code, 'JetBrains Mono', Consolas, monospace",
    fontSize: 13,
    cursorStyle: 'block',
    scrollback: 5000,
  },
  ai: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.2,
    maxTokens: 4096,
    contextWindow: 128000,
    enableAutocomplete: true,
    autocompleteDebounceMs: 300,
    agentMode: true,
    autoApplyEdits: true,
    streamResponses: true,
  },
  git: {
    autoFetch: false,
    autoFetchIntervalMinutes: 5,
    gitPath: 'git',
    confirmSync: true,
  },
  privacy: {
    telemetry: false,
    indexingEnabled: true,
    shareCodeWithAI: true,
    localModelsPreferred: false,
  },
  layout: {
    sidebarVisible: true,
    sidebarWidth: 260,
    aiPanelVisible: true,
    aiPanelWidth: 360,
    bottomPanelVisible: true,
    bottomPanelHeight: 220,
    bottomPanelTab: 'terminal',
    activityBarVisible: true,
    statusBarVisible: true,
    zenMode: false,
  },
  workspace: {
    lastPath: null,
    recentPaths: [],
    expandedPaths: [],
    selectedPath: null,
  },
  session: {
    openPaths: [],
    activePath: null,
  },
  shortcuts: {
    'workbench.action.quickOpen': 'Ctrl+P',
    'workbench.action.showCommands': 'Ctrl+Shift+P',
    'workbench.action.files.save': 'Ctrl+S',
    'workbench.action.files.saveAll': 'Ctrl+K S',
    'workbench.action.toggleSidebar': 'Ctrl+B',
    'workbench.action.toggleTerminal': 'Ctrl+`',
    'workbench.action.toggleAiChat': 'Ctrl+L',
    'ai.editSelection': 'Ctrl+K',
    'editor.action.find': 'Ctrl+F',
    'workbench.action.findInFiles': 'Ctrl+Shift+F',
    'workbench.action.closeActiveEditor': 'Ctrl+W',
  },
};
