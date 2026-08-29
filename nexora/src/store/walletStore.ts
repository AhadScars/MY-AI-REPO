import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BetType, PlacedBet, SlipSelection, Transaction, TxStatus, WalletState } from '../types';
import { seedBets, seedTransactions } from '../data/account';
import { uid } from '../lib/format';

interface PlaceInput {
  type: BetType;
  stake: number;
  odds: number;
  potential: number;
  legs: SlipSelection[];
}

interface WalletStore {
  wallet: WalletState;
  bets: PlacedBet[];
  txs: Transaction[];
  claimed: string[];
  placeBet: (input: PlaceInput) => { ok: boolean; error?: string; id?: string };
  deposit: (amount: number, method: string) => { ok: boolean; error?: string };
  withdraw: (amount: number, method: string) => { ok: boolean; error?: string };
  claimPromo: (id: string, amount: number) => { ok: boolean; error?: string };
  settleOpen: (id: string, status: 'won' | 'lost') => void;
  debit: (amount: number, note: string) => { ok: boolean; error?: string };
  credit: (amount: number, note: string) => void;
}

const startWallet: WalletState = {
  cash: 500,
  bonus: 0,
  promo: 0,
  reserved: 0,
  currency: 'INR',
};

export const useWallet = create<WalletStore>()(
  persist(
    (set, get) => ({
      wallet: startWallet,
      bets: seedBets,
      txs: seedTransactions,
      claimed: [],
      placeBet: (input) => {
        const { wallet } = get();
        if (input.stake > wallet.cash + wallet.bonus) {
          return { ok: false, error: 'Insufficient available balance.' };
        }
        const fromCash = Math.min(wallet.cash, input.stake);
        const fromBonus = input.stake - fromCash;
        const id = `NX-${Math.floor(100000 + Math.random() * 900000)}`;
        const bet: PlacedBet = {
          id,
          createdAt: new Date().toISOString(),
          type: input.type,
          status: 'open',
          stake: input.stake,
          odds: input.odds,
          potential: input.potential,
          legs: input.legs,
        };
        const tx: Transaction = {
          id: uid('tx'),
          createdAt: new Date().toISOString(),
          type: 'bet',
          status: 'completed',
          amount: -input.stake,
          note: `${input.type} · ${input.legs.map((l) => l.selectionLabel).join(' / ')}`,
        };
        set({
          wallet: {
            ...wallet,
            cash: +(wallet.cash - fromCash).toFixed(2),
            bonus: +(wallet.bonus - fromBonus).toFixed(2),
            reserved: +(wallet.reserved + input.stake).toFixed(2),
          },
          bets: [bet, ...get().bets],
          txs: [tx, ...get().txs],
        });
        return { ok: true, id };
      },
      deposit: (amount, method) => {
        if (amount < 10) return { ok: false, error: 'Minimum demo deposit is ₹10.' };
        if (amount > 5000) return { ok: false, error: 'Maximum demo deposit is ₹5,000.' };
        const tx: Transaction = {
          id: uid('tx'),
          createdAt: new Date().toISOString(),
          type: 'deposit',
          status: 'completed',
          amount,
          method,
          reference: `DEP-${Math.floor(80000 + Math.random() * 9999)}`,
        };
        set((s) => ({
          wallet: { ...s.wallet, cash: +(s.wallet.cash + amount).toFixed(2) },
          txs: [tx, ...s.txs],
        }));
        return { ok: true };
      },
      withdraw: (amount, method) => {
        const { wallet } = get();
        if (amount < 20) return { ok: false, error: 'Minimum demo withdrawal is ₹20.' };
        if (amount > wallet.cash) return { ok: false, error: 'You can only withdraw cash, not bonus funds.' };
        const tx: Transaction = {
          id: uid('tx'),
          createdAt: new Date().toISOString(),
          type: 'withdrawal',
          status: 'processing',
          amount: -amount,
          method,
          reference: `WD-${Math.floor(20000 + Math.random() * 9999)}`,
        };
        set({
          wallet: { ...wallet, cash: +(wallet.cash - amount).toFixed(2) },
          txs: [tx, ...get().txs],
        });
        return { ok: true };
      },
      claimPromo: (id, amount) => {
        if (get().claimed.includes(id)) return { ok: false, error: 'Already claimed on this demo account.' };
        const tx: Transaction = {
          id: uid('tx'),
          createdAt: new Date().toISOString(),
          type: 'bonus',
          status: 'completed',
          amount,
          note: `Promotion ${id}`,
        };
        set((s) => ({
          claimed: [...s.claimed, id],
          wallet: { ...s.wallet, promo: +(s.wallet.promo + amount).toFixed(2), bonus: +(s.wallet.bonus + amount).toFixed(2) },
          txs: [tx, ...s.txs],
        }));
        return { ok: true };
      },
      debit: (amount, note) => {
        const { wallet } = get();
        if (amount > wallet.cash) return { ok: false, error: 'Not enough INR balance to join this table.' };
        const tx: Transaction = {
          id: uid('tx'),
          createdAt: new Date().toISOString(),
          type: 'bet',
          status: 'completed',
          amount: -amount,
          note,
        };
        set({
          wallet: { ...wallet, cash: +(wallet.cash - amount).toFixed(2) },
          txs: [tx, ...get().txs],
        });
        return { ok: true };
      },
      credit: (amount, note) => {
        const tx: Transaction = {
          id: uid('tx'),
          createdAt: new Date().toISOString(),
          type: 'win',
          status: 'completed',
          amount,
          note,
        };
        set((s) => ({
          wallet: { ...s.wallet, cash: +(s.wallet.cash + amount).toFixed(2), currency: 'INR' },
          txs: [tx, ...s.txs],
        }));
      },
      settleOpen: (id, status) => {
        const bet = get().bets.find((b) => b.id === id);
        if (!bet || bet.status !== 'open') return;
        const returns = status === 'won' ? bet.potential : 0;
        set((s) => ({
          bets: s.bets.map((b) =>
            b.id === id
              ? { ...b, status, settledAt: new Date().toISOString(), returns }
              : b,
          ),
          wallet: {
            ...s.wallet,
            cash: +(s.wallet.cash + returns).toFixed(2),
            reserved: +Math.max(0, s.wallet.reserved - bet.stake).toFixed(2),
          },
          txs: [
            {
              id: uid('tx'),
              createdAt: new Date().toISOString(),
              type: status === 'won' ? 'win' : 'bet',
              status: 'completed' as TxStatus,
              amount: status === 'won' ? returns : 0,
              note: `${id} ${status}`,
            },
            ...s.txs,
          ],
        }));
      },
    }),
    { name: 'nexora-wallet-inr' },
  ),
);
