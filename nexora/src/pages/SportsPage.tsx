import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { sports, leaguesOf } from '../data/catalog';
import { api } from '../lib/api';
import type { EventItem, SportId } from '../types';
import { EventCard } from '../components/betting/EventCard';
import { EmptyState } from '../components/ui/Primitives';

const sportItems = [{ id: 'all', label: 'All Sports' }, ...sports.map((s) => ({ id: s.id, label: s.name }))];

export function SportsPage() {
  const { sportId } = useParams();
  const [params, setParams] = useSearchParams();
  const sport = (sportId as SportId | undefined) ?? (params.get('sport') as SportId | null) ?? 'all';
  const league = params.get('league') ?? '';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<'all' | EventItem['status']>('all');
  const [sort, setSort] = useState<'time' | 'league'>('time');
  const [day, setDay] = useState<'any' | 'today' | 'tomorrow'>('any');

  const list = useMemo(() => {
    let items = api.events({
      sport: sport === 'all' ? 'all' : (sport as SportId),
      league: league || undefined,
      q: q || undefined,
    });
    if (status !== 'all') items = items.filter((e) => e.status === status);
    if (day !== 'any') {
      const target = new Date();
      if (day === 'tomorrow') target.setDate(target.getDate() + 1);
      items = items.filter((e) => {
        const d = new Date(e.startTime);
        return d.getDate() === target.getDate() && d.getMonth() === target.getMonth();
      });
    }
    if (sort === 'league') items = [...items].sort((a, b) => a.leagueId.localeCompare(b.leagueId));
    return items;
  }, [sport, league, q, status, sort, day]);

  const leagueOpts = sport === 'all' ? [] : leaguesOf(sport as SportId);

  return (
    <div className="page">
      <div className="wide flex gap-20">
        <aside className="sidebar">
          <div className="kicker" style={{ padding: '0 12px 8px' }}>
            Sports
          </div>
          {sportItems.map((s) => (
            <Link key={s.id} to={s.id === 'all' ? '/sports' : `/sports/${s.id}`} className={`side-link ${sport === s.id ? 'on' : ''}`}>
              {s.label}
            </Link>
          ))}
        </aside>
        <div style={{ flex: 1 }} className="col gap-16">
          <div>
            <div className="kicker">Sportsbook</div>
            <h1 style={{ marginTop: 6 }}>{sport === 'all' ? 'All sports' : sports.find((s) => s.id === sport)?.name}</h1>
            <p className="muted">Featured competitions, live matches, and upcoming cards with multiple markets.</p>
          </div>
          <div className="hscroll">
            {sportItems.map((s) => (
              <Link key={s.id} to={s.id === 'all' ? '/sports' : `/sports/${s.id}`} className={`sport-chip ${sport === s.id ? 'on' : ''}`}>
                {s.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-10 wrap">
            <input className="input" style={{ maxWidth: 280 }} placeholder="Search teams or venues" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="select" style={{ maxWidth: 200 }} value={league} onChange={(e) => setParams(e.target.value ? { league: e.target.value } : {})}>
              <option value="">All leagues</option>
              {leagueOpts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select className="select" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">Any status</option>
              <option value="live">Live</option>
              <option value="upcoming">Upcoming</option>
              <option value="finished">Finished</option>
            </select>
            <select className="select" style={{ maxWidth: 160 }} value={day} onChange={(e) => setDay(e.target.value as typeof day)}>
              <option value="any">Any date</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
            </select>
            <select className="select" style={{ maxWidth: 160 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="time">Sort by time</option>
              <option value="league">Sort by league</option>
            </select>
          </div>
          {list.length ? list.map((e) => <EventCard key={e.id} event={e} />) : <EmptyState title="No events" body="Try another sport, league or date filter." />}
        </div>
      </div>
    </div>
  );
}
