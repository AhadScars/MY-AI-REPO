import { create } from 'zustand';
import { DEFAULT_SETTINGS, type AppSettings, type ThemeMode } from '../../packages/types/src/settings';
import { requireApi } from '../services/platform';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(
    section: K,
    value: Partial<AppSettings[K]>,
  ) => Promise<void>;
  setNested: (key: string, value: unknown) => Promise<void>;
  reset: () => Promise<void>;
}

function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  let resolved: 'dark' | 'light' = 'dark';
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } else {
    resolved = theme;
  }
  root.classList.remove('dark', 'light');
  root.classList.add(resolved);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: structuredClone(DEFAULT_SETTINGS),
  loaded: false,

  load: async () => {
    try {
      const api = requireApi();
      const all = (await api.getAllSettings()) as Partial<AppSettings>;
      if (all && Object.keys(all).length > 0) {
        const merged: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...all,
          general: { ...DEFAULT_SETTINGS.general, ...all.general },
          editor: { ...DEFAULT_SETTINGS.editor, ...all.editor },
          terminal: { ...DEFAULT_SETTINGS.terminal, ...all.terminal },
          ai: { ...DEFAULT_SETTINGS.ai, ...all.ai },
          git: { ...DEFAULT_SETTINGS.git, ...all.git },
          privacy: { ...DEFAULT_SETTINGS.privacy, ...all.privacy },
          layout: { ...DEFAULT_SETTINGS.layout, ...all.layout },
          workspace: { ...DEFAULT_SETTINGS.workspace, ...all.workspace },
          session: { ...DEFAULT_SETTINGS.session, ...all.session },
          shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...all.shortcuts },
        };
        set({ settings: merged, loaded: true });
        applyTheme(merged.general.theme);
        return;
      }
    } catch {
      // Fall through to defaults
    }
    set({ settings: structuredClone(DEFAULT_SETTINGS), loaded: true });
    applyTheme(DEFAULT_SETTINGS.general.theme);
  },

  setTheme: async (theme) => {
    await get().updateSetting('general', { theme });
    applyTheme(theme);
  },

  updateSetting: async (section, value) => {
    const next = {
      ...get().settings,
      [section]: { ...get().settings[section], ...value },
    };
    set({ settings: next });
    try {
      const api = requireApi();
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        await api.setSetting({ key: `${String(section)}.${k}`, value: v });
      }
    } catch {
      // Persist best-effort
    }
  },

  setNested: async (key, value) => {
    try {
      const api = requireApi();
      await api.setSetting({ key, value });
      await get().load();
    } catch {
      // ignore
    }
  },

  reset: async () => {
    try {
      await requireApi().resetSettings();
    } catch {
      // ignore
    }
    set({ settings: structuredClone(DEFAULT_SETTINGS) });
    applyTheme(DEFAULT_SETTINGS.general.theme);
  },
}));
