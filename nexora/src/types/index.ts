export type SportId =
  | 'football'
  | 'cricket'
  | 'basketball'
  | 'tennis'
  | 'baseball'
  | 'hockey'
  | 'boxing'
  | 'mma'
  | 'esports'
  | 'f1';

export type EventStatus = 'upcoming' | 'live' | 'finished' | 'suspended';
export type MarketType =
  | 'winner'
  | 'handicap'
  | 'over_under'
  | 'btts'
  | 'correct_score'
  | 'scorer'
  | 'ht_result'
  | 'player_prop'
  | 'special';

export type BetType = 'single' | 'multi' | 'system';
export type BetStatus = 'open' | 'won' | 'lost' | 'void' | 'cashed_out' | 'pending';
export type TxType = 'deposit' | 'withdrawal' | 'bet' | 'win' | 'bonus' | 'refund' | 'cashback';
export type TxStatus = 'completed' | 'pending' | 'failed' | 'cancelled' | 'processing';
export type OddsFormat = 'decimal' | 'american' | 'fractional';
export type ThemeMode = 'dark' | 'light';
export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type NotificationKind =
  | 'odds'
  | 'settlement'
  | 'promo'
  | 'deposit'
  | 'withdrawal'
  | 'security'
  | 'system';

export interface Sport {
  id: SportId;
  name: string;
  shortName: string;
  accent: string;
  liveCount: number;
  eventCount: number;
}

export interface League {
  id: string;
  name: string;
  shortName: string;
  sportId: SportId;
  country: string;
  featured?: boolean;
}

export interface Competitor {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  color: string;
  secondary: string;
  sportId: SportId;
  country: string;
  rank?: number;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: string;
  number?: number;
}

export interface Selection {
  id: string;
  marketId: string;
  eventId: string;
  label: string;
  odds: number;
  previousOdds?: number;
  line?: number;
  suspended?: boolean;
}

export interface Market {
  id: string;
  eventId: string;
  type: MarketType;
  name: string;
  selections: Selection[];
}

export interface TimelineEvent {
  minute: number;
  type: 'goal' | 'card' | 'sub' | 'period' | 'point' | 'wicket' | 'try';
  team: 'home' | 'away';
  label: string;
}

export interface MatchStats {
  label: string;
  home: number;
  away: number;
}

export interface EventItem {
  id: string;
  sportId: SportId;
  leagueId: string;
  homeId: string;
  awayId: string;
  startTime: string;
  status: EventStatus;
  minute?: number;
  period?: string;
  homeScore?: number;
  awayScore?: number;
  homeScore2?: number;
  awayScore2?: number;
  markets: Market[];
  featured?: boolean;
  trending?: boolean;
  venue?: string;
  city?: string;
  watchLive?: boolean;
  momentum?: number;
  timeline?: TimelineEvent[];
  stats?: MatchStats[];
  form?: { home: Array<'W' | 'D' | 'L'>; away: Array<'W' | 'D' | 'L'> };
  h2h?: Array<{ date: string; home: string; away: string; hs: number; as: number }>;
}

export interface SlipSelection {
  selectionId: string;
  eventId: string;
  marketId: string;
  eventLabel: string;
  marketName: string;
  selectionLabel: string;
  odds: number;
  lockedOdds: number;
  sportId: SportId;
  startTime: string;
  live: boolean;
}

export interface PlacedBet {
  id: string;
  createdAt: string;
  settledAt?: string;
  type: BetType;
  status: BetStatus;
  stake: number;
  odds: number;
  potential: number;
  returns?: number;
  legs: SlipSelection[];
}

export interface Transaction {
  id: string;
  createdAt: string;
  type: TxType;
  status: TxStatus;
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  holder: string;
  primary?: boolean;
}

export interface Promotion {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  longCopy: string;
  category: 'welcome' | 'freebet' | 'boost' | 'cashback' | 'reload' | 'sport' | 'referral';
  cta: string;
  expires: string;
  eligibility: string;
  terms: string[];
  image: string;
  accent: string;
  claimed?: boolean;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  handle: string;
  points: number;
  wins: number;
  bets: number;
  roi: number;
  streak: number;
  avatar: string;
}

export interface CasinoGame {
  id: string;
  name: string;
  category: 'slots' | 'blackjack' | 'roulette' | 'live' | 'crash' | 'game-show';
  studio: string;
  rtp: string;
  volatility: 'Low' | 'Medium' | 'High';
  image: string;
  badge?: string;
  popular?: boolean;
  fresh?: boolean;
}

export interface DemoUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
  handle: string;
  dob: string;
  country: string;
  currency: string;
  phone: string;
  role: 'user' | 'admin';
  kyc: KycStatus;
  twoFactor: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface WalletState {
  cash: number;
  bonus: number;
  promo: number;
  reserved: number;
  currency: string;
}

export interface RgLimits {
  depositDaily: number | null;
  depositWeekly: number | null;
  depositMonthly: number | null;
  stakeMax: number | null;
  lossDaily: number | null;
  sessionMinutes: number | null;
  realityCheckMinutes: number | null;
  coolingOffUntil: string | null;
  selfExcludedUntil: string | null;
}

export interface AdminAlert {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  time: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  ip: string;
}

export type PvpMode = 'duo' | 'trio';
export type PvpStatus = 'open' | 'playing' | 'settled' | 'cancelled';
export type PvpGameKind = 'rps' | 'penalty' | 'dice' | 'spin' | 'color';

export interface PvpRules {
  mode: PvpMode;
  seats: number;
  entry: number;
  winner: number;
  owner: number;
  pot: number;
}

export interface PvpSeat {
  id: string;
  name: string;
  handle: string;
  bot: boolean;
  you?: boolean;
  move?: string;
}

export interface PvpRoom {
  id: string;
  title: string;
  kind: PvpGameKind;
  mode: PvpMode;
  status: PvpStatus;
  seats: PvpSeat[];
  createdAt: string;
  settledAt?: string;
  winnerId?: string;
  resultNote?: string;
}

export type ToastKind = 'success' | 'error' | 'info' | 'warn';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
}
