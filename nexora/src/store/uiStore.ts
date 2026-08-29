import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OddsFormat, ThemeMode, ToastItem, ToastKind } from '../types';
import { uid } from '../lib/format';

interface UiState {
  theme: ThemeMode;
  oddsFormat: OddsFormat;
  slipOpen: boolean;
  searchOpen: boolean;
  notifyOpen: boolean;
  menuOpen: boolean;
  ageAccepted: boolean;
  toasts: ToastItem[];
  setTheme: (t: ThemeMode) => void;
  setOddsFormat: (f: OddsFormat) => void;
  setSlipOpen: (v: boolean) => void;
  toggleSlip: () => void;
  setSearchOpen: (v: boolean) => void;
  setNotifyOpen: (v: boolean) => void;
  setMenuOpen: (v: boolean) => void;
  acceptAge: () => void;
  pushToast: (kind: ToastKind, title: string, body?: string) => void;
  dismissToast: (id: string) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      oddsFormat: 'decimal',
      slipOpen: false,
      searchOpen: false,
      notifyOpen: false,
      menuOpen: false,
      ageAccepted: false,
      toasts: [],
      setTheme: (theme) => set({ theme }),
      setOddsFormat: (oddsFormat) => set({ oddsFormat }),
      setSlipOpen: (slipOpen) => set({ slipOpen }),
      toggleSlip: () => set((s) => ({ slipOpen: !s.slipOpen })),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setNotifyOpen: (notifyOpen) => set({ notifyOpen }),
      setMenuOpen: (menuOpen) => set({ menuOpen }),
      acceptAge: () => set({ ageAccepted: true }),
      pushToast: (kind, title, body) => {
        const item: ToastItem = { id: uid('toast'), kind, title, body };
        set((s) => ({ toasts: [...s.toasts.slice(-4), item] }));
        window.setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== item.id) }));
        }, 4200);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'nexora-ui',
      partialize: (s) => ({
        theme: s.theme,
        oddsFormat: s.oddsFormat,
        ageAccepted: s.ageAccepted,
      }),
    },
  ),
);
