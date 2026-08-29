import { useEffect, useMemo, useState } from 'react';
import { sports } from '../data/catalog';
import { liveEvents } from '../data/events';
import type { SportId } from '../types';
import { EventCard } from '../components/betting/EventCard';
import { EmptyState, PillNav, StatCard } from '../components/ui/Primitives';

export function LivePage() {
  const [sport, setSport] = useState<'all' | SportId>('all');
  const [v, setV] = useState(0);
  useEffect(() => {
    const onTick = () => setV(Date.now());
    window.addEventListener('nexora-tick', onTick);
    return () => window.removeEventListener('nexora-tick', onTick);
  }, []);
  const list = useMemo(() => {
    const items = liveEvents();
    return sport === 'all' ? items : items.filter((e) => e.sportId === sport);
  }, [sport, v]);

  return (
    <div className="page">
      <div className="wide col gap-16">
        <div>
          <div className="kicker">In-play</div>
          <h1 style={{ marginTop: 6 }}>Live betting</h1>
          <p className="muted">Scores, clocks and prices tick on a simulated feed so a real odds API can slot in later.</p>
        </div>
        <div className="grid-4">
          <StatCard label="Live events" value={String(liveEvents().length)} />
          <StatCard label="Open markets" value={String(liveEvents().reduce((n, e) => n + e.markets.length, 0))} />
          <StatCard label="Feed" value="Simulated" hint="3.2s tick" />
          <StatCard label="Watch live" value={String(liveEvents().filter((e) => e.watchLive).length)} />
        </div>
        <PillNav
          value={sport}
          onChange={(id) => setSport(id as typeof sport)}
          items={[{ id: 'all', label: 'All live' }, ...sports.map((s) => ({ id: s.id, label: s.name }))]}
        />
        {list.length ? (
          <div className="col gap-12">
            {list.map((e) => (
              <div key={e.id} className="col gap-8">
                {e.momentum != null ? (
                  <div>
                    <div className="between muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      <span>Away momentum</span>
                      <span>Home momentum</span>
                    </div>
                    <div className="momentum">
                      <i style={{ width: `${50 + e.momentum * 40}%` }} />
                    </div>
                  </div>
                ) : null}
                <EventCard event={e} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No live matches" body="Nothing is in-play for this sport right now." />
        )}
      </div>
    </div>
  );
}
