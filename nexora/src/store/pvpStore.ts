import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PvpGameKind, PvpMode, PvpRoom, PvpSeat } from '../types';
import { beatsRps, botPool, pick, pvpRules } from '../data/pvp';
import { uid } from '../lib/format';
import { useAuth } from './authStore';
import { useWallet } from './walletStore';

interface PvpState {
  rooms: PvpRoom[];
  house: number;
  create: (kind: PvpGameKind, mode: PvpMode) => { ok: boolean; error?: string; id?: string };
  join: (roomId: string) => { ok: boolean; error?: string };
  fillBots: (roomId: string) => void;
  play: (roomId: string, move: string) => { ok: boolean; error?: string };
  leave: (roomId: string) => void;
}

function youSeat(): PvpSeat | null {
  const user = useAuth.getState().user;
  if (!user) return null;
  return {
    id: user.id,
    name: user.displayName,
    handle: user.handle,
    bot: false,
    you: true,
  };
}

function unusedBots(rooms: PvpRoom[]) {
  const taken = new Set(rooms.flatMap((r) => r.seats.map((s) => s.id)));
  return botPool.filter((b) => !taken.has(b.id));
}

function settle(room: PvpRoom): PvpRoom {
  const rules = pvpRules[room.mode];
  const seats = room.seats;
  let winnerId = seats[0]?.id;
  let note = '';

  if (room.kind === 'rps' && seats.length === 2) {
    const [a, b] = seats;
    if (!a.move || !b.move) return room;
    if (a.move === b.move) {
      const retry = pick(['rock', 'paper', 'scissors']);
      const other = pick(['rock', 'paper', 'scissors'].filter((m) => m !== retry));
      a.move = retry;
      b.move = other;
    }
    winnerId = beatsRps(a.move!, b.move!) ? a.id : b.id;
    note = `${seats.find((s) => s.id === winnerId)?.name} wins Hand Clash.`;
  } else if (room.kind === 'penalty' && seats.length === 2) {
    const shooter = seats[0];
    const keeper = seats[1];
    if (!shooter.move) return room;
    keeper.move = pick(['left', 'center', 'right']);
    winnerId = shooter.move === keeper.move ? keeper.id : shooter.id;
    note =
      shooter.move === keeper.move
        ? `Saved! ${keeper.name} takes the pot.`
        : `Goal! ${shooter.name} slots it ${shooter.move}.`;
  } else if (room.kind === 'dice') {
    for (const s of seats) s.move = String(1 + Math.floor(Math.random() * 6));
    const ranked = [...seats].sort((a, b) => Number(b.move) - Number(a.move));
    if (ranked[0].move === ranked[1].move) ranked[0].move = String(Number(ranked[0].move) + 1);
    winnerId = ranked[0].id;
    note = `${ranked[0].name} rolls ${ranked[0].move}.`;
  } else if (room.kind === 'spin') {
    const land = pick(seats);
    winnerId = land.id;
    for (const s of seats) s.move = s.id === land.id ? 'hit' : 'miss';
    note = `Wheel lands on ${land.name}.`;
  } else if (room.kind === 'color') {
    const colours = ['green', 'gold', 'navy'];
    const ball = pick(colours);
    for (const s of seats) {
      if (!s.move) s.move = pick(colours);
    }
    const hits = seats.filter((s) => s.move === ball);
    const win = hits[0] ?? pick(seats);
    winnerId = win.id;
    note = `Ball is ${ball}. ${win.name} called it.`;
  }

  const you = useAuth.getState().user;
  if (you && winnerId === you.id) {
    useWallet.getState().credit(rules.winner, `Won ${room.title} · ${rules.mode === 'duo' ? '2-player' : '3-player'}`);
  }

  return {
    ...room,
    seats,
    status: 'settled',
    settledAt: new Date().toISOString(),
    winnerId,
    resultNote: `${note} Winner ₹${rules.winner}. House ₹${rules.owner}. Losers ₹0.`,
  };
}

export const usePvp = create<PvpState>()(
  persist(
    (set, get) => ({
      rooms: [],
      house: 0,
      create: (kind, mode) => {
        const seat = youSeat();
        if (!seat) return { ok: false, error: 'Sign in to join a player table.' };
        const rules = pvpRules[mode];
        const paid = useWallet.getState().debit(rules.entry, `Join ${mode === 'duo' ? '2-player' : '3-player'} · ₹${rules.entry}`);
        if (!paid.ok) return paid;
        const id = uid('tbl');
        const room: PvpRoom = {
          id,
          title: mode === 'duo' ? '2-player table' : '3-player table',
          kind,
          mode,
          status: 'open',
          seats: [seat],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ rooms: [room, ...s.rooms] }));
        window.setTimeout(() => get().fillBots(id), 900);
        return { ok: true, id };
      },
      join: (roomId) => {
        const seat = youSeat();
        if (!seat) return { ok: false, error: 'Sign in to join a player table.' };
        const room = get().rooms.find((r) => r.id === roomId);
        if (!room || room.status !== 'open') return { ok: false, error: 'That table is no longer open.' };
        if (room.seats.some((s) => s.id === seat.id)) return { ok: true, id: roomId };
        const rules = pvpRules[room.mode];
        if (room.seats.length >= rules.seats) return { ok: false, error: 'Table is full.' };
        const paid = useWallet.getState().debit(rules.entry, `Join table ${roomId} · ₹${rules.entry}`);
        if (!paid.ok) return paid;
        const seats = [...room.seats, seat];
        const full = seats.length >= rules.seats;
        set((s) => ({
          rooms: s.rooms.map((r) =>
            r.id === roomId ? { ...r, seats, status: full ? 'playing' : 'open' } : r,
          ),
        }));
        if (!full) window.setTimeout(() => get().fillBots(roomId), 800);
        return { ok: true, id: roomId };
      },
      fillBots: (roomId) => {
        const room = get().rooms.find((r) => r.id === roomId);
        if (!room || room.status !== 'open') return;
        const rules = pvpRules[room.mode];
        const need = rules.seats - room.seats.length;
        if (need <= 0) return;
        const bots = unusedBots(get().rooms)
          .slice(0, need)
          .map((b) => ({ ...b, bot: true }) satisfies PvpSeat);
        const seats = [...room.seats, ...bots];
        set((s) => ({
          rooms: s.rooms.map((r) =>
            r.id === roomId
              ? { ...r, seats, status: seats.length >= rules.seats ? 'playing' : 'open' }
              : r,
          ),
        }));
      },
      play: (roomId, move) => {
        const room = get().rooms.find((r) => r.id === roomId);
        if (!room || room.status !== 'playing') return { ok: false, error: 'This table is not in play.' };
        const you = useAuth.getState().user;
        if (!you) return { ok: false, error: 'Sign in required.' };
        const seats = room.seats.map((s) => {
          if (s.id === you.id) return { ...s, move };
          if (s.bot && !s.move) {
            if (room.kind === 'dice') return s;
            if (room.kind === 'rps') return { ...s, move: pick(['rock', 'paper', 'scissors']) };
            if (room.kind === 'penalty') return { ...s, move: pick(['left', 'center', 'right']) };
            if (room.kind === 'color') return { ...s, move: pick(['green', 'gold', 'navy']) };
            return { ...s, move: 'auto' };
          }
          return s;
        });
        const playing: PvpRoom = { ...room, seats };
        const settled = settle(playing);
        set((s) => ({
          rooms: s.rooms.map((r) => (r.id === roomId ? settled : r)),
          house: s.house + (settled.status === 'settled' ? pvpRules[room.mode].owner : 0),
        }));
        return { ok: true };
      },
      leave: (roomId) => {
        const room = get().rooms.find((r) => r.id === roomId);
        const you = useAuth.getState().user;
        if (!room || !you || room.status !== 'open') return;
        if (!room.seats.some((s) => s.id === you.id)) return;
        useWallet.getState().credit(pvpRules[room.mode].entry, `Refund · left ${room.title}`);
        const seats = room.seats.filter((s) => s.id !== you.id);
        set((s) => ({
          rooms: s.rooms.map((r) =>
            r.id === roomId ? { ...r, seats, status: seats.length ? 'open' : 'cancelled' } : r,
          ),
        }));
      },
    }),
    { name: 'nexora-pvp' },
  ),
);
