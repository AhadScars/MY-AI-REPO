import type { Competitor, League, Player, Sport, SportId } from '../types';

export const sports: Sport[] = [
  { id: 'football', name: 'Football', shortName: 'Football', accent: '#14f195', liveCount: 18, eventCount: 246 },
  { id: 'cricket', name: 'Cricket', shortName: 'Cricket', accent: '#3dd6ff', liveCount: 6, eventCount: 42 },
  { id: 'basketball', name: 'Basketball', shortName: 'NBA / Euro', accent: '#ff8a3d', liveCount: 11, eventCount: 98 },
  { id: 'tennis', name: 'Tennis', shortName: 'ATP / WTA', accent: '#c8ff4d', liveCount: 14, eventCount: 67 },
  { id: 'baseball', name: 'Baseball', shortName: 'MLB', accent: '#ff5a5a', liveCount: 8, eventCount: 54 },
  { id: 'hockey', name: 'Hockey', shortName: 'NHL', accent: '#7aa2ff', liveCount: 5, eventCount: 38 },
  { id: 'boxing', name: 'Boxing', shortName: 'Boxing', accent: '#ffd166', liveCount: 1, eventCount: 9 },
  { id: 'mma', name: 'MMA', shortName: 'UFC', accent: '#ff4d6a', liveCount: 2, eventCount: 16 },
  { id: 'esports', name: 'Esports', shortName: 'Esports', accent: '#b56bff', liveCount: 9, eventCount: 73 },
  { id: 'f1', name: 'Formula 1', shortName: 'F1', accent: '#ff3355', liveCount: 0, eventCount: 8 },
];

export const leagues: League[] = [
  { id: 'epl', name: 'Premier League', shortName: 'EPL', sportId: 'football', country: 'England', featured: true },
  { id: 'ucl', name: 'UEFA Champions League', shortName: 'UCL', sportId: 'football', country: 'Europe', featured: true },
  { id: 'laliga', name: 'La Liga', shortName: 'La Liga', sportId: 'football', country: 'Spain', featured: true },
  { id: 'seriea', name: 'Serie A', shortName: 'Serie A', sportId: 'football', country: 'Italy' },
  { id: 'bundes', name: 'Bundesliga', shortName: 'Bundesliga', sportId: 'football', country: 'Germany' },
  { id: 'ligue1', name: 'Ligue 1', shortName: 'Ligue 1', sportId: 'football', country: 'France' },
  { id: 'uel', name: 'UEFA Europa League', shortName: 'UEL', sportId: 'football', country: 'Europe' },
  { id: 'ipl', name: 'Indian Premier League', shortName: 'IPL', sportId: 'cricket', country: 'India', featured: true },
  { id: 'intc', name: 'International Cricket', shortName: 'INT', sportId: 'cricket', country: 'World' },
  { id: 'the100', name: 'The Hundred', shortName: '100', sportId: 'cricket', country: 'England' },
  { id: 'nba', name: 'NBA', shortName: 'NBA', sportId: 'basketball', country: 'USA', featured: true },
  { id: 'euroleague', name: 'EuroLeague', shortName: 'EuroLeague', sportId: 'basketball', country: 'Europe' },
  { id: 'atp', name: 'ATP Tour', shortName: 'ATP', sportId: 'tennis', country: 'World', featured: true },
  { id: 'wta', name: 'WTA Tour', shortName: 'WTA', sportId: 'tennis', country: 'World', featured: true },
  { id: 'mlb', name: 'MLB', shortName: 'MLB', sportId: 'baseball', country: 'USA', featured: true },
  { id: 'nhl', name: 'NHL', shortName: 'NHL', sportId: 'hockey', country: 'USA', featured: true },
  { id: 'boxing', name: 'World Championship Boxing', shortName: 'Boxing', sportId: 'boxing', country: 'World' },
  { id: 'ufc', name: 'UFC', shortName: 'UFC', sportId: 'mma', country: 'World', featured: true },
  { id: 'lol', name: 'League of Legends Worlds', shortName: 'LoL', sportId: 'esports', country: 'World' },
  { id: 'cs2', name: 'CS2 Majors', shortName: 'CS2', sportId: 'esports', country: 'World' },
  { id: 'f1', name: 'Formula 1 World Championship', shortName: 'F1', sportId: 'f1', country: 'World', featured: true },
  { id: 'nfl', name: 'NFL', shortName: 'NFL', sportId: 'football', country: 'USA', featured: true },
];

function t(
  id: string,
  name: string,
  shortName: string,
  abbr: string,
  color: string,
  secondary: string,
  sportId: SportId,
  country: string,
  rank?: number,
): Competitor {
  return { id, name, shortName, abbr, color, secondary, sportId, country, rank };
}

export const teams: Competitor[] = [
  t('ars', 'Arsenal', 'Arsenal', 'ARS', '#ef0107', '#063672', 'football', 'England', 1),
  t('liv', 'Liverpool', 'Liverpool', 'LIV', '#c8102e', '#00b2a9', 'football', 'England', 2),
  t('mci', 'Manchester City', 'Man City', 'MCI', '#6cabdd', '#1c2c5b', 'football', 'England', 3),
  t('che', 'Chelsea', 'Chelsea', 'CHE', '#034694', '#dba111', 'football', 'England', 4),
  t('tot', 'Tottenham Hotspur', 'Spurs', 'TOT', '#132257', '#ffffff', 'football', 'England', 5),
  t('mun', 'Manchester United', 'Man United', 'MUN', '#da291c', '#fbe122', 'football', 'England', 6),
  t('new', 'Newcastle United', 'Newcastle', 'NEW', '#241f20', '#ffffff', 'football', 'England', 7),
  t('avl', 'Aston Villa', 'Aston Villa', 'AVL', '#95bfe5', '#670e36', 'football', 'England', 8),
  t('bha', 'Brighton', 'Brighton', 'BHA', '#0057b8', '#ffffff', 'football', 'England', 9),
  t('whu', 'West Ham', 'West Ham', 'WHU', '#7a263a', '#1bb1e7', 'football', 'England', 10),
  t('ful', 'Fulham', 'Fulham', 'FUL', '#000000', '#ffffff', 'football', 'England', 11),
  t('cry', 'Crystal Palace', 'Palace', 'CRY', '#1b458f', '#c4122e', 'football', 'England', 12),
  t('rma', 'Real Madrid', 'Real Madrid', 'RMA', '#ffffff', '#febe10', 'football', 'Spain', 1),
  t('bar', 'Barcelona', 'Barcelona', 'BAR', '#a50044', '#004d98', 'football', 'Spain', 2),
  t('atm', 'Atletico Madrid', 'Atletico', 'ATM', '#cb3524', '#272e61', 'football', 'Spain', 3),
  t('bay', 'Bayern Munich', 'Bayern', 'BAY', '#dc052d', '#0066b2', 'football', 'Germany', 1),
  t('bvb', 'Borussia Dortmund', 'Dortmund', 'BVB', '#fde100', '#000000', 'football', 'Germany', 2),
  t('int', 'Inter', 'Inter', 'INT', '#010e80', '#000000', 'football', 'Italy', 1),
  t('juv', 'Juventus', 'Juventus', 'JUV', '#000000', '#ffffff', 'football', 'Italy', 2),
  t('psg', 'Paris Saint-Germain', 'PSG', 'PSG', '#004170', '#da291c', 'football', 'France', 1),
  t('kc', 'Kansas City Chiefs', 'Chiefs', 'KC', '#e31837', '#ffb81c', 'football', 'USA', 1),
  t('sf', 'San Francisco 49ers', '49ers', 'SF', '#aa0000', '#b3995d', 'football', 'USA', 2),
  t('buf', 'Buffalo Bills', 'Bills', 'BUF', '#00338d', '#c60c30', 'football', 'USA', 3),
  t('phi', 'Philadelphia Eagles', 'Eagles', 'PHI', '#004c54', '#a5acaf', 'football', 'USA', 4),

  t('mi', 'Mumbai Indians', 'Mumbai', 'MI', '#004ba0', '#d1ab3e', 'cricket', 'India', 1),
  t('csk', 'Chennai Super Kings', 'Chennai', 'CSK', '#f9cd05', '#0081e9', 'cricket', 'India', 2),
  t('rcb', 'Royal Challengers Bengaluru', 'RCB', 'RCB', '#da1818', '#000000', 'cricket', 'India', 3),
  t('kkr', 'Kolkata Knight Riders', 'KKR', 'KKR', '#3a225d', '#b3a123', 'cricket', 'India', 4),
  t('ind', 'India', 'India', 'IND', '#ff9933', '#138808', 'cricket', 'India', 1),
  t('aus', 'Australia', 'Australia', 'AUS', '#00843d', '#ffcd00', 'cricket', 'Australia', 2),
  t('eng', 'England', 'England', 'ENG', '#00247d', '#cf142b', 'cricket', 'England', 3),
  t('sa', 'South Africa', 'South Africa', 'SA', '#007749', '#c8a951', 'cricket', 'South Africa', 4),

  t('bos', 'Boston Celtics', 'Celtics', 'BOS', '#007a33', '#ba9653', 'basketball', 'USA', 1),
  t('den', 'Denver Nuggets', 'Nuggets', 'DEN', '#0e2240', '#fec524', 'basketball', 'USA', 2),
  t('lal', 'Los Angeles Lakers', 'Lakers', 'LAL', '#552583', '#fdb927', 'basketball', 'USA', 3),
  t('gsw', 'Golden State Warriors', 'Warriors', 'GSW', '#1d428a', '#ffc72c', 'basketball', 'USA', 4),
  t('nyk', 'New York Knicks', 'Knicks', 'NYK', '#006bb6', '#f58426', 'basketball', 'USA', 5),
  t('mia', 'Miami Heat', 'Heat', 'MIA', '#98002e', '#f9a01b', 'basketball', 'USA', 6),
  t('dal', 'Dallas Mavericks', 'Mavericks', 'DAL', '#00538c', '#002b5e', 'basketball', 'USA', 7),
  t('mil', 'Milwaukee Bucks', 'Bucks', 'MIL', '#00471b', '#eee1c6', 'basketball', 'USA', 8),

  t('sinner', 'Jannik Sinner', 'Sinner', 'SIN', '#e10600', '#111111', 'tennis', 'Italy', 1),
  t('alcaraz', 'Carlos Alcaraz', 'Alcaraz', 'ALC', '#c60b1e', '#ffc400', 'tennis', 'Spain', 2),
  t('djokovic', 'Novak Djokovic', 'Djokovic', 'DJO', '#0c4076', '#c6363c', 'tennis', 'Serbia', 3),
  t('swiatek', 'Iga Swiatek', 'Swiatek', 'IGA', '#dc143c', '#ffffff', 'tennis', 'Poland', 1),
  t('gauff', 'Coco Gauff', 'Gauff', 'GAU', '#002868', '#bf0a30', 'tennis', 'USA', 2),
  t('sabalenka', 'Aryna Sabalenka', 'Sabalenka', 'SAB', '#c8102e', '#00a3e0', 'tennis', 'Belarus', 3),

  t('nyy', 'New York Yankees', 'Yankees', 'NYY', '#003087', '#e4002c', 'baseball', 'USA', 1),
  t('lad', 'Los Angeles Dodgers', 'Dodgers', 'LAD', '#005a9c', '#ef3e42', 'baseball', 'USA', 2),
  t('atlmlb', 'Atlanta Braves', 'Braves', 'ATL', '#ce1141', '#13274f', 'baseball', 'USA', 3),
  t('hou', 'Houston Astros', 'Astros', 'HOU', '#002d62', '#eb6e1f', 'baseball', 'USA', 4),

  t('edm', 'Edmonton Oilers', 'Oilers', 'EDM', '#041e42', '#ff4c00', 'hockey', 'Canada', 1),
  t('fla', 'Florida Panthers', 'Panthers', 'FLA', '#041e42', '#c8102e', 'hockey', 'USA', 2),
  t('col', 'Colorado Avalanche', 'Avalanche', 'COL', '#6f263d', '#236192', 'hockey', 'USA', 3),
  t('tor', 'Toronto Maple Leafs', 'Maple Leafs', 'TOR', '#00205b', '#ffffff', 'hockey', 'Canada', 4),

  t('usyk', 'Oleksandr Usyk', 'Usyk', 'USY', '#0057b7', '#ffd700', 'boxing', 'Ukraine', 1),
  t('fury', 'Tyson Fury', 'Fury', 'FUR', '#012169', '#c8102e', 'boxing', 'England', 2),
  t('canelo', 'Canelo Alvarez', 'Canelo', 'CAN', '#006847', '#ce1126', 'boxing', 'Mexico', 1),
  t('benavidez', 'David Benavidez', 'Benavidez', 'BEN', '#9b2226', '#111111', 'boxing', 'USA', 2),

  t('islam', 'Islam Makhachev', 'Makhachev', 'MAK', '#0b6623', '#d4af37', 'mma', 'Russia', 1),
  t('arman', 'Arman Tsarukyan', 'Tsarukyan', 'TSA', '#1d3557', '#e63946', 'mma', 'Armenia', 2),
  t('adesanya', 'Israel Adesanya', 'Adesanya', 'IZY', '#000000', '#c5a572', 'mma', 'New Zealand', 1),
  t('du', 'Dricus du Plessis', 'Du Plessis', 'DDP', '#007749', '#000000', 'mma', 'South Africa', 2),

  t('t1', 'T1', 'T1', 'T1', '#e4002b', '#111111', 'esports', 'Korea', 1),
  t('geng', 'Gen.G', 'Gen.G', 'GEN', '#aa8a00', '#111111', 'esports', 'Korea', 2),
  t('navi', 'Natus Vincere', 'NAVI', 'NAV', '#ffe500', '#111111', 'esports', 'Ukraine', 1),
  t('faze', 'FaZe Clan', 'FaZe', 'FAZ', '#e10600', '#111111', 'esports', 'Europe', 2),

  t('ver', 'Max Verstappen', 'Verstappen', 'VER', '#1e41ff', '#ffffff', 'f1', 'Netherlands', 1),
  t('nor', 'Lando Norris', 'Norris', 'NOR', '#ff8000', '#111111', 'f1', 'England', 2),
  t('lec', 'Charles Leclerc', 'Leclerc', 'LEC', '#dc0000', '#fff200', 'f1', 'Monaco', 3),
  t('ham', 'Lewis Hamilton', 'Hamilton', 'HAM', '#dc0000', '#ffffff', 'f1', 'England', 4),
  t('pia', 'Oscar Piastri', 'Piastri', 'PIA', '#ff8000', '#111111', 'f1', 'Australia', 5),
  t('rus', 'George Russell', 'Russell', 'RUS', '#27f4d2', '#000000', 'f1', 'England', 6),
];

export const players: Player[] = [
  { id: 'saka', name: 'Bukayo Saka', teamId: 'ars', position: 'RW', number: 7 },
  { id: 'odegaard', name: 'Martin Ødegaard', teamId: 'ars', position: 'AM', number: 8 },
  { id: 'haaland', name: 'Erling Haaland', teamId: 'mci', position: 'ST', number: 9 },
  { id: 'salah', name: 'Mohamed Salah', teamId: 'liv', position: 'RW', number: 11 },
  { id: 'palmer', name: 'Cole Palmer', teamId: 'che', position: 'AM', number: 20 },
  { id: 'son', name: 'Son Heung-min', teamId: 'tot', position: 'LW', number: 7 },
  { id: 'mbappe', name: 'Kylian Mbappé', teamId: 'rma', position: 'ST', number: 9 },
  { id: 'yamal', name: 'Lamine Yamal', teamId: 'bar', position: 'RW', number: 10 },
  { id: 'vinicius', name: 'Vinícius Júnior', teamId: 'rma', position: 'LW', number: 7 },
  { id: 'kane', name: 'Harry Kane', teamId: 'bay', position: 'ST', number: 9 },
  { id: 'tatum', name: 'Jayson Tatum', teamId: 'bos', position: 'SF', number: 0 },
  { id: 'jokic', name: 'Nikola Jokić', teamId: 'den', position: 'C', number: 15 },
  { id: 'doncic', name: 'Luka Dončić', teamId: 'dal', position: 'PG', number: 77 },
  { id: 'curry', name: 'Stephen Curry', teamId: 'gsw', position: 'PG', number: 30 },
  { id: 'kohli', name: 'Virat Kohli', teamId: 'rcb', position: 'BAT', number: 18 },
  { id: 'rohit', name: 'Rohit Sharma', teamId: 'mi', position: 'BAT', number: 45 },
  { id: 'dhoni', name: 'MS Dhoni', teamId: 'csk', position: 'WK', number: 7 },
];

export const teamById = Object.fromEntries(teams.map((x) => [x.id, x]));
export const leagueById = Object.fromEntries(leagues.map((x) => [x.id, x]));
export const sportById = Object.fromEntries(sports.map((x) => [x.id, x]));
export const playerById = Object.fromEntries(players.map((x) => [x.id, x]));

export function competitorsOf(sportId: SportId) {
  return teams.filter((t) => t.sportId === sportId);
}

export function leaguesOf(sportId: SportId) {
  return leagues.filter((l) => l.sportId === sportId);
}
