import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavState {
  events: string[];
  toggle: (eventId: string) => void;
  has: (eventId: string) => boolean;
}

export const useFavorites = create<FavState>()(
  persist(
    (set, get) => ({
      events: ['epl_ars_liv', 'atp_sin_alc', 'ufc_islam_arman'],
      toggle: (eventId) =>
        set((s) => ({
          events: s.events.includes(eventId) ? s.events.filter((id) => id !== eventId) : [...s.events, eventId],
        })),
      has: (eventId) => get().events.includes(eventId),
    }),
    { name: 'nexora-favs' },
  ),
);
