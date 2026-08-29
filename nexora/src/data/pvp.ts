import type { PvpGameKind, PvpMode, PvpRules, PvpSeat } from '../types';

export const pvpRules: Record<PvpMode, PvpRules> = {
  duo: { mode: 'duo', seats: 2, entry: 15, winner: 25, owner: 5, pot: 30 },
  trio: { mode: 'trio', seats: 3, entry: 17, winner: 35, owner: 16, pot: 51 },
};

export const pvpGames: Array<{
  kind: PvpGameKind;
  name: string;
  blurb: string;
  modes: PvpMode[];
}> = [
  { kind: 'rps', name: 'Hand Clash', blurb: 'Rock · paper · scissors. First to beat the other player.', modes: ['duo'] },
  { kind: 'penalty', name: 'Penalty Duel', blurb: 'Pick a corner. The keeper dives one way.', modes: ['duo'] },
  { kind: 'dice', name: 'High Dice', blurb: 'Everyone rolls. Highest number takes the pot.', modes: ['duo', 'trio'] },
  { kind: 'spin', name: 'Lucky Seat', blurb: 'The wheel lands on one of three seats.', modes: ['trio'] },
  { kind: 'color', name: 'Color Call', blurb: 'Pick a colour. The ball picks one winner.', modes: ['trio'] },
];

export const botPool: Array<Pick<PvpSeat, 'id' | 'name' | 'handle'>> = [
  { id: 'bot_rohan', name: 'Rohan Kapoor', handle: 'rohan.k' },
  { id: 'bot_priya', name: 'Priya Shah', handle: 'priya.s' },
  { id: 'bot_imran', name: 'Imran Qureshi', handle: 'imran.q' },
  { id: 'bot_neha', name: 'Neha Verma', handle: 'neha.v' },
  { id: 'bot_arjun', name: 'Arjun Mehta', handle: 'arjun.m' },
  { id: 'bot_sara', name: 'Sara D’Souza', handle: 'sara.d' },
];

export const rpsMoves = [
  { id: 'rock', label: 'Rock' },
  { id: 'paper', label: 'Paper' },
  { id: 'scissors', label: 'Scissors' },
];

export const penaltyMoves = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centre' },
  { id: 'right', label: 'Right' },
];

export const colorMoves = [
  { id: 'green', label: 'Green' },
  { id: 'gold', label: 'Gold' },
  { id: 'navy', label: 'Navy' },
];

export function beatsRps(a: string, b: string) {
  return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');
}

export function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
