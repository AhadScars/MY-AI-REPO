import type { EventItem, EventStatus, Market, MarketType, Selection, SportId } from '../types';
import { hoursFromNow, minutesFromNow } from '../lib/format';

function sel(
  eventId: string,
  marketId: string,
  key: string,
  label: string,
  odds: number,
  line?: number,
): Selection {
  return { id: `${marketId}_${key}`, marketId, eventId, label, odds, line };
}

function market(
  eventId: string,
  type: MarketType,
  name: string,
  rows: Array<[string, string, number, number?]>,
): Market {
  const id = `${eventId}_${type}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  return {
    id,
    eventId,
    type,
    name,
    selections: rows.map(([key, label, odds, line]) => sel(eventId, id, key, label, odds, line)),
  };
}

function footballMarkets(id: string, home: string, away: string, h: number, d: number, a: number): Market[] {
  const tot = 2.5;
  return [
    market(id, 'winner', 'Match Winner', [
      ['h', home, h],
      ['d', 'Draw', d],
      ['a', away, a],
    ]),
    market(id, 'handicap', 'Asian Handicap', [
      ['h', `${home} -0.5`, +(h * 0.92).toFixed(2), -0.5],
      ['a', `${away} +0.5`, +(a * 1.18).toFixed(2), 0.5],
    ]),
    market(id, 'over_under', 'Total Goals', [
      ['o', `Over ${tot}`, 1.87, tot],
      ['u', `Under ${tot}`, 1.97, tot],
    ]),
    market(id, 'btts', 'Both Teams to Score', [
      ['y', 'Yes', 1.72],
      ['n', 'No', 2.1],
    ]),
    market(id, 'ht_result', 'Half-Time Result', [
      ['h', home, +(h * 1.55).toFixed(2)],
      ['d', 'Draw', 2.2],
      ['a', away, +(a * 1.6).toFixed(2)],
    ]),
    market(id, 'correct_score', 'Correct Score', [
      ['10', '1-0', 7.5],
      ['20', '2-0', 9.0],
      ['21', '2-1', 8.5],
      ['00', '0-0', 9.5],
      ['11', '1-1', 6.5],
      ['22', '2-2', 12],
      ['01', '0-1', 9.0],
      ['02', '0-2', 13],
      ['12', '1-2', 10],
    ]),
    market(id, 'scorer', 'Anytime Goalscorer', [
      ['p1', 'Star forward (Home)', 2.2],
      ['p2', 'Star forward (Away)', 2.6],
      ['p3', 'Home midfielder', 3.4],
      ['p4', 'No goalscorer', 9.5],
    ]),
    market(id, 'special', 'Specials', [
      ['win_btts', `${home} & BTTS`, +(h * 1.85).toFixed(2)],
      ['clean', `${home} clean sheet`, 2.9],
      ['htft', `${home} / ${home}`, +(h * 1.45).toFixed(2)],
    ]),
  ];
}

function twoWay(id: string, home: string, away: string, h: number, a: number, extra: Market[] = []): Market[] {
  return [
    market(id, 'winner', 'Winner', [
      ['h', home, h],
      ['a', away, a],
    ]),
    ...extra,
  ];
}

function ev(partial: Omit<EventItem, 'markets'> & { markets: Market[] }): EventItem {
  return partial;
}

export const events: EventItem[] = [
  ev({
    id: 'epl_ars_liv',
    sportId: 'football',
    leagueId: 'epl',
    homeId: 'ars',
    awayId: 'liv',
    startTime: minutesFromNow(-64),
    status: 'live',
    minute: 64,
    period: "2H 64'",
    homeScore: 1,
    awayScore: 1,
    featured: true,
    trending: true,
    venue: 'Emirates Stadium',
    city: 'London',
    watchLive: true,
    momentum: 0.12,
    markets: footballMarkets('epl_ars_liv', 'Arsenal', 'Liverpool', 2.15, 3.4, 3.35),
    timeline: [
      { minute: 18, type: 'goal', team: 'home', label: 'Saka 18′' },
      { minute: 41, type: 'card', team: 'away', label: 'Mac Allister yellow' },
      { minute: 57, type: 'goal', team: 'away', label: 'Salah 57′' },
    ],
    stats: [
      { label: 'Possession', home: 58, away: 42 },
      { label: 'Shots', home: 12, away: 9 },
      { label: 'On target', home: 5, away: 4 },
      { label: 'xG', home: 1.42, away: 1.18 },
      { label: 'Corners', home: 6, away: 3 },
    ],
    form: { home: ['W', 'W', 'D', 'W', 'W'], away: ['W', 'W', 'W', 'D', 'L'] },
    h2h: [
      { date: '2026-04-12', home: 'Liverpool', away: 'Arsenal', hs: 2, as: 1 },
      { date: '2025-12-21', home: 'Arsenal', away: 'Liverpool', hs: 1, as: 1 },
      { date: '2025-05-04', home: 'Liverpool', away: 'Arsenal', hs: 1, as: 2 },
    ],
  }),
  ev({
    id: 'epl_mci_che',
    sportId: 'football',
    leagueId: 'epl',
    homeId: 'mci',
    awayId: 'che',
    startTime: minutesFromNow(-23),
    status: 'live',
    minute: 23,
    period: "1H 23'",
    homeScore: 0,
    awayScore: 1,
    featured: true,
    trending: true,
    venue: 'Etihad Stadium',
    city: 'Manchester',
    watchLive: true,
    momentum: -0.28,
    markets: footballMarkets('epl_mci_che', 'Man City', 'Chelsea', 1.72, 3.9, 4.6),
    timeline: [{ minute: 11, type: 'goal', team: 'away', label: 'Palmer 11′' }],
    stats: [
      { label: 'Possession', home: 67, away: 33 },
      { label: 'Shots', home: 6, away: 3 },
      { label: 'On target', home: 1, away: 2 },
      { label: 'xG', home: 0.61, away: 0.48 },
    ],
    form: { home: ['W', 'W', 'W', 'D', 'W'], away: ['W', 'D', 'W', 'W', 'L'] },
  }),
  ev({
    id: 'ucl_rma_bay',
    sportId: 'football',
    leagueId: 'ucl',
    homeId: 'rma',
    awayId: 'bay',
    startTime: hoursFromNow(5.5),
    status: 'upcoming',
    featured: true,
    trending: true,
    venue: 'Santiago Bernabéu',
    city: 'Madrid',
    watchLive: true,
    markets: footballMarkets('ucl_rma_bay', 'Real Madrid', 'Bayern', 2.05, 3.6, 3.45),
    form: { home: ['W', 'W', 'W', 'D', 'W'], away: ['W', 'W', 'L', 'W', 'W'] },
    h2h: [
      { date: '2024-05-08', home: 'Real Madrid', away: 'Bayern', hs: 2, as: 1 },
      { date: '2024-04-30', home: 'Bayern', away: 'Real Madrid', hs: 2, as: 2 },
    ],
  }),
  ev({
    id: 'laliga_bar_atm',
    sportId: 'football',
    leagueId: 'laliga',
    homeId: 'bar',
    awayId: 'atm',
    startTime: hoursFromNow(28),
    status: 'upcoming',
    featured: true,
    venue: 'Spotify Camp Nou',
    city: 'Barcelona',
    markets: footballMarkets('laliga_bar_atm', 'Barcelona', 'Atletico', 1.78, 3.75, 4.4),
    form: { home: ['W', 'W', 'W', 'W', 'D'], away: ['D', 'W', 'W', 'L', 'W'] },
  }),
  ev({
    id: 'epl_tot_mun',
    sportId: 'football',
    leagueId: 'epl',
    homeId: 'tot',
    awayId: 'mun',
    startTime: hoursFromNow(3),
    status: 'upcoming',
    featured: true,
    venue: 'Tottenham Hotspur Stadium',
    city: 'London',
    markets: footballMarkets('epl_tot_mun', 'Spurs', 'Man United', 2.4, 3.45, 2.9),
    form: { home: ['W', 'L', 'W', 'D', 'W'], away: ['D', 'W', 'L', 'W', 'D'] },
  }),
  ev({
    id: 'epl_new_avl',
    sportId: 'football',
    leagueId: 'epl',
    homeId: 'new',
    awayId: 'avl',
    startTime: hoursFromNow(26),
    status: 'upcoming',
    venue: 'St James’ Park',
    city: 'Newcastle',
    markets: footballMarkets('epl_new_avl', 'Newcastle', 'Aston Villa', 1.95, 3.55, 3.85),
  }),
  ev({
    id: 'epl_bha_whu',
    sportId: 'football',
    leagueId: 'epl',
    homeId: 'bha',
    awayId: 'whu',
    startTime: hoursFromNow(50),
    status: 'upcoming',
    venue: 'Amex Stadium',
    city: 'Brighton',
    markets: footballMarkets('epl_bha_whu', 'Brighton', 'West Ham', 1.88, 3.6, 4.1),
  }),
  ev({
    id: 'epl_ful_cry',
    sportId: 'football',
    leagueId: 'epl',
    homeId: 'ful',
    awayId: 'cry',
    startTime: hoursFromNow(-6),
    status: 'finished',
    homeScore: 2,
    awayScore: 0,
    period: 'FT',
    venue: 'Craven Cottage',
    city: 'London',
    markets: footballMarkets('epl_ful_cry', 'Fulham', 'Palace', 2.2, 3.3, 3.4),
  }),
  ev({
    id: 'ucl_int_psg',
    sportId: 'football',
    leagueId: 'ucl',
    homeId: 'int',
    awayId: 'psg',
    startTime: hoursFromNow(29.5),
    status: 'upcoming',
    featured: true,
    venue: 'San Siro',
    city: 'Milan',
    markets: footballMarkets('ucl_int_psg', 'Inter', 'PSG', 2.7, 3.4, 2.55),
  }),
  ev({
    id: 'ucl_bvb_juv',
    sportId: 'football',
    leagueId: 'ucl',
    homeId: 'bvb',
    awayId: 'juv',
    startTime: minutesFromNow(-78),
    status: 'live',
    minute: 78,
    period: "2H 78'",
    homeScore: 2,
    awayScore: 2,
    trending: true,
    venue: 'Signal Iduna Park',
    city: 'Dortmund',
    watchLive: true,
    momentum: 0.05,
    markets: footballMarkets('ucl_bvb_juv', 'Dortmund', 'Juventus', 2.25, 3.5, 3.15),
    timeline: [
      { minute: 9, type: 'goal', team: 'home', label: 'Guirassy 9′' },
      { minute: 33, type: 'goal', team: 'away', label: 'Vlahović 33′' },
      { minute: 61, type: 'goal', team: 'home', label: 'Adeyemi 61′' },
      { minute: 70, type: 'goal', team: 'away', label: 'Yıldız 70′' },
    ],
    stats: [
      { label: 'Possession', home: 54, away: 46 },
      { label: 'Shots', home: 14, away: 11 },
      { label: 'On target', home: 6, away: 5 },
    ],
  }),
  ev({
    id: 'nfl_kc_sf',
    sportId: 'football',
    leagueId: 'nfl',
    homeId: 'kc',
    awayId: 'sf',
    startTime: hoursFromNow(54),
    status: 'upcoming',
    featured: true,
    venue: 'Arrowhead Stadium',
    city: 'Kansas City',
    markets: [
      ...twoWay('nfl_kc_sf', 'Chiefs', '49ers', 1.83, 2.02, [
        market('nfl_kc_sf', 'handicap', 'Spread', [
          ['h', 'Chiefs -2.5', 1.91, -2.5],
          ['a', '49ers +2.5', 1.91, 2.5],
        ]),
        market('nfl_kc_sf', 'over_under', 'Total Points', [
          ['o', 'Over 47.5', 1.9, 47.5],
          ['u', 'Under 47.5', 1.9, 47.5],
        ]),
        market('nfl_kc_sf', 'player_prop', 'Player Props', [
          ['p1', 'Mahomes over 274.5 pass yds', 1.87],
          ['p2', 'Purdy over 1.5 pass TDs', 1.8],
        ]),
      ]),
    ],
  }),
  ev({
    id: 'nfl_buf_phi',
    sportId: 'football',
    leagueId: 'nfl',
    homeId: 'buf',
    awayId: 'phi',
    startTime: hoursFromNow(56),
    status: 'upcoming',
    venue: 'Highmark Stadium',
    city: 'Orchard Park',
    markets: twoWay('nfl_buf_phi', 'Bills', 'Eagles', 1.95, 1.88, [
      market('nfl_buf_phi', 'handicap', 'Spread', [
        ['h', 'Bills -1.5', 1.91, -1.5],
        ['a', 'Eagles +1.5', 1.91, 1.5],
      ]),
      market('nfl_buf_phi', 'over_under', 'Total Points', [
        ['o', 'Over 46.5', 1.91, 46.5],
        ['u', 'Under 46.5', 1.91, 46.5],
      ]),
    ]),
  }),

  ev({
    id: 'ipl_mi_csk',
    sportId: 'cricket',
    leagueId: 'ipl',
    homeId: 'mi',
    awayId: 'csk',
    startTime: minutesFromNow(-48),
    status: 'live',
    period: 'MI 148/4 · 16.2',
    homeScore: 148,
    awayScore: 4,
    featured: true,
    trending: true,
    venue: 'Wankhede Stadium',
    city: 'Mumbai',
    watchLive: true,
    momentum: 0.22,
    markets: [
      ...twoWay('ipl_mi_csk', 'Mumbai Indians', 'Chennai Super Kings', 1.74, 2.12, [
        market('ipl_mi_csk', 'over_under', 'Mumbai Runs', [
          ['o', 'Over 189.5', 1.86, 189.5],
          ['u', 'Under 189.5', 1.96, 189.5],
        ]),
        market('ipl_mi_csk', 'player_prop', 'Top Batter', [
          ['p1', 'Rohit Sharma', 4.5],
          ['p2', 'Suryakumar Yadav', 3.8],
          ['p3', 'Ruturaj Gaikwad', 4.2],
        ]),
        market('ipl_mi_csk', 'special', 'Method of Dismissal next', [
          ['c', 'Caught', 1.72],
          ['b', 'Bowled', 4.3],
          ['lbw', 'LBW', 6.0],
        ]),
      ]),
    ],
    stats: [
      { label: 'Run rate', home: 9.1, away: 0 },
      { label: 'Boundaries', home: 16, away: 0 },
      { label: 'Dots', home: 38, away: 0 },
    ],
  }),
  ev({
    id: 'ipl_rcb_kkr',
    sportId: 'cricket',
    leagueId: 'ipl',
    homeId: 'rcb',
    awayId: 'kkr',
    startTime: hoursFromNow(8),
    status: 'upcoming',
    featured: true,
    venue: 'M. Chinnaswamy Stadium',
    city: 'Bengaluru',
    markets: twoWay('ipl_rcb_kkr', 'RCB', 'KKR', 1.9, 1.92, [
      market('ipl_rcb_kkr', 'over_under', 'Match Sixes', [
        ['o', 'Over 16.5', 1.84, 16.5],
        ['u', 'Under 16.5', 1.98, 16.5],
      ]),
      market('ipl_rcb_kkr', 'player_prop', 'Most Sixes', [
        ['p1', 'Virat Kohli', 3.4],
        ['p2', 'Andre Russell', 3.1],
        ['p3', 'Rajat Patidar', 5.5],
      ]),
    ]),
  }),
  ev({
    id: 'int_ind_aus',
    sportId: 'cricket',
    leagueId: 'intc',
    homeId: 'ind',
    awayId: 'aus',
    startTime: hoursFromNow(22),
    status: 'upcoming',
    featured: true,
    venue: 'Narendra Modi Stadium',
    city: 'Ahmedabad',
    markets: twoWay('int_ind_aus', 'India', 'Australia', 1.68, 2.2, [
      market('int_ind_aus', 'over_under', '1st Innings Runs', [
        ['o', 'Over 312.5', 1.9, 312.5],
        ['u', 'Under 312.5', 1.9, 312.5],
      ]),
      market('int_ind_aus', 'special', 'Toss Winner', [
        ['h', 'India', 1.91],
        ['a', 'Australia', 1.91],
      ]),
    ]),
  }),
  ev({
    id: 'int_eng_sa',
    sportId: 'cricket',
    leagueId: 'intc',
    homeId: 'eng',
    awayId: 'sa',
    startTime: hoursFromNow(-20),
    status: 'finished',
    period: 'SA won by 4 wkts',
    homeScore: 287,
    awayScore: 289,
    venue: "Lord's",
    city: 'London',
    markets: twoWay('int_eng_sa', 'England', 'South Africa', 1.82, 2.02),
  }),

  ev({
    id: 'nba_bos_den',
    sportId: 'basketball',
    leagueId: 'nba',
    homeId: 'bos',
    awayId: 'den',
    startTime: minutesFromNow(-92),
    status: 'live',
    period: 'Q3 4:12',
    homeScore: 78,
    awayScore: 74,
    featured: true,
    trending: true,
    venue: 'TD Garden',
    city: 'Boston',
    watchLive: true,
    momentum: 0.18,
    markets: twoWay('nba_bos_den', 'Celtics', 'Nuggets', 1.74, 2.12, [
      market('nba_bos_den', 'handicap', 'Spread', [
        ['h', 'Celtics -3.5', 1.91, -3.5],
        ['a', 'Nuggets +3.5', 1.91, 3.5],
      ]),
      market('nba_bos_den', 'over_under', 'Total Points', [
        ['o', 'Over 224.5', 1.9, 224.5],
        ['u', 'Under 224.5', 1.9, 224.5],
      ]),
      market('nba_bos_den', 'player_prop', 'Player Points', [
        ['p1', 'Tatum over 27.5', 1.87],
        ['p2', 'Jokić over 26.5', 1.83],
        ['p3', 'Jokić over 9.5 assists', 1.8],
      ]),
    ]),
    stats: [
      { label: 'FG%', home: 48, away: 46 },
      { label: '3PT', home: 11, away: 9 },
      { label: 'Rebounds', home: 31, away: 34 },
      { label: 'Turnovers', home: 8, away: 10 },
    ],
  }),
  ev({
    id: 'nba_lal_gsw',
    sportId: 'basketball',
    leagueId: 'nba',
    homeId: 'lal',
    awayId: 'gsw',
    startTime: hoursFromNow(7.5),
    status: 'upcoming',
    featured: true,
    venue: 'Crypto.com Arena',
    city: 'Los Angeles',
    markets: twoWay('nba_lal_gsw', 'Lakers', 'Warriors', 1.88, 1.95, [
      market('nba_lal_gsw', 'handicap', 'Spread', [
        ['h', 'Lakers -1.5', 1.91, -1.5],
        ['a', 'Warriors +1.5', 1.91, 1.5],
      ]),
      market('nba_lal_gsw', 'over_under', 'Total Points', [
        ['o', 'Over 228.5', 1.9, 228.5],
        ['u', 'Under 228.5', 1.9, 228.5],
      ]),
    ]),
  }),
  ev({
    id: 'nba_nyk_mia',
    sportId: 'basketball',
    leagueId: 'nba',
    homeId: 'nyk',
    awayId: 'mia',
    startTime: hoursFromNow(31),
    status: 'upcoming',
    venue: 'Madison Square Garden',
    city: 'New York',
    markets: twoWay('nba_nyk_mia', 'Knicks', 'Heat', 1.7, 2.18, [
      market('nba_nyk_mia', 'handicap', 'Spread', [
        ['h', 'Knicks -4.5', 1.91, -4.5],
        ['a', 'Heat +4.5', 1.91, 4.5],
      ]),
    ]),
  }),
  ev({
    id: 'nba_dal_mil',
    sportId: 'basketball',
    leagueId: 'nba',
    homeId: 'dal',
    awayId: 'mil',
    startTime: hoursFromNow(-18),
    status: 'finished',
    period: 'Final',
    homeScore: 118,
    awayScore: 112,
    venue: 'American Airlines Center',
    city: 'Dallas',
    markets: twoWay('nba_dal_mil', 'Mavericks', 'Bucks', 1.8, 2.05),
  }),

  ev({
    id: 'atp_sin_alc',
    sportId: 'tennis',
    leagueId: 'atp',
    homeId: 'sinner',
    awayId: 'alcaraz',
    startTime: minutesFromNow(-54),
    status: 'live',
    period: 'Set 3 · 4-3',
    homeScore: 1,
    awayScore: 1,
    homeScore2: 4,
    awayScore2: 3,
    featured: true,
    trending: true,
    venue: 'Arthur Ashe Stadium',
    city: 'New York',
    watchLive: true,
    momentum: 0.08,
    markets: twoWay('atp_sin_alc', 'Sinner', 'Alcaraz', 1.78, 2.08, [
      market('atp_sin_alc', 'handicap', 'Games Handicap', [
        ['h', 'Sinner -2.5', 1.95, -2.5],
        ['a', 'Alcaraz +2.5', 1.87, 2.5],
      ]),
      market('atp_sin_alc', 'over_under', 'Total Games', [
        ['o', 'Over 38.5', 1.9, 38.5],
        ['u', 'Under 38.5', 1.9, 38.5],
      ]),
      market('atp_sin_alc', 'special', 'Set Betting', [
        ['21', 'Sinner 2-1', 3.4],
        ['12', 'Alcaraz 2-1', 3.8],
        ['20', 'Sinner 2-0', 3.1],
        ['02', 'Alcaraz 2-0', 4.2],
      ]),
    ]),
    stats: [
      { label: 'Aces', home: 8, away: 6 },
      { label: '1st serve %', home: 69, away: 64 },
      { label: 'Winners', home: 28, away: 31 },
      { label: 'UE', home: 17, away: 19 },
    ],
  }),
  ev({
    id: 'atp_djo_sin2',
    sportId: 'tennis',
    leagueId: 'atp',
    homeId: 'djokovic',
    awayId: 'sinner',
    startTime: hoursFromNow(26),
    status: 'upcoming',
    featured: true,
    venue: 'Arthur Ashe Stadium',
    city: 'New York',
    markets: twoWay('atp_djo_sin2', 'Djokovic', 'Sinner', 2.45, 1.58, [
      market('atp_djo_sin2', 'over_under', 'Total Sets', [
        ['o', 'Over 3.5', 2.15, 3.5],
        ['u', 'Under 3.5', 1.7, 3.5],
      ]),
    ]),
  }),
  ev({
    id: 'wta_iga_gau',
    sportId: 'tennis',
    leagueId: 'wta',
    homeId: 'swiatek',
    awayId: 'gauff',
    startTime: hoursFromNow(4),
    status: 'upcoming',
    featured: true,
    venue: 'Louis Armstrong Stadium',
    city: 'New York',
    markets: twoWay('wta_iga_gau', 'Świątek', 'Gauff', 1.55, 2.5, [
      market('wta_iga_gau', 'handicap', 'Games Handicap', [
        ['h', 'Świątek -3.5', 1.91, -3.5],
        ['a', 'Gauff +3.5', 1.91, 3.5],
      ]),
    ]),
  }),
  ev({
    id: 'wta_sab_iga',
    sportId: 'tennis',
    leagueId: 'wta',
    homeId: 'sabalenka',
    awayId: 'swiatek',
    startTime: hoursFromNow(-10),
    status: 'finished',
    period: '2-1',
    homeScore: 2,
    awayScore: 1,
    venue: 'Arthur Ashe Stadium',
    city: 'New York',
    markets: twoWay('wta_sab_iga', 'Sabalenka', 'Świątek', 1.95, 1.88),
  }),

  ev({
    id: 'mlb_nyy_lad',
    sportId: 'baseball',
    leagueId: 'mlb',
    homeId: 'nyy',
    awayId: 'lad',
    startTime: minutesFromNow(-110),
    status: 'live',
    period: 'Bot 6',
    homeScore: 3,
    awayScore: 4,
    featured: true,
    venue: 'Yankee Stadium',
    city: 'New York',
    watchLive: true,
    momentum: -0.1,
    markets: twoWay('mlb_nyy_lad', 'Yankees', 'Dodgers', 1.86, 1.97, [
      market('mlb_nyy_lad', 'handicap', 'Run Line', [
        ['h', 'Yankees -1.5', 2.35, -1.5],
        ['a', 'Dodgers +1.5', 1.61, 1.5],
      ]),
      market('mlb_nyy_lad', 'over_under', 'Total Runs', [
        ['o', 'Over 8.5', 1.87, 8.5],
        ['u', 'Under 8.5', 1.95, 8.5],
      ]),
    ]),
  }),
  ev({
    id: 'mlb_atl_hou',
    sportId: 'baseball',
    leagueId: 'mlb',
    homeId: 'atlmlb',
    awayId: 'hou',
    startTime: hoursFromNow(20),
    status: 'upcoming',
    venue: 'Truist Park',
    city: 'Atlanta',
    markets: twoWay('mlb_atl_hou', 'Braves', 'Astros', 1.74, 2.12, [
      market('mlb_atl_hou', 'over_under', 'Total Runs', [
        ['o', 'Over 8.0', 1.9, 8],
        ['u', 'Under 8.0', 1.9, 8],
      ]),
    ]),
  }),

  ev({
    id: 'nhl_edm_fla',
    sportId: 'hockey',
    leagueId: 'nhl',
    homeId: 'edm',
    awayId: 'fla',
    startTime: minutesFromNow(-38),
    status: 'live',
    period: 'P2 11:04',
    homeScore: 2,
    awayScore: 1,
    featured: true,
    venue: 'Rogers Place',
    city: 'Edmonton',
    watchLive: true,
    momentum: 0.3,
    markets: twoWay('nhl_edm_fla', 'Oilers', 'Panthers', 1.8, 2.05, [
      market('nhl_edm_fla', 'handicap', 'Puck Line', [
        ['h', 'Oilers -1.5', 2.4, -1.5],
        ['a', 'Panthers +1.5', 1.58, 1.5],
      ]),
      market('nhl_edm_fla', 'over_under', 'Total Goals', [
        ['o', 'Over 6.5', 1.91, 6.5],
        ['u', 'Under 6.5', 1.91, 6.5],
      ]),
    ]),
    stats: [
      { label: 'Shots', home: 22, away: 18 },
      { label: 'Hits', home: 14, away: 19 },
      { label: 'FO%', home: 54, away: 46 },
    ],
  }),
  ev({
    id: 'nhl_col_tor',
    sportId: 'hockey',
    leagueId: 'nhl',
    homeId: 'col',
    awayId: 'tor',
    startTime: hoursFromNow(30),
    status: 'upcoming',
    venue: 'Ball Arena',
    city: 'Denver',
    markets: twoWay('nhl_col_tor', 'Avalanche', 'Maple Leafs', 1.76, 2.1, [
      market('nhl_col_tor', 'over_under', 'Total Goals', [
        ['o', 'Over 6.5', 1.87, 6.5],
        ['u', 'Under 6.5', 1.95, 6.5],
      ]),
    ]),
  }),

  ev({
    id: 'box_usyk_fury',
    sportId: 'boxing',
    leagueId: 'boxing',
    homeId: 'usyk',
    awayId: 'fury',
    startTime: hoursFromNow(76),
    status: 'upcoming',
    featured: true,
    trending: true,
    venue: 'Wembley Stadium',
    city: 'London',
    markets: twoWay('box_usyk_fury', 'Usyk', 'Fury', 1.72, 2.15, [
      market('box_usyk_fury', 'special', 'Method of Victory', [
        ['ud', 'Usyk on points', 2.6],
        ['uko', 'Usyk KO/TKO', 4.4],
        ['fd', 'Fury on points', 3.2],
        ['fko', 'Fury KO/TKO', 5.0],
        ['draw', 'Draw', 21],
      ]),
      market('box_usyk_fury', 'over_under', 'Total Rounds', [
        ['o', 'Over 10.5', 1.7, 10.5],
        ['u', 'Under 10.5', 2.15, 10.5],
      ]),
    ]),
  }),
  ev({
    id: 'box_can_ben',
    sportId: 'boxing',
    leagueId: 'boxing',
    homeId: 'canelo',
    awayId: 'benavidez',
    startTime: hoursFromNow(170),
    status: 'upcoming',
    venue: 'T-Mobile Arena',
    city: 'Las Vegas',
    markets: twoWay('box_can_ben', 'Canelo', 'Benavidez', 1.95, 1.88, [
      market('box_can_ben', 'special', 'Goes the distance', [
        ['y', 'Yes', 1.62],
        ['n', 'No', 2.25],
      ]),
    ]),
  }),

  ev({
    id: 'ufc_islam_arman',
    sportId: 'mma',
    leagueId: 'ufc',
    homeId: 'islam',
    awayId: 'arman',
    startTime: hoursFromNow(52),
    status: 'upcoming',
    featured: true,
    trending: true,
    venue: 'T-Mobile Arena',
    city: 'Las Vegas',
    markets: twoWay('ufc_islam_arman', 'Makhachev', 'Tsarukyan', 1.52, 2.6, [
      market('ufc_islam_arman', 'special', 'Method of Victory', [
        ['id', 'Islam decision', 2.7],
        ['is', 'Islam submission', 3.4],
        ['iko', 'Islam KO/TKO', 5.5],
        ['ad', 'Arman decision', 4.6],
        ['ako', 'Arman KO/TKO', 7.0],
      ]),
      market('ufc_islam_arman', 'over_under', 'Total Rounds', [
        ['o', 'Over 3.5', 1.74, 3.5],
        ['u', 'Under 3.5', 2.08, 3.5],
      ]),
    ]),
  }),
  ev({
    id: 'ufc_izy_ddp',
    sportId: 'mma',
    leagueId: 'ufc',
    homeId: 'adesanya',
    awayId: 'du',
    startTime: hoursFromNow(53.5),
    status: 'upcoming',
    featured: true,
    venue: 'T-Mobile Arena',
    city: 'Las Vegas',
    markets: twoWay('ufc_izy_ddp', 'Adesanya', 'Du Plessis', 2.2, 1.7, [
      market('ufc_izy_ddp', 'special', 'Goes the distance', [
        ['y', 'Yes', 2.05],
        ['n', 'No', 1.78],
      ]),
    ]),
  }),

  ev({
    id: 'lol_t1_geng',
    sportId: 'esports',
    leagueId: 'lol',
    homeId: 't1',
    awayId: 'geng',
    startTime: minutesFromNow(-18),
    status: 'live',
    period: 'Game 2 · 23:14',
    homeScore: 1,
    awayScore: 0,
    featured: true,
    trending: true,
    venue: 'LoL Park',
    city: 'Seoul',
    watchLive: true,
    momentum: 0.16,
    markets: twoWay('lol_t1_geng', 'T1', 'Gen.G', 1.82, 1.98, [
      market('lol_t1_geng', 'special', 'Map Handicap', [
        ['h', 'T1 -1.5', 2.55, -1.5],
        ['a', 'Gen.G +1.5', 1.52, 1.5],
      ]),
      market('lol_t1_geng', 'over_under', 'Total Maps', [
        ['o', 'Over 4.5', 1.8, 4.5],
        ['u', 'Under 4.5', 2.0, 4.5],
      ]),
    ]),
  }),
  ev({
    id: 'cs_navi_faze',
    sportId: 'esports',
    leagueId: 'cs2',
    homeId: 'navi',
    awayId: 'faze',
    startTime: hoursFromNow(6),
    status: 'upcoming',
    featured: true,
    venue: 'Royal Arena',
    city: 'Copenhagen',
    markets: twoWay('cs_navi_faze', 'NAVI', 'FaZe', 1.7, 2.15, [
      market('cs_navi_faze', 'special', 'Correct Map Score', [
        ['20', 'NAVI 2-0', 3.1],
        ['21', 'NAVI 2-1', 3.4],
        ['12', 'FaZe 2-1', 4.2],
        ['02', 'FaZe 2-0', 5.4],
      ]),
    ]),
  }),

  ev({
    id: 'f1_monza',
    sportId: 'f1',
    leagueId: 'f1',
    homeId: 'ver',
    awayId: 'nor',
    startTime: hoursFromNow(98),
    status: 'upcoming',
    featured: true,
    venue: 'Autodromo Nazionale Monza',
    city: 'Monza',
    markets: [
      market('f1_monza', 'winner', 'Race Winner', [
        ['ver', 'Verstappen', 2.4],
        ['nor', 'Norris', 3.1],
        ['pia', 'Piastri', 4.4],
        ['lec', 'Leclerc', 7.5],
        ['ham', 'Hamilton', 13],
        ['rus', 'Russell', 11],
      ]),
      market('f1_monza', 'special', 'Podium Finish', [
        ['ver', 'Verstappen', 1.28],
        ['nor', 'Norris', 1.4],
        ['pia', 'Piastri', 1.55],
        ['lec', 'Leclerc', 1.95],
      ]),
      market('f1_monza', 'special', 'Fastest Lap', [
        ['ver', 'Verstappen', 2.8],
        ['nor', 'Norris', 3.6],
        ['lec', 'Leclerc', 5.0],
      ]),
    ],
  }),
];

export function eventById(id: string) {
  return events.find((e) => e.id === id);
}

export function eventsBySport(sportId: SportId | 'all') {
  if (sportId === 'all') return events;
  return events.filter((e) => e.sportId === sportId);
}

export function liveEvents() {
  return events.filter((e) => e.status === 'live');
}

export function upcomingEvents() {
  return events.filter((e) => e.status === 'upcoming');
}

export function finishedEvents() {
  return events.filter((e) => e.status === 'finished');
}

export function featuredEvents() {
  return events.filter((e) => e.featured);
}

export function findSelection(selectionId: string) {
  for (const event of events) {
    for (const market of event.markets) {
      const found = market.selections.find((s) => s.id === selectionId);
      if (found) return { event, market, selection: found };
    }
  }
  return null;
}

export function mutateLiveTick() {
  for (const event of events) {
    if (event.status !== 'live') continue;
    if (event.minute != null && event.sportId === 'football') {
      event.minute = Math.min(94, event.minute + 1);
      event.period = event.minute <= 45 ? `1H ${event.minute}'` : `2H ${event.minute}'`;
    }
    if (event.momentum != null) {
      event.momentum = Math.max(-1, Math.min(1, event.momentum + (Math.random() - 0.5) * 0.12));
    }
    for (const market of event.markets) {
      for (const selection of market.selections) {
        if (Math.random() > 0.45) continue;
        const prev = selection.odds;
        const next = Math.max(1.01, Math.round((prev * (1 + (Math.random() * 2 - 1) * 0.028)) * 100) / 100);
        if (next !== prev) {
          selection.previousOdds = prev;
          selection.odds = next;
        }
      }
    }
    if (Math.random() < 0.04 && event.homeScore != null && event.awayScore != null) {
      if (Math.random() > 0.5) event.homeScore += 1;
      else event.awayScore += 1;
    }
  }
}

export function statusOf(event: EventItem): EventStatus {
  return event.status;
}
