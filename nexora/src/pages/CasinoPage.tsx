import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { casinoGames } from '../data/content';
import { EmptyState, PillNav } from '../components/ui/Primitives';

const cats = [
  { id: 'all', label: 'All' },
  { id: 'slots', label: 'Slots' },
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'roulette', label: 'Roulette' },
  { id: 'live', label: 'Live Casino' },
  { id: 'crash', label: 'Crash' },
  { id: 'game-show', label: 'Game shows' },
];

export function CasinoPage() {
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'all' | 'popular' | 'new'>('all');
  const list = useMemo(() => {
    return casinoGames.filter((g) => {
      if (cat !== 'all' && g.category !== cat) return false;
      if (view === 'popular' && !g.popular) return false;
      if (view === 'new' && !g.fresh) return false;
      if (q && !g.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [cat, q, view]);

  return (
    <div className="page">
      <div className="wide col gap-16">
        <section className="hero" style={{ minHeight: 280 }}>
          <img className="cover" src="/images/hero-casino.jpg" alt="" />
          <div className="hero-copy">
            <span className="badge">Demo lobby</span>
            <h1>Casino. Visual only.</h1>
            <p className="muted">Slots, tables and crash-style games with play-money interactions. No real-money casino.</p>
          </div>
        </section>
        <div className="flex gap-10 wrap">
          <input className="input" style={{ maxWidth: 280 }} placeholder="Search games" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ maxWidth: 180 }} value={view} onChange={(e) => setView(e.target.value as typeof view)}>
            <option value="all">All games</option>
            <option value="popular">Popular</option>
            <option value="new">New</option>
          </select>
        </div>
        <PillNav value={cat} onChange={setCat} items={cats} />
        {list.length ? (
          <div className="grid-4">
            {list.map((g) => (
              <Link key={g.id} to={`/casino/${g.id}`} className="card game-card">
                <div className="thumb">
                  <img src={g.image} alt="" />
                </div>
                <div className="card-pad">
                  <div className="between">
                    <strong>{g.name}</strong>
                    {g.badge ? <span className="badge badge-soon">{g.badge}</span> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {g.studio} · RTP {g.rtp} · {g.volatility}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No games" body="Try another category or search term." />
        )}
      </div>
    </div>
  );
}
