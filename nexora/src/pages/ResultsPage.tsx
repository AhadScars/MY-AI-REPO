import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sports } from '../data/catalog';
import { events } from '../data/events';
import { leagueById, teamById } from '../data/catalog';
import { formatKickoff } from '../lib/format';
import { EmptyState, PillNav } from '../components/ui/Primitives';
import { TeamCrest } from '../components/betting/TeamCrest';

export function ResultsPage() {
  const [sport, setSport] = useState('all');
  const [bucket, setBucket] = useState<'today' | 'yesterday' | 'upcoming'>('today');
  const [q, setQ] = useState('');
  const [league, setLeague] = useState('');

  const list = useMemo(() => {
    const now = new Date();
    const y = new Date();
    y.setDate(now.getDate() - 1);
    return events.filter((e) => {
      const d = new Date(e.startTime);
      const same = (a: Date) => a.getDate() === d.getDate() && a.getMonth() === d.getMonth();
      if (bucket === 'today' && !(e.status === 'finished' || e.status === 'live') && !same(now)) return false;
      if (bucket === 'yesterday' && !same(y)) return false;
      if (bucket === 'upcoming' && e.status !== 'upcoming') return false;
      if (bucket === 'today' && e.status === 'upcoming' && !same(now)) return false;
      if (sport !== 'all' && e.sportId !== sport) return false;
      if (league && e.leagueId !== league) return false;
      const home = teamById[e.homeId];
      const away = teamById[e.awayId];
      if (q && !`${home?.name} ${away?.name}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [sport, bucket, q, league]);

  return (
    <div className="page">
      <div className="wide col gap-16">
        <div>
          <div className="kicker">Results centre</div>
          <h1>Scores & settlement</h1>
        </div>
        <PillNav
          value={bucket}
          onChange={(id) => setBucket(id as typeof bucket)}
          items={[
            { id: 'today', label: "Today's results" },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'upcoming', label: 'Upcoming' },
          ]}
        />
        <div className="flex gap-10 wrap">
          <select className="select" style={{ maxWidth: 180 }} value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="all">All sports</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <input className="input" style={{ maxWidth: 180 }} placeholder="League id e.g. epl" value={league} onChange={(e) => setLeague(e.target.value)} />
        </div>
        {list.length ? (
          <div className="col gap-10">
            {list.map((e) => {
              const home = teamById[e.homeId];
              const away = teamById[e.awayId];
              return (
                <Link key={e.id} to={`/event/${e.id}`} className="card card-pad between wrap gap-12">
                  <div className="center gap-12">
                    <TeamCrest team={home} />
                    <div>
                      <strong>
                        {home?.shortName} vs {away?.shortName}
                      </strong>
                      <div className="muted">
                        {leagueById[e.leagueId]?.name} · {formatKickoff(e.startTime)}
                      </div>
                    </div>
                    <TeamCrest team={away} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 22 }}>
                      {e.homeScore ?? '–'} – {e.awayScore ?? '–'}
                    </div>
                    <div className="faint">{e.period ?? e.status} · markets settled on official result</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No results" body="Nothing matches those filters." />
        )}
      </div>
    </div>
  );
}
