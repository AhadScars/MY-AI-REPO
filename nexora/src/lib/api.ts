import { events, eventById, liveEvents, upcomingEvents, finishedEvents } from '../data/events';
import { leagues, sports, teams, players, teamById, leagueById } from '../data/catalog';
import { promotions, casinoGames, weeklyBoard, monthlyBoard, helpTopics } from '../data/content';
import type { EventItem, SportId } from '../types';

export const api = {
  sports: () => sports,
  leagues: () => leagues,
  teams: () => teams,
  players: () => players,
  events: (filter?: { sport?: SportId | 'all'; league?: string; status?: EventItem['status']; q?: string }) => {
    let list = [...events];
    if (filter?.sport && filter.sport !== 'all') list = list.filter((e) => e.sportId === filter.sport);
    if (filter?.league) list = list.filter((e) => e.leagueId === filter.league);
    if (filter?.status) list = list.filter((e) => e.status === filter.status);
    if (filter?.q) {
      const q = filter.q.toLowerCase();
      list = list.filter((e) => {
        const home = teamById[e.homeId];
        const away = teamById[e.awayId];
        const league = leagueById[e.leagueId];
        return [home?.name, away?.name, league?.name, e.venue, e.city].some((v) => v?.toLowerCase().includes(q));
      });
    }
    return list.sort((a, b) => {
      const rank = (s: EventItem['status']) => (s === 'live' ? 0 : s === 'upcoming' ? 1 : 2);
      const d = rank(a.status) - rank(b.status);
      if (d !== 0) return d;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  },
  event: (id: string) => eventById(id) ?? null,
  live: () => liveEvents(),
  upcoming: () => upcomingEvents(),
  results: () => finishedEvents(),
  promotions: () => promotions,
  casino: () => casinoGames,
  leaderboard: (period: 'weekly' | 'monthly') => (period === 'weekly' ? weeklyBoard : monthlyBoard),
  help: () => helpTopics,
  search: (q: string) => {
    const query = q.trim().toLowerCase();
    if (!query) return { teams: [], players: [], leagues: [], events: [], sports: [] };
    return {
      sports: sports.filter((s) => s.name.toLowerCase().includes(query)),
      teams: teams.filter((t) => t.name.toLowerCase().includes(query) || t.abbr.toLowerCase().includes(query)),
      players: players.filter((p) => p.name.toLowerCase().includes(query)),
      leagues: leagues.filter((l) => l.name.toLowerCase().includes(query)),
      events: events
        .filter((e) => {
          const home = teamById[e.homeId];
          const away = teamById[e.awayId];
          return `${home?.name} ${away?.name} ${leagueById[e.leagueId]?.name}`.toLowerCase().includes(query);
        })
        .slice(0, 8),
    };
  },
};

export type SearchResult = ReturnType<typeof api.search>;
