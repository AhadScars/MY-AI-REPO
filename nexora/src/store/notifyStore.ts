import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppNotification } from '../types';
import { seedNotifications } from '../data/account';
import { uid } from '../lib/format';

interface NotifyState {
  items: AppNotification[];
  unread: () => number;
  markRead: (id: string) => void;
  markAll: () => void;
  push: (item: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
}

export const useNotify = create<NotifyState>()(
  persist(
    (set, get) => ({
      items: seedNotifications,
      unread: () => get().items.filter((n) => !n.read).length,
      markRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAll: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
      push: (item) =>
        set((s) => ({
          items: [
            { ...item, id: uid('n'), createdAt: new Date().toISOString(), read: false },
            ...s.items,
          ],
        })),
    }),
    { name: 'nexora-notify' },
  ),
);
