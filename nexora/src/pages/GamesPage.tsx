import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { pvpGames, pvpRules } from '../data/pvp';
import { currency } from '../lib/format';
import { useAuth } from '../store/authStore';
import { usePvp } from '../store/pvpStore';
import { useUi } from '../store/uiStore';
import { Button } from '../components/ui/Primitives';
import type { PvpGameKind, PvpMode } from '../types';

export function GamesPage() {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const rooms = usePvp((s) => s.rooms);
  const create = usePvp((s) => s.create);
  const join = usePvp((s) => s.join);
  const toast = useUi((s) => s.pushToast);

  const start = (kind: PvpGameKind, mode: PvpMode) => {
    if (!user) {
      nav('/login', { state: { from: '/games' } });
      toast('info', 'Sign in to play', 'Use alex@nexora.demo / demo1234');
      return;
    }
    const res = create(kind, mode);
    if (!res.ok || !res.id) {
      toast('error', 'Could not sit down', res.error);
      return;
    }
    nav(`/games/${res.id}`);
  };

  const sit = (roomId: string) => {
    if (!user) {
      nav('/login', { state: { from: '/games' } });
      return;
    }
    const res = join(roomId);
    if (!res.ok) toast('error', 'Table closed', res.error);
    else nav(`/games/${roomId}`);
  };

  const open = rooms.filter((r) => r.status === 'open' || r.status === 'playing');
  const done = rooms.filter((r) => r.status === 'settled').slice(0, 6);

  return (
    <div className="page">
      <div className="wide col gap-20">
        <section className="card card-pad">
          <div className="kicker">Player vs player · INR</div>
          <h1 style={{ marginTop: 8 }}>Bet each other, not the house line.</h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            Two sit for ₹15 each. Three sit for ₹17 each. Only one winner is paid. The rest get nothing. Nexora keeps
            the table fee.
          </p>
          <div className="grid-2" style={{ marginTop: 18 }}>
            <article className="card card-pad">
              <div className="center gap-8">
                <Users size={16} />
                <strong>2 players</strong>
              </div>
              <ul className="muted" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                <li>Join cost {currency(pvpRules.duo.entry)} each</li>
                <li>Table pot {currency(pvpRules.duo.pot)}</li>
                <li>Winner {currency(pvpRules.duo.winner)}</li>
                <li>Loser ₹0</li>
                <li>Owner {currency(pvpRules.duo.owner)}</li>
              </ul>
            </article>
            <article className="card card-pad">
              <div className="center gap-8">
                <Users size={16} />
                <strong>3 players</strong>
              </div>
              <ul className="muted" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                <li>Join cost {currency(pvpRules.trio.entry)} each</li>
                <li>Table pot {currency(pvpRules.trio.pot)}</li>
                <li>Only one winner {currency(pvpRules.trio.winner)}</li>
                <li>Other two ₹0</li>
                <li>Owner {currency(pvpRules.trio.owner)}</li>
              </ul>
            </article>
          </div>
        </section>

        <section>
          <h2>Open a table</h2>
          <div className="grid-3" style={{ marginTop: 12 }}>
            {pvpGames.map((g) => (
              <article key={g.kind} className="card card-pad col gap-10">
                <div className="kicker">{g.modes.includes('duo') && g.modes.includes('trio') ? '2 or 3 players' : g.modes[0] === 'duo' ? '2 players' : '3 players'}</div>
                <h3>{g.name}</h3>
                <p className="muted">{g.blurb}</p>
                <div className="flex gap-8 wrap">
                  {g.modes.map((mode) => (
                    <Button key={mode} variant="primary" onClick={() => start(g.kind, mode)}>
                      {mode === 'duo' ? `Play 2P · ${currency(pvpRules.duo.entry)}` : `Play 3P · ${currency(pvpRules.trio.entry)}`}
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {open.length ? (
          <section className="col gap-10">
            <h2>Live tables</h2>
            {open.map((r) => {
              const rules = pvpRules[r.mode];
              return (
                <div key={r.id} className="card card-pad between wrap gap-12">
                  <div>
                    <strong>
                      {r.title} · {pvpGames.find((g) => g.kind === r.kind)?.name}
                    </strong>
                    <div className="muted">
                      {r.seats.length}/{rules.seats} seated · entry {currency(rules.entry)} · winner {currency(rules.winner)}
                    </div>
                    <div className="muted">{r.seats.map((s) => s.name).join(' · ')}</div>
                  </div>
                  {r.status === 'open' ? (
                    <Button onClick={() => sit(r.id)}>Join {currency(rules.entry)}</Button>
                  ) : (
                    <Button onClick={() => nav(`/games/${r.id}`)}>Watch / play</Button>
                  )}
                </div>
              );
            })}
          </section>
        ) : null}

        {done.length ? (
          <section className="col gap-10">
            <h2>Recent results</h2>
            {done.map((r) => (
              <div key={r.id} className="card card-pad">
                <strong>{r.resultNote}</strong>
                <div className="faint">{r.seats.map((s) => s.name).join(' vs ')}</div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
