import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { colorMoves, penaltyMoves, pvpGames, pvpRules, rpsMoves } from '../data/pvp';
import { currency } from '../lib/format';
import { useAuth } from '../store/authStore';
import { usePvp } from '../store/pvpStore';
import { useUi } from '../store/uiStore';
import { Button, EmptyState } from '../components/ui/Primitives';

export function GameRoomPage() {
  const { roomId = '' } = useParams();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const room = usePvp((s) => s.rooms.find((r) => r.id === roomId));
  const fillBots = usePvp((s) => s.fillBots);
  const play = usePvp((s) => s.play);
  const leave = usePvp((s) => s.leave);
  const toast = useUi((s) => s.pushToast);

  useEffect(() => {
    if (room?.status === 'open') {
      const t = window.setTimeout(() => fillBots(room.id), 700);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [room?.status, room?.id, fillBots]);

  if (!room) {
    return (
      <div className="page">
        <div className="container">
          <EmptyState title="Table not found" body="That room has closed." action={<Link to="/games">Back to games</Link>} />
        </div>
      </div>
    );
  }

  const rules = pvpRules[room.mode];
  const game = pvpGames.find((g) => g.kind === room.kind);
  const you = room.seats.find((s) => s.id === user?.id);
  const winner = room.seats.find((s) => s.id === room.winnerId);

  const moves =
    room.kind === 'rps' ? rpsMoves : room.kind === 'penalty' ? penaltyMoves : room.kind === 'color' ? colorMoves : [];

  return (
    <div className="page">
      <div className="container col gap-16">
        <div>
          <Link to="/games" className="muted">
            ← All tables
          </Link>
          <div className="kicker" style={{ marginTop: 10 }}>
            {room.mode === 'duo' ? '2 players' : '3 players'} · {currency(rules.entry)} to sit
          </div>
          <h1>
            {game?.name} · {room.title}
          </h1>
          <p className="muted">
            Pot {currency(rules.pot)} · winner {currency(rules.winner)} · owner {currency(rules.owner)} · losers ₹0
          </p>
        </div>

        <div className="grid-3">
          {room.seats.map((s) => (
            <div key={s.id} className="card card-pad">
              <div className="badge">{s.you ? 'You' : s.bot ? 'Demo player' : 'Player'}</div>
              <h3 style={{ marginTop: 8 }}>{s.name}</h3>
              <div className="faint">@{s.handle}</div>
              {s.move ? <div className="mono" style={{ marginTop: 8 }}>Move: {s.move}</div> : null}
              {room.winnerId === s.id ? <div className="badge badge-ok" style={{ marginTop: 8 }}>Winner {currency(rules.winner)}</div> : null}
              {room.status === 'settled' && room.winnerId !== s.id ? (
                <div className="badge" style={{ marginTop: 8 }}>
                  ₹0
                </div>
              ) : null}
            </div>
          ))}
          {Array.from({ length: Math.max(0, rules.seats - room.seats.length) }).map((_, i) => (
            <div key={i} className="card card-pad muted">
              Waiting for a player…
            </div>
          ))}
        </div>

        {room.status === 'open' ? (
          <div className="card card-pad col gap-10">
            <strong>Waiting for the table to fill.</strong>
            <p className="muted">Demo players sit automatically. Leave now and the ₹{rules.entry} entry is refunded.</p>
            <div className="flex gap-8 wrap">
              <Button onClick={() => fillBots(room.id)}>Fill empty seats</Button>
              <Button
                variant="danger"
                onClick={() => {
                  leave(room.id);
                  nav('/games');
                }}
              >
                Leave & refund
              </Button>
            </div>
          </div>
        ) : null}

        {room.status === 'playing' && you ? (
          <div className="card card-pad col gap-12">
            <h2>Your move</h2>
            {room.kind === 'dice' ? (
              <Button
                variant="primary"
                onClick={() => {
                  const res = play(room.id, 'roll');
                  if (!res.ok) toast('error', res.error || 'Could not roll');
                }}
              >
                Roll the dice
              </Button>
            ) : room.kind === 'spin' ? (
              <Button
                variant="primary"
                onClick={() => {
                  const res = play(room.id, 'spin');
                  if (!res.ok) toast('error', res.error || 'Could not spin');
                }}
              >
                Spin the wheel
              </Button>
            ) : (
              <div className="flex gap-8 wrap">
                {moves.map((m) => (
                  <Button
                    key={m.id}
                    variant="primary"
                    onClick={() => {
                      const res = play(room.id, m.id);
                      if (!res.ok) toast('error', res.error || 'Could not play');
                    }}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {room.status === 'settled' ? (
          <div className="card card-pad col gap-10">
            <div className="kicker">Settled</div>
            <h2>{winner?.you ? `You won ${currency(rules.winner)}` : `${winner?.name ?? 'Winner'} takes ${currency(rules.winner)}`}</h2>
            <p className="muted">{room.resultNote}</p>
            <Link to="/games" className="btn btn-primary">
              Play another table
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
