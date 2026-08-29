import type { AdminAlert, CasinoGame, LeaderboardRow, Promotion } from '../types';
import { hoursFromNow } from '../lib/format';

export const promotions: Promotion[] = [
  {
    id: 'welcome',
    title: 'Welcome Boost — up to $200 matched',
    eyebrow: 'New customers',
    description: 'A matched demo credit on your first simulated deposit, released as you place qualifying bets.',
    longCopy:
      'This is a demonstration welcome offer. Place a first demo deposit of $20–$200 and receive a matching promo balance. Promo funds are not withdrawable and exist only to preview how a regulated sportsbook would present a welcome package.',
    category: 'welcome',
    cta: 'Claim welcome offer',
    expires: hoursFromNow(240),
    eligibility: 'New demo accounts · 18+ · one per household',
    terms: [
      'Demo only — no real-money wagering.',
      'Minimum first deposit $20, maximum match $200.',
      'Promo balance is used after cash on qualifying pre-match sports bets at odds of 1.80 or greater.',
      'Unused promo balance expires 14 days after claim.',
    ],
    image: '/images/hero-football.jpg',
    accent: '#14f195',
  },
  {
    id: 'freebet',
    title: '$25 free bet after 5 settled singles',
    eyebrow: 'Free bet',
    description: 'Settle five singles this week and unlock a $25 free bet token on any sport.',
    longCopy: 'A weekly engagement offer designed like a licensed sportsbook token. Tokens are demo credits and cannot be withdrawn.',
    category: 'freebet',
    cta: 'Activate token path',
    expires: hoursFromNow(80),
    eligibility: 'Verified accounts · 5 settled singles ≥ $10',
    terms: [
      'Each qualifying single must be settled within the offer window.',
      'Free bet stake is not returned with winnings.',
      'Token expires 7 days after issue.',
    ],
    image: '/images/hero-tennis.jpg',
    accent: '#c8ff4d',
  },
  {
    id: 'boost',
    title: 'UCL & UFC weekend price boosts',
    eyebrow: 'Odds boost',
    description: 'Enhanced prices on Real Madrid, Bayern, Makhachev and the UFC 318 co-main.',
    longCopy: 'Selected prices are artificially improved for the demo. Boosted odds are clearly marked on event cards.',
    category: 'boost',
    cta: 'See boosted markets',
    expires: hoursFromNow(60),
    eligibility: 'All customers · in-play excluded on some markets',
    terms: ['Boosted price replaces the board price.', 'Limited to $50 stake at the boosted price.', 'Subject to availability.'],
    image: '/images/hero-mma.jpg',
    accent: '#ff4d6a',
  },
  {
    id: 'cashback',
    title: '10% weekly cashback on net losses',
    eyebrow: 'Cashback',
    description: 'If you finish the week behind, 10% of net settled losses return as bonus balance.',
    longCopy: 'Calculated Monday 00:00–Sunday 23:59 (demo timezone). Paid as bonus, not cash.',
    category: 'cashback',
    cta: 'Opt in',
    expires: hoursFromNow(120),
    eligibility: 'Opt-in required each week',
    terms: ['Net losses only. Winning weeks pay $0.', 'Capped at $100 bonus.', 'Bonus used on 1.80+ singles.'],
    image: '/images/promo-bg.jpg',
    accent: '#f5c451',
  },
  {
    id: 'reload',
    title: 'Friday reload — 30% up to $75',
    eyebrow: 'Reload',
    description: 'Deposit on Friday and receive a 30% promo top-up, up to $75.',
    longCopy: 'A recurring midweek/Friday reload structured like a typical sportsbook CRM offer.',
    category: 'reload',
    cta: 'Use Friday reload',
    expires: hoursFromNow(36),
    eligibility: 'Existing funded accounts',
    terms: ['One reload per Friday.', 'Minimum deposit $25.', 'Promo expires in 7 days.'],
    image: '/images/hero-basketball.jpg',
    accent: '#ff8a3d',
  },
  {
    id: 'ipl',
    title: 'IPL: six-hit boosts every over',
    eyebrow: 'Cricket',
    description: 'Live six-hit prices improved by up to 20% whenever Mumbai or RCB bat.',
    longCopy: 'A sport-specific live offer. Prices are simulated and update with the live engine.',
    category: 'sport',
    cta: 'Open IPL live',
    expires: hoursFromNow(12),
    eligibility: 'Live cricket markets only',
    terms: ['Applies to selected six-hit selections.', 'Max $20 at boosted price.'],
    image: '/images/hero-cricket.jpg',
    accent: '#3dd6ff',
  },
  {
    id: 'refer',
    title: 'Refer a friend — $30 each',
    eyebrow: 'Referral',
    description: 'Share your demo code. When they verify and place a first bet, you both receive $30 promo.',
    longCopy: 'Referral economics are simulated. No real people are contacted from this prototype.',
    category: 'referral',
    cta: 'Copy referral code',
    expires: hoursFromNow(720),
    eligibility: 'Verified referrer + new referred account',
    terms: ['Code: ALEX-7K2Q.', 'Friend must be 18+ and new to Nexora.', 'Reward issued after first settled bet.'],
    image: '/images/promo-bg.jpg',
    accent: '#b56bff',
  },
];

export const casinoGames: CasinoGame[] = [
  { id: 'neon-hold', name: 'Neon Hold', category: 'slots', studio: 'Aether Works', rtp: '96.4%', volatility: 'High', image: '/images/promo-bg.jpg', badge: 'Hot', popular: true },
  { id: 'emerald-reels', name: 'Emerald Reels', category: 'slots', studio: 'Northline', rtp: '96.1%', volatility: 'Medium', image: '/images/hero-football.jpg', popular: true },
  { id: 'midnight-jack', name: 'Midnight Jack', category: 'slots', studio: 'Kite Studio', rtp: '95.8%', volatility: 'High', image: '/images/hero-mma.jpg', fresh: true },
  { id: 'lotus-lines', name: 'Lotus Lines', category: 'slots', studio: 'Northline', rtp: '96.7%', volatility: 'Low', image: '/images/hero-cricket.jpg' },
  { id: 'voltage', name: 'Voltage 243', category: 'slots', studio: 'Aether Works', rtp: '96.2%', volatility: 'Medium', image: '/images/hero-f1.jpg', popular: true },
  { id: 'bj-vip', name: 'Blackjack VIP', category: 'blackjack', studio: 'Nexora Live', rtp: '99.5%', volatility: 'Low', image: '/images/hero-casino.jpg', badge: 'VIP', popular: true },
  { id: 'bj-speed', name: 'Speed Blackjack', category: 'blackjack', studio: 'Nexora Live', rtp: '99.4%', volatility: 'Low', image: '/images/hero-casino.jpg', fresh: true },
  { id: 'euro-roulette', name: 'European Roulette', category: 'roulette', studio: 'Nexora Live', rtp: '97.3%', volatility: 'Medium', image: '/images/hero-casino.jpg', popular: true },
  { id: 'lightning-wheel', name: 'Lightning Wheel', category: 'roulette', studio: 'Nexora Live', rtp: '97.0%', volatility: 'High', image: '/images/promo-bg.jpg', badge: 'Boost' },
  { id: 'live-auto', name: 'Auto Roulette Nord', category: 'live', studio: 'Nexora Live', rtp: '97.3%', volatility: 'Medium', image: '/images/hero-casino.jpg', popular: true },
  { id: 'live-bj', name: 'Salon Privé Blackjack', category: 'live', studio: 'Nexora Live', rtp: '99.5%', volatility: 'Low', image: '/images/hero-casino.jpg' },
  { id: 'crash-orbit', name: 'Orbit Crash', category: 'crash', studio: 'Aether Works', rtp: '97.0%', volatility: 'High', image: '/images/hero-f1.jpg', badge: 'Live', popular: true, fresh: true },
  { id: 'crash-pulse', name: 'Pulse X', category: 'crash', studio: 'Kite Studio', rtp: '97.2%', volatility: 'High', image: '/images/promo-bg.jpg' },
  { id: 'show-cash', name: 'Cash Chamber', category: 'game-show', studio: 'Nexora Live', rtp: '96.0%', volatility: 'High', image: '/images/hero-mma.jpg', fresh: true },
  { id: 'show-wheel', name: 'Green Wheel Live', category: 'game-show', studio: 'Nexora Live', rtp: '96.4%', volatility: 'Medium', image: '/images/hero-casino.jpg' },
];

export const weeklyBoard: LeaderboardRow[] = [
  { rank: 1, userId: 'lb1', name: 'Maya Chen', handle: 'maya.edge', points: 2480, wins: 19, bets: 34, roi: 28.4, streak: 6, avatar: 'MC' },
  { rank: 2, userId: 'lb2', name: 'Jonah Blake', handle: 'jblake', points: 2310, wins: 16, bets: 29, roi: 24.1, streak: 4, avatar: 'JB' },
  { rank: 3, userId: 'u_alex', name: 'Alex Moreau', handle: 'alexm', points: 2144, wins: 14, bets: 31, roi: 18.6, streak: 3, avatar: 'AM' },
  { rank: 4, userId: 'lb4', name: 'Sofia Rahman', handle: 'sofiar', points: 1988, wins: 18, bets: 40, roi: 12.2, streak: 2, avatar: 'SR' },
  { rank: 5, userId: 'lb5', name: 'Diego Alves', handle: 'dalves', points: 1870, wins: 11, bets: 22, roi: 21.0, streak: 5, avatar: 'DA' },
  { rank: 6, userId: 'lb6', name: 'Nora Lind', handle: 'noral', points: 1764, wins: 13, bets: 28, roi: 9.4, streak: 1, avatar: 'NL' },
  { rank: 7, userId: 'lb7', name: 'Kai Ito', handle: 'kaiito', points: 1640, wins: 15, bets: 37, roi: 7.8, streak: 0, avatar: 'KI' },
  { rank: 8, userId: 'lb8', name: 'Amelia Hart', handle: 'ahart', points: 1512, wins: 9, bets: 19, roi: 16.5, streak: 2, avatar: 'AH' },
  { rank: 9, userId: 'lb9', name: 'Omar Farouk', handle: 'omar.f', points: 1420, wins: 12, bets: 30, roi: 6.1, streak: 1, avatar: 'OF' },
  { rank: 10, userId: 'lb10', name: 'Elena Voss', handle: 'evoss', points: 1295, wins: 10, bets: 26, roi: 4.8, streak: 0, avatar: 'EV' },
];

export const monthlyBoard: LeaderboardRow[] = weeklyBoard
  .map((row, i) => ({
    ...row,
    rank: i + 1,
    points: row.points + 4200 - i * 180,
    bets: row.bets + 40,
    wins: row.wins + 18,
    roi: +(row.roi * 0.72).toFixed(1),
  }))
  .sort((a, b) => b.points - a.points)
  .map((row, i) => ({ ...row, rank: i + 1 }));

export const adminAlerts: AdminAlert[] = [
  { id: 'al1', severity: 'critical', title: 'Withdrawal queue aging', body: '4 withdrawals older than 12 hours. Review AML notes on WD-22910.', time: hoursFromNow(-1) },
  { id: 'al2', severity: 'warn', title: 'Live market latency', body: 'Football feed delay 1.8s on EPL. Trading desk notified.', time: hoursFromNow(-0.4) },
  { id: 'al3', severity: 'info', title: 'UFC 318 prices published', body: 'Main card markets are live. Liability capped at $25k demo.', time: hoursFromNow(-3) },
  { id: 'al4', severity: 'warn', title: 'RG trigger', body: 'User u_alex hit 80% of daily loss limit. Reality check queued.', time: hoursFromNow(-2) },
];

export const helpTopics = [
  { id: 'getting-started', title: 'Getting started', body: 'Create an account, verify your age, and explore markets with demo funds. Nothing here places a real-money wager.' },
  { id: 'odds', title: 'How odds work', body: 'Nexora displays decimal odds by default. Switch to American or fractional in account settings. Potential return = stake × decimal odds.' },
  { id: 'slip', title: 'Using the betting slip', body: 'Click any price to add it. Build singles, accumulators, or system bets. Odds changes are flagged before you confirm.' },
  { id: 'live', title: 'Live betting', body: 'In-play markets can suspend when a scoring chance develops. The prototype simulates this with brief locks and price ticks.' },
  { id: 'settlement', title: 'Settlement', body: 'Bets settle on the official result of the listed competition. Dead-heat, void and push rules follow standard sportsbook practice.' },
  { id: 'payments', title: 'Deposits & withdrawals', body: 'All payment flows are simulated. Demo deposits credit instantly; demo withdrawals enter a pending queue.' },
  { id: 'kyc', title: 'Identity checks', body: 'A licensed operator would verify name, date of birth, address and source of funds. This prototype walks through that UX only.' },
  { id: 'rg', title: 'Responsible gambling', body: 'Set deposit, loss and session limits. Use cooling-off or self-exclusion if you need a hard stop. Help resources are listed on the RG page.' },
];

export const legalBlocks = {
  about: {
    title: 'About Nexora',
    lead: 'Nexora is a premium sportsbook prototype — a complete product surface for browsing markets, building slips, and managing a demo wallet.',
    body: [
      'It is designed to feel like a regulated operator: clear prices, visible responsible-gambling tools, KYC states, and an internal control room.',
      'No real-money wagering is available. Balances, payouts, licensing marks and payment rails are simulated for product demonstration only.',
      'The stack is component-based and typed so a real odds feed, wallet ledger and KYC vendor can replace the mock layer later.',
    ],
  },
  terms: {
    title: 'Terms of use',
    lead: 'These terms govern use of the Nexora demonstration website.',
    body: [
      'Nexora is a software prototype. It does not accept real-money bets and is not a licensed gambling operator.',
      'You must be 18 or over (21+ where that is the legal age) to create a demo account.',
      'Demo balances have no cash value and cannot be withdrawn to a real bank account.',
      'Do not treat simulated results as advice or as a prediction of sporting outcomes.',
      'We may reset demo data, odds or accounts at any time.',
    ],
  },
  privacy: {
    title: 'Privacy notice',
    lead: 'This prototype stores a small amount of data in your browser so the demo can remember your session.',
    body: [
      'Account, slip, wallet and preference state is saved to localStorage on this device.',
      'No identity documents are uploaded to a server. KYC file pickers are visual only.',
      'If this product were launched for real, a full privacy policy, lawful basis and retention schedule would be published here.',
      'You can clear local demo data from Account → Security → Reset demo data.',
    ],
  },
  licensing: {
    title: 'Licensing & jurisdiction',
    lead: 'Nexora is not licensed by any gambling regulator.',
    body: [
      'Any seal, licence number or “regulated by” statement on this site is a placeholder for how a live operator would present that information.',
      'A production sportsbook would display the issuing authority, licence number, and a link to the public register.',
      'Do not use this website to place real wagers. If you want to bet, use a licensed operator in your jurisdiction.',
    ],
  },
};

export const rgResources = [
  { name: 'GamCare', href: 'https://www.gamcare.org.uk', note: 'Advice and support in Great Britain' },
  { name: 'BeGambleAware', href: 'https://www.begambleaware.org', note: 'National information and helpline' },
  { name: 'Gamblers Anonymous', href: 'https://www.gamblersanonymous.org.uk', note: 'Peer support meetings' },
  { name: 'NCPG (US)', href: 'https://www.ncpgambling.org', note: '1-800-GAMBLER and US resources' },
  { name: 'Gambling Therapy', href: 'https://www.gamblingtherapy.org', note: 'Global support in multiple languages' },
];
