import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActivityView, BottomPanelTab } from '../../packages/types/src/layout';

interface LayoutState {
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

  setActivityView: (view: ActivityView) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setSidebarWidth: (width: number) => void;
  toggleAiPanel: () => void;
  closeAiPanel: () => void;
  setAiPanelVisible: (visible: boolean) => void;
  setAiPanelWidth: (width: number) => void;
  toggleBottomPanel: () => void;
  closeBottomPanel: () => void;
  setBottomPanelVisible: (visible: boolean) => void;
  setBottomPanelHeight: (height: number) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openQuickOpen: () => void;
  closeQuickOpen: () => void;
  toggleQuickOpen: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
}

const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 640;
const MIN_AI = 240;
const MAX_AI = 720;
const MIN_BOTTOM = 80;
const MAX_BOTTOM = 720;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      activityView: 'explorer',
      sidebarVisible: true,
      sidebarWidth: 260,
      aiPanelVisible: true,
      aiPanelWidth: 360,
      bottomPanelVisible: true,
      bottomPanelHeight: 220,
      bottomPanelTab: 'terminal',
      commandPaletteOpen: false,
      settingsOpen: false,
      quickOpenOpen: false,

      setActivityView: (view) => {
        // Extensions removed — map old saved state to explorer
        const safeView = view === 'extensions' ? 'explorer' : view;
        const { activityView, sidebarVisible } = get();
        if (activityView === safeView && sidebarVisible) {
          set({ sidebarVisible: false });
        } else {
          set({ activityView: safeView, sidebarVisible: true });
        }
      },

      toggleSidebar: () => set({ sidebarVisible: !get().sidebarVisible }),
      closeSidebar: () => set({ sidebarVisible: false }),
      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

      setSidebarWidth: (width) => {
        const max = Math.min(MAX_SIDEBAR, Math.floor(window.innerWidth * 0.5));
        set({ sidebarWidth: Math.min(max, Math.max(MIN_SIDEBAR, Math.round(width))) });
      },

      toggleAiPanel: () => set({ aiPanelVisible: !get().aiPanelVisible }),
      closeAiPanel: () => set({ aiPanelVisible: false }),
      setAiPanelVisible: (visible) => set({ aiPanelVisible: visible }),

      setAiPanelWidth: (width) => {
        const max = Math.min(MAX_AI, Math.floor(window.innerWidth * 0.55));
        set({ aiPanelWidth: Math.min(max, Math.max(MIN_AI, Math.round(width))) });
      },

      toggleBottomPanel: () => set({ bottomPanelVisible: !get().bottomPanelVisible }),
      closeBottomPanel: () => set({ bottomPanelVisible: false }),
      setBottomPanelVisible: (visible) => set({ bottomPanelVisible: visible }),

      setBottomPanelHeight: (height) => {
        const max = Math.min(MAX_BOTTOM, Math.floor(window.innerHeight * 0.7));
        set({
          bottomPanelHeight: Math.min(max, Math.max(MIN_BOTTOM, Math.round(height))),
        });
      },

      setBottomPanelTab: (tab) =>
        set({ bottomPanelTab: tab, bottomPanelVisible: true }),

      openCommandPalette: () =>
        set({ commandPaletteOpen: true, settingsOpen: false, quickOpenOpen: false }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () =>
        set({
          commandPaletteOpen: !get().commandPaletteOpen,
          quickOpenOpen: false,
          settingsOpen: false,
        }),

      openQuickOpen: () =>
        set({ quickOpenOpen: true, commandPaletteOpen: false, settingsOpen: false }),
      closeQuickOpen: () => set({ quickOpenOpen: false }),
      toggleQuickOpen: () =>
        set({
          quickOpenOpen: !get().quickOpenOpen,
          commandPaletteOpen: false,
          settingsOpen: false,
        }),

      openSettings: () =>
        set({ settingsOpen: true, commandPaletteOpen: false, quickOpenOpen: false }),
      closeSettings: () => set({ settingsOpen: false }),
      toggleSettings: () =>
        set({
          settingsOpen: !get().settingsOpen,
          commandPaletteOpen: false,
          quickOpenOpen: false,
        }),
    }),
    {
      name: 'terminal-ide-layout',
      partialize: (state) => ({
        activityView: state.activityView,
        sidebarVisible: state.sidebarVisible,
        sidebarWidth: state.sidebarWidth,
        aiPanelVisible: state.aiPanelVisible,
        aiPanelWidth: state.aiPanelWidth,
        bottomPanelVisible: state.bottomPanelVisible,
        bottomPanelHeight: state.bottomPanelHeight,
        bottomPanelTab: state.bottomPanelTab,
      }),
    },
  ),
);
