export type ActivityView =
  | 'explorer'
  | 'search'
  | 'git'
  | 'database'
  | 'maven'
  | 'extensions'
  | 'settings';

export type BottomPanelTab = 'terminal' | 'problems' | 'output' | 'sql' | 'browser' | 'debug';

export interface PanelState {
  activityView: ActivityView;
  sidebarVisible: boolean;
  sidebarWidth: number;
  aiPanelVisible: boolean;
  aiPanelWidth: number;
  bottomPanelVisible: boolean;
  bottomPanelHeight: number;
  bottomPanelTab: BottomPanelTab;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  quickOpenOpen: boolean;
}

export type ResizeHandle = 'sidebar' | 'aiPanel' | 'bottomPanel';
