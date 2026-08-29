import { create } from 'zustand';
import type { BetType, EventItem, Market, Selection, SlipSelection } from '../types';
import { combinedOdds, defaultBetType, MIN_STAKE, MAX_STAKE, potentialReturn, systemPotential } from '../lib/odds';
import { teamById } from '../data/catalog';
import { useWallet } from './walletStore';
import { useUi } from './uiStore';

interface SlipState {
  legs: SlipSelection[];
  betType: BetType;
  stake: number;
  systemFold: number;
  placing: boolean;
  lastReceipt: string | null;
  addFrom: (event: EventItem, market: Market, selection: Selection) => void;
  remove: (selectionId: string) => void;
  clear: () => void;
  setBetType: (t: BetType) => void;
  setStake: (n: number) => void;
  setSystemFold: (n: number) => void;
  syncOdds: (selectionId: string, next: number) => void;
  acceptOdds: () => void;
  place: () => Promise<{ ok: boolean; error?: string; id?: string }>;
}

export const useSlip = create<SlipState>()((set, get) => ({
  legs: [],
  betType: 'single',
  stake: 10,
  systemFold: 2,
  placing: false,
  lastReceipt: null,
  addFrom: (event, market, selection) => {
    set((s) => {
      const exists = s.legs.some((l) => l.selectionId === selection.id);
      if (exists) {
        const legs = s.legs.filter((l) => l.selectionId !== selection.id);
        return { legs, betType: defaultBetType(legs.length) };
      }
      const sameEvent = s.legs.filter((l) => l.eventId !== event.id);
      const home = teamById[event.homeId];
      const away = teamById[event.awayId];
      const next: SlipSelection = {
        selectionId: selection.id,
        eventId: event.id,
        marketId: market.id,
        eventLabel: `${home?.shortName ?? 'Home'} vs ${away?.shortName ?? 'Away'}`,
        marketName: market.name,
        selectionLabel: selection.label,
        odds: selection.odds,
        lockedOdds: selection.odds,
        sportId: event.sportId,
        startTime: event.startTime,
        live: event.status === 'live',
      };
      const legs = [...sameEvent, next];
      return { legs, betType: defaultBetType(legs.length), lastReceipt: null };
    });
    useUi.getState().setSlipOpen(true);
  },
  remove: (selectionId) =>
    set((s) => {
      const legs = s.legs.filter((l) => l.selectionId !== selectionId);
      return { legs, betType: defaultBetType(legs.length) };
    }),
  clear: () => set({ legs: [], betType: 'single', lastReceipt: null }),
  setBetType: (betType) => set({ betType }),
  setStake: (stake) => set({ stake }),
  setSystemFold: (systemFold) => set({ systemFold }),
  syncOdds: (selectionId, next) =>
    set((s) => ({
      legs: s.legs.map((l) => (l.selectionId === selectionId ? { ...l, odds: next } : l)),
    })),
  acceptOdds: () =>
    set((s) => ({
      legs: s.legs.map((l) => ({ ...l, lockedOdds: l.odds })),
    })),
  place: async () => {
    const { legs, stake, betType, systemFold } = get();
    const authOk = Boolean(useWallet.getState());
    if (!authOk) return { ok: false, error: 'Wallet unavailable.' };
    if (!legs.length) return { ok: false, error: 'Add a selection first.' };
    if (stake < MIN_STAKE) return { ok: false, error: `Minimum stake is ${MIN_STAKE.toFixed(2)}.` };
    if (stake > MAX_STAKE) return { ok: false, error: `Maximum stake is ${MAX_STAKE.toLocaleString()}.` };
    if (betType === 'multi' && legs.length < 2) return { ok: false, error: 'A multi needs at least two selections.' };
    if (betType === 'system' && legs.length < 3) return { ok: false, error: 'A system bet needs at least three selections.' };

    const odds = betType === 'single' ? legs[0].odds : combinedOdds(legs);
    const potential =
      betType === 'system' ? systemPotential(legs, stake, systemFold) : potentialReturn(stake, odds);
    const totalStake = betType === 'system' ? stake * combinationsSafe(legs.length, systemFold) : stake;

    set({ placing: true });
    await wait(900);
    const result = useWallet.getState().placeBet({
      type: betType,
      stake: totalStake,
      odds: betType === 'system' ? potential / totalStake : odds,
      potential,
      legs,
    });
    set({ placing: false });
    if (!result.ok) return result;
    set({ lastReceipt: result.id, legs: [], betType: 'single' });
    return result;
  },
}));

function combinationsSafe(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let res = 1;
  for (let i = 1; i <= k; i += 1) res = (res * (n - k + i)) / i;
  return Math.round(res);
}

function wait(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

export function slipHas(selectionId: string) {
  return useSlip.getState().legs.some((l) => l.selectionId === selectionId);
}
