import type { BetType, SlipSelection } from '../types';

export const MIN_STAKE = 1;
export const MAX_STAKE = 10_000;

export function combinedOdds(legs: SlipSelection[]): number {
  return legs.reduce((acc, leg) => acc * leg.odds, 1);
}

export function potentialReturn(stake: number, odds: number): number {
  if (!Number.isFinite(stake) || stake <= 0) return 0;
  return stake * odds;
}

export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let res = 1;
  for (let i = 1; i <= k; i += 1) res = (res * (n - k + i)) / i;
  return Math.round(res);
}

export function systemSize(legs: number, fold: number): number {
  return combinations(legs, fold);
}

export function systemPotential(legs: SlipSelection[], stakePerBet: number, fold: number): number {
  if (legs.length < fold) return 0;
  const idxs = legs.map((_, i) => i);
  const combos = pickCombos(idxs, fold);
  return combos.reduce((sum, combo) => {
    const odds = combo.reduce((acc, i) => acc * legs[i].odds, 1);
    return sum + stakePerBet * odds;
  }, 0);
}

function pickCombos(items: number[], k: number): number[][] {
  const out: number[][] = [];
  const walk = (start: number, acc: number[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      acc.push(items[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

export function stakeHint(stake: number): string | null {
  if (!stake) return 'Enter a stake to see your potential return.';
  if (stake < MIN_STAKE) return `Minimum stake is ${MIN_STAKE.toFixed(2)}.`;
  if (stake > MAX_STAKE) return `Maximum stake is ${MAX_STAKE.toLocaleString()}.`;
  return null;
}

export function defaultBetType(count: number): BetType {
  if (count <= 1) return 'single';
  return 'multi';
}

export function jitterOdds(odds: number, intensity = 0.035): number {
  const delta = 1 + (Math.random() * 2 - 1) * intensity;
  const next = odds * delta;
  return Math.max(1.01, Math.round(next * 100) / 100);
}

export function impliedProb(odds: number): number {
  return 1 / odds;
}
