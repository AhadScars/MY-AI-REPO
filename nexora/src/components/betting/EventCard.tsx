import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Radio, Star } from 'lucide-react';
import { useState } from 'react';
import type { EventItem } from '../../types';
import { leagueById, sportById, teamById } from '../../data/catalog';
import { clockLabel, formatKickoff, formatTime } from '../../lib/format';
import { useFavorites } from '../../store/favoritesStore';
import { Badge } from '../ui/Primitives';
import { OddsButton } from './OddsButton';
import { TeamCrest } from './TeamCrest';

export function EventCard({ event, compact = false }: { event: EventItem; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const home = teamById[event.homeId];
  const away = teamById[event.awayId];
  const league = leagueById[event.leagueId];
  const sport = sportById[event.sportId];
  const fav = useFavorites((s) => s.events.includes(event.id));
  const toggle = useFavorites((s) => s.toggle);
  const primary = event.markets[0];
  const more = event.markets.slice(1, 4);

  return (
    <article className="card event-card">
      <div className="event-meta">
        <span className="center gap-8">
          {event.status === 'live' ? <Badge tone="live">Live</Badge> : null}
          {event.status === 'upcoming' ? <Badge tone="soon">{formatTime(event.startTime)}</Badge> : null}
          {event.status === 'finished' ? <Badge>Final</Badge> : null}
          <span>
            {sport?.name} · {league?.shortName}
          </span>
        </span>
        <span className="center gap-8">
          {event.status === 'live' ? (
            <span className="mono" style={{ color: 'var(--live)' }}>
              {clockLabel(event.minute, event.period)}
            </span>
          ) : (
            <span>{formatKickoff(event.startTime)}</span>
          )}
          <button
            type="button"
            className="icon-btn"
            style={{ width: 32, height: 32 }}
            aria-label={fav ? 'Remove favorite' : 'Add favorite'}
            onClick={() => toggle(event.id)}
          >
            <Star size={14} fill={fav ? 'var(--gold)' : 'none'} color={fav ? 'var(--gold)' : 'currentColor'} />
          </button>
        </span>
      </div>

      <div className="between" style={{ alignItems: 'stretch', gap: 16, flexWrap: 'wrap' }}>
        <Link to={`/event/${event.id}`} className="teams" style={{ flex: '1 1 220px' }}>
          <div className="team-row">
            <TeamCrest team={home} />
            <span>{home?.name}</span>
            {event.homeScore != null ? <span className="score">{event.homeScore}</span> : null}
          </div>
          <div className="team-row">
            <TeamCrest team={away} />
            <span>{away?.name}</span>
            {event.awayScore != null ? <span className="score">{event.awayScore}</span> : null}
          </div>
          {event.venue ? (
            <div className="faint" style={{ fontSize: 12 }}>
              {event.venue}
              {event.city ? ` · ${event.city}` : ''}
            </div>
          ) : null}
        </Link>

        {primary ? (
          <div className="markets-row" style={{ flex: '1 1 280px' }}>
            {primary.selections.slice(0, 3).map((sel) => (
              <div key={sel.id} className="odd-col">
                <span>{sel.label}</span>
                <OddsButton event={event} market={primary} selection={sel} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {event.watchLive && event.status === 'live' ? (
        <div className="center gap-8 muted" style={{ fontSize: 13 }}>
          <Radio size={14} color="var(--live)" /> Watch Live · demo stream placeholder
        </div>
      ) : null}

      {more.length > 0 ? (
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? 'Hide markets' : `More markets (${event.markets.length})`}
          </button>
          {open
            ? more.map((m) => (
                <div key={m.id} className="col gap-8">
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                    {m.name}
                  </div>
                  <div className="markets-row" style={{ gridTemplateColumns: `repeat(${Math.min(m.selections.length, 4)}, minmax(0,1fr))` }}>
                    {m.selections.slice(0, 4).map((sel) => (
                      <div key={sel.id} className="odd-col">
                        <span>{sel.label}</span>
                        <OddsButton event={event} market={m} selection={sel} />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            : null}
        </>
      ) : null}
    </article>
  );
}
