import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { casinoGames } from '../data/content';
import { Button, EmptyState } from '../components/ui/Primitives';
import { useUi } from '../store/uiStore';

export function CasinoGamePage() {
  const { gameId = '' } = useParams();
  const game = casinoGames.find((g) => g.id === gameId);
  const [credits, setCredits] = useState(1000);
  const [msg, setMsg] = useState('Demo credits only. Nothing here can be cashed out.');
  const [busy, setBusy] = useState(false);
  const [reels, setReels] = useState(['7', '◆', 'A']);
  const [mult, setMult] = useState(1);
  const [crashed, setCrashed] = useState(false);
  const toast = useUi((s) => s.pushToast);

  const play = async () => {
    if (credits < 10) {
      toast('error', 'Out of demo credits');
      return;
    }
    setBusy(true);
    setCredits((c) => c - 10);
    if (game?.category === 'crash') {
      setCrashed(false);
      let m = 1;
      const target = 1 + Math.random() * 4;
      await new Promise<void>((resolve) => {
        const id = window.setInterval(() => {
          m += 0.08;
          setMult(+m.toFixed(2));
          if (m >= target) {
            window.clearInterval(id);
            setCrashed(true);
            resolve();
          }
        }, 80);
      });
      setMsg(`Crashed at ${target.toFixed(2)}x. Demo round complete.`);
    } else if (game?.category === 'blackjack') {
      const player = 16 + Math.floor(Math.random() * 8);
      const dealer = 16 + Math.floor(Math.random() * 8);
      const win = player <= 21 && (dealer > 21 || player > dealer);
      if (win) setCredits((c) => c + 20);
      setMsg(`You ${player} · Dealer ${dealer} · ${win ? 'Win' : 'Lose'} (demo)`);
    } else if (game?.category === 'roulette') {
      const n = Math.floor(Math.random() * 37);
      const win = n % 2 === 0 && n !== 0;
      if (win) setCredits((c) => c + 20);
      setMsg(`Ball landed on ${n}. ${win ? 'Even hits.' : 'No even.'} Demo only.`);
    } else {
      const symbols = ['7', '◆', 'A', 'K', '★'];
      const next = [0, 1, 2].map(() => symbols[Math.floor(Math.random() * symbols.length)]);
      setReels(next);
      const win = next[0] === next[1] && next[1] === next[2];
      if (win) setCredits((c) => c + 80);
      setMsg(win ? 'Three of a kind. +80 demo credits.' : 'No line. Try again.');
    }
    setBusy(false);
  };

  const cashout = () => {
    if (crashed) return;
    const win = Math.floor(10 * mult);
    setCredits((c) => c + win);
    setCrashed(true);
    setMsg(`Cashed out at ${mult.toFixed(2)}x for ${win} demo credits.`);
  };

  const related = useMemo(() => casinoGames.filter((g) => g.id !== gameId).slice(0, 3), [gameId]);

  if (!game) {
    return (
      <div className="page">
        <div className="container">
          <EmptyState title="Game unavailable" body="That title is not in the demo lobby." action={<Link to="/casino">Back to casino</Link>} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="wide grid-2">
        <section className="card" style={{ minHeight: 420, overflow: 'hidden' }}>
          <img src={game.image} alt="" style={{ height: 180, width: '100%', objectFit: 'cover' }} />
          <div className="card-pad col gap-16">
            <div className="between">
              <h2>{game.name}</h2>
              <span className="badge">{game.category}</span>
            </div>
            <div className="mono" style={{ fontSize: 42, textAlign: 'center' }}>
              {game.category === 'crash' ? `${mult.toFixed(2)}x` : reels.join('  ')}
            </div>
            <p className="muted" style={{ textAlign: 'center' }}>
              {msg}
            </p>
            <div className="flex gap-10">
              <Button variant="primary" onClick={play} disabled={busy}>
                Play 10 credits
              </Button>
              {game.category === 'crash' ? (
                <Button onClick={cashout} disabled={busy || crashed}>
                  Cash out
                </Button>
              ) : null}
            </div>
            <strong>Demo credits: {credits}</strong>
          </div>
        </section>
        <aside className="col gap-12">
          <div className="card card-pad">
            <h3>About this table</h3>
            <p className="muted">
              {game.studio} · published RTP {game.rtp} · {game.volatility} volatility. Outcomes are random client-side
              draws for illustration.
            </p>
          </div>
          {related.map((g) => (
            <Link key={g.id} to={`/casino/${g.id}`} className="card card-pad">
              {g.name}
              <div className="faint">{g.category}</div>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
