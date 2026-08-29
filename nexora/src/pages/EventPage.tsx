import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Radio, Star } from 'lucide-react';
import { leagueById, sportById, teamById } from '../data/catalog';
import { eventById } from '../data/events';
import { clockLabel, formatKickoff } from '../lib/format';
import { useFavorites } from '../store/favoritesStore';
import { Badge, EmptyState, Tabs } from '../components/ui/Primitives';
import { OddsButton } from '../components/betting/OddsButton';
import { TeamCrest } from '../components/betting/TeamCrest';

export function EventPage() {
  const { eventId = '' } = useParams();
  const event = eventById(eventId);
  const [tab, setTab] = useState('markets');
  const [, setTick] = useState(0);
  useEffect(() => {
    const onTick = () => setTick(Date.now());
    window.addEventListener('nexora-tick', onTick);
    return () => window.removeEventListener('nexora-tick', onTick);
  }, []);
  const fav = useFavorites((s) => s.events.includes(eventId));
  const toggle = useFavorites((s) => s.toggle);

  if (!event) {
    return (
      <div className="page">
        <div className="container">
          <EmptyState title="Event not found" body="That fixture is not in the demo board." action={<Link to="/sports">Back to sports</Link>} />
        </div>
      </div>
    );
  }

  const home = teamById[event.homeId];
  const away = teamById[event.awayId];
  const league = leagueById[event.leagueId];
  const sport = sportById[event.sportId];

  return (
    <div className="page">
      <div className="wide col gap-16">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              background: `linear-gradient(180deg, rgba(5,8,15,0.2), var(--surface)), url(${heroFor(event.sportId)}) center/cover`,
              padding: '28px 22px 18px',
            }}
          >
            <div className="between wrap gap-10">
              <div className="center gap-8">
                {event.status === 'live' ? <Badge tone="live">Live</Badge> : <Badge tone="soon">{formatKickoff(event.startTime)}</Badge>}
                <span className="muted">
                  {sport?.name} · {league?.name}
                </span>
              </div>
              <button type="button" className="icon-btn" onClick={() => toggle(event.id)} aria-label="Favorite">
                <Star size={16} fill={fav ? 'var(--gold)' : 'none'} color={fav ? 'var(--gold)' : 'currentColor'} />
              </button>
            </div>
            <div className="grid-3" style={{ alignItems: 'center', marginTop: 22, textAlign: 'center' }}>
              <div className="col gap-8" style={{ alignItems: 'center' }}>
                <TeamCrest team={home} size={72} />
                <h2>{home?.name}</h2>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 48, fontWeight: 700 }}>
                  {event.homeScore ?? '–'} <span className="faint">:</span> {event.awayScore ?? '–'}
                </div>
                <div className="muted">{event.status === 'live' ? clockLabel(event.minute, event.period) : formatKickoff(event.startTime)}</div>
                {event.watchLive && event.status === 'live' ? (
                  <div className="center gap-8" style={{ justifyContent: 'center', marginTop: 8, color: 'var(--live)' }}>
                    <Radio size={14} /> Watch Live
                  </div>
                ) : null}
              </div>
              <div className="col gap-8" style={{ alignItems: 'center' }}>
                <TeamCrest team={away} size={72} />
                <h2>{away?.name}</h2>
              </div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { id: 'markets', label: 'Markets' },
                { id: 'timeline', label: 'Timeline' },
                { id: 'stats', label: 'Statistics' },
                { id: 'h2h', label: 'H2H & form' },
                { id: 'lineups', label: 'Lineups' },
              ]}
            />
          </div>
        </div>

        {tab === 'markets' ? (
          <div className="col gap-12">
            {event.markets.map((m) => (
              <section key={m.id} className="card card-pad col gap-10">
                <div className="between">
                  <h3>{m.name}</h3>
                  <span className="badge">{m.type.replaceAll('_', ' ')}</span>
                </div>
                <div className="grid-3">
                  {m.selections.map((sel) => (
                    <div key={sel.id} className="odd-col">
                      <span>{sel.label}</span>
                      <OddsButton event={event} market={m} selection={sel} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {tab === 'timeline' ? (
          <div className="card card-pad col gap-10">
            {(event.timeline ?? []).length ? (
              event.timeline!.map((t, i) => (
                <div key={i} className="between">
                  <span className="mono">{t.minute}′</span>
                  <span>
                    {t.label} · {t.team}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No timeline events yet. Kick-off updates appear here when the match is live.</p>
            )}
          </div>
        ) : null}

        {tab === 'stats' ? (
          <div className="card card-pad col gap-16">
            {(event.stats ?? []).map((s) => {
              const total = s.home + s.away || 1;
              return (
                <div key={s.label}>
                  <div className="between muted">
                    <span>{s.home}</span>
                    <span>{s.label}</span>
                    <span>{s.away}</span>
                  </div>
                  <div className="momentum" style={{ marginTop: 6 }}>
                    <i style={{ width: `${(s.home / total) * 100}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              );
            })}
            {!event.stats?.length ? <p className="muted">Statistics unlock after first whistle.</p> : null}
          </div>
        ) : null}

        {tab === 'h2h' ? (
          <div className="grid-2">
            <div className="card card-pad">
              <h3>Form</h3>
              <div className="between" style={{ marginTop: 12 }}>
                <FormRow name={home?.shortName ?? 'Home'} form={event.form?.home} />
                <FormRow name={away?.shortName ?? 'Away'} form={event.form?.away} />
              </div>
            </div>
            <div className="card card-pad col gap-8">
              <h3>Head to head</h3>
              {(event.h2h ?? []).map((h) => (
                <div key={h.date} className="between">
                  <span className="muted">{h.date}</span>
                  <span>
                    {h.home} {h.hs}–{h.as} {h.away}
                  </span>
                </div>
              ))}
              {!event.h2h?.length ? <p className="muted">No recent meetings in the demo set.</p> : null}
            </div>
          </div>
        ) : null}

        {tab === 'lineups' ? (
          <div className="card card-pad">
            <p className="muted">
              Lineups are shown when a competition provides them. For this prototype, treat the listed goalscorer and
              player-prop markets as the available participant set.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FormRow({ name, form }: { name: string; form?: Array<'W' | 'D' | 'L'> }) {
  return (
    <div>
      <strong>{name}</strong>
      <div className="flex gap-6" style={{ marginTop: 8 }}>
        {(form ?? []).map((f, i) => (
          <span
            key={i}
            className="badge"
            style={{
              color: f === 'W' ? 'var(--accent)' : f === 'L' ? 'var(--danger)' : 'var(--gold)',
            }}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

function heroFor(sport: string) {
  if (sport === 'cricket') return '/images/hero-cricket.jpg';
  if (sport === 'tennis') return '/images/hero-tennis.jpg';
  if (sport === 'basketball') return '/images/hero-basketball.jpg';
  if (sport === 'mma' || sport === 'boxing') return '/images/hero-mma.jpg';
  if (sport === 'f1') return '/images/hero-f1.jpg';
  return '/images/hero-football.jpg';
}
