import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Home, Menu, Swords, UserRound, Wallet, X } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { pvpGames } from '../../data/pvp';
import { formatRelative } from '../../lib/format';
import { useNotify } from '../../store/notifyStore';
import { useUi } from '../../store/uiStore';
import { Button } from '../ui/Primitives';
import { Brand } from '../brand/Logo';

export function BottomNav() {
  const setMenuOpen = useUi((s) => s.setMenuOpen);
  return (
    <nav className="bottom-nav" aria-label="Mobile">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'on' : '')}>
        <Home size={18} />
        Home
      </NavLink>
      <NavLink to="/games" className={({ isActive }) => (isActive ? 'on' : '')}>
        <Swords size={18} />
        Games
      </NavLink>
      <NavLink to="/wallet" className={({ isActive }) => (isActive ? 'on' : '')}>
        <Wallet size={18} />
        Wallet
      </NavLink>
      <NavLink to="/account" className={({ isActive }) => (isActive ? 'on' : '')}>
        <UserRound size={18} />
        Account
      </NavLink>
      <button type="button" onClick={() => setMenuOpen(true)}>
        <Menu size={18} />
        More
      </button>
    </nav>
  );
}

export function MobileMenu() {
  const open = useUi((s) => s.menuOpen);
  const setOpen = useUi((s) => s.setMenuOpen);
  if (!open) return null;
  return createPortal(
    <div className="drawer-back" onClick={() => setOpen(false)}>
      <aside
        className="slip-sheet"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="between" style={{ padding: 16 }}>
          <Brand />
          <button className="icon-btn" type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>
        <div className="col gap-6" style={{ padding: 16 }}>
          {[
            ['/', 'Home'],
            ['/games', 'Games'],
            ['/wallet', 'Wallet'],
            ['/account', 'Account'],
            ['/account/profile', 'Profile'],
            ['/responsible-gambling', 'Responsible gambling'],
            ['/help', 'Help'],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="side-link" onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <ThemeToggle label />
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export function SearchModal() {
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nexora-recent') || '[]') as string[];
    } catch {
      return ['Hand Clash', 'High Dice', 'Penalty Duel'];
    }
  });
  const nav = useNavigate();
  const results = useMemo(
    () => pvpGames.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()) || g.blurb.toLowerCase().includes(q.trim().toLowerCase())),
    [q],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const go = (term: string, href: string) => {
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
    setRecent(next);
    localStorage.setItem('nexora-recent', JSON.stringify(next));
    setOpen(false);
    nav(href);
  };

  return createPortal(
    <div className="search-panel" onClick={() => setOpen(false)}>
      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <input
          className="input"
          style={{ border: 0, borderRadius: 0, minHeight: 56 }}
          autoFocus
          placeholder="Search games…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div style={{ padding: 14 }} className="col gap-12">
          {!q ? (
            <>
              <div className="muted">Recent</div>
              <div className="hscroll">
                {recent.map((r) => (
                  <button key={r} type="button" className="sport-chip" onClick={() => setQ(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {results.map((g) => (
                <button key={g.kind} className="side-link" type="button" onClick={() => go(g.name, '/games')}>
                  {g.name} · {g.blurb}
                </button>
              ))}
              {!results.length ? <div className="muted">No matches for “{q}”.</div> : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function NotificationPanel() {
  const open = useUi((s) => s.notifyOpen);
  const setOpen = useUi((s) => s.setNotifyOpen);
  const items = useNotify((s) => s.items);
  const markRead = useNotify((s) => s.markRead);
  const markAll = useNotify((s) => s.markAll);
  if (!open) return null;
  return createPortal(
    <div className="drawer-back" onClick={() => setOpen(false)}>
      <aside className="slip-sheet" style={{ maxHeight: '88vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ padding: 16 }}>
          <div className="center gap-8">
            <Bell size={16} />
            <strong>Notifications</strong>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={markAll}>
            Mark all read
          </button>
        </div>
        <div className="col gap-8" style={{ padding: 12, overflow: 'auto' }}>
          {items.map((n) => (
            <Link
              key={n.id}
              to={n.href || '/account/notifications'}
              className="card card-pad"
              style={{ opacity: n.read ? 0.7 : 1 }}
              onClick={() => {
                markRead(n.id);
                setOpen(false);
              }}
            >
              <div className="between">
                <span className="badge">{n.kind}</span>
                <span className="faint">{formatRelative(n.createdAt)}</span>
              </div>
              <strong style={{ display: 'block', marginTop: 6 }}>{n.title}</strong>
              <p className="muted">{n.body}</p>
            </Link>
          ))}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export function AgeGate() {
  const accepted = useUi((s) => s.ageAccepted);
  const accept = useUi((s) => s.acceptAge);
  if (accepted) return null;
  return createPortal(
    <div className="age-gate">
      <div className="card card-pad" style={{ width: 'min(480px, 100%)' }}>
        <div className="kicker">Age restricted</div>
        <h2 style={{ margin: '10px 0' }}>Are you 18 or over?</h2>
        <p className="muted">
          Nexora is a sportsbook demonstration for adults. Confirm you meet the legal age in your jurisdiction (18+, or
          21+ where required). This product does not accept real-money bets.
        </p>
        <div className="flex gap-10" style={{ marginTop: 18 }}>
          <Button variant="primary" onClick={accept}>
            I am 18+
          </Button>
          <a className="btn" href="https://www.begambleaware.org" target="_blank" rel="noreferrer">
            Leave
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
