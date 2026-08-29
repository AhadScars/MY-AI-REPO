import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { currency, formatDate, formatKickoff } from '../lib/format';
import { events } from '../data/events';
import { useAuth } from '../store/authStore';
import { useFavorites } from '../store/favoritesStore';
import { useNotify } from '../store/notifyStore';
import { useUi } from '../store/uiStore';
import { useWallet } from '../store/walletStore';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Button, EmptyState, Field, StatCard } from '../components/ui/Primitives';
import { EventCard } from '../components/betting/EventCard';

const accountLinks = [
  ['/account', 'Overview'],
  ['/account/profile', 'Profile'],
  ['/games', 'Games'],
  ['/wallet', 'Wallet'],
  ['/account/transactions', 'Transactions'],
  ['/account/notifications', 'Notifications'],
  ['/account/security', 'Security'],
  ['/responsible-gambling', 'Responsible gambling'],
];

export function AccountLayout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="page">
      <div className="wide account-shell">
        <aside className="sidebar">
          {accountLinks.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/account'} className={({ isActive }) => `side-link ${isActive ? 'on' : ''}`}>
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            className="side-link"
            onClick={() => {
              logout();
              nav('/');
            }}
          >
            Log out
          </button>
        </aside>
        <div className="account-pane">
          <div className="hscroll mobile-only-nav" style={{ marginBottom: 16 }}>
            {accountLinks.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/account'} className={({ isActive }) => `sport-chip ${isActive ? 'on' : ''}`}>
                {label}
              </NavLink>
            ))}
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function AccountOverview() {
  const user = useAuth((s) => s.user)!;
  const wallet = useWallet((s) => s.wallet);
  const bets = useWallet((s) => s.bets);
  const open = bets.filter((b) => b.status === 'open');
  return (
    <div className="col gap-16">
      <div>
        <div className="kicker">Account</div>
        <h1>Hello, {user.firstName}</h1>
        <p className="muted">
          KYC {user.kyc} · {user.emailVerified ? 'Email verified' : 'Email unverified'} · {user.twoFactor ? '2FA on' : '2FA off'}
          {user.role === 'admin' ? (
            <>
              {' · '}
              <Link to="/admin">Open admin desk</Link>
            </>
          ) : null}
        </p>
      </div>
      <div className="grid-3">
        <StatCard label="INR cash" value={currency(wallet.cash)} />
        <StatCard label="Open tables" value={String(open.length)} />
        <StatCard label="Wallet moves" value={String(bets.length)} />
      </div>
      <div className="card card-pad">
        <h3>Next actions</h3>
        <div className="flex gap-8 wrap" style={{ marginTop: 10 }}>
          <Link className="btn btn-primary" to="/games">
            Play a table
          </Link>
          {!user.emailVerified ? <Link className="btn" to="/verify-email">Verify email</Link> : null}
          {user.kyc !== 'verified' ? <Link className="btn" to="/account/security">Start KYC</Link> : null}
          <Link className="btn" to="/responsible-gambling">Review limits</Link>
        </div>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const user = useAuth((s) => s.user)!;
  const update = useAuth((s) => s.updateProfile);
  const toast = useUi((s) => s.pushToast);
  const [phone, setPhone] = useState(user.phone);
  const [name, setName] = useState(user.displayName);
  return (
    <div className="profile-page col gap-16">
      <div className="between wrap gap-12">
        <div>
          <div className="kicker">Account</div>
          <h1>Profile</h1>
          <p className="muted">Wallet currency is INR. Theme stays on this device.</p>
        </div>
        <ThemeToggle label />
      </div>
      <div className="card card-pad profile-card">
        <div className="profile-grid">
          <Field label="Display name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="input" value={user.email} disabled />
          </Field>
          <Field label="Phone">
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Country / currency">
            <input className="input" value={`${user.country} · INR`} disabled />
          </Field>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            update({ phone, displayName: name });
            toast('success', 'Profile saved');
          }}
        >
          Save profile
        </Button>
      </div>
    </div>
  );
}

export function BettingHistoryPage({ mode = 'all' }: { mode?: 'all' | 'open' | 'settled' }) {
  const bets = useWallet((s) => s.bets);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const rows = useMemo(() => {
    return bets.filter((b) => {
      if (mode === 'open' && b.status !== 'open') return false;
      if (mode === 'settled' && b.status === 'open') return false;
      if (status !== 'all' && b.status !== status) return false;
      if (q && !`${b.id} ${b.legs.map((l) => l.eventLabel).join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [bets, q, status, mode]);

  return (
    <div className="col gap-16">
      <h1>{mode === 'open' ? 'Open bets' : mode === 'settled' ? 'Settled bets' : 'Betting history'}</h1>
      <div className="flex gap-10 wrap">
        <input className="input" style={{ maxWidth: 240 }} placeholder="Search bet id or event" value={q} onChange={(e) => setQ(e.target.value)} />
        {mode === 'all' ? (
          <select className="select" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Any status</option>
            <option value="open">Open</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        ) : null}
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bet ID</th>
                <th>Date</th>
                <th>Sport</th>
                <th>Event</th>
                <th>Selection</th>
                <th>Odds</th>
                <th>Stake</th>
                <th>Return</th>
                <th>Status</th>
                <th>Settled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.id}</td>
                  <td>{formatDate(b.createdAt)}</td>
                  <td>{b.legs[0]?.sportId}</td>
                  <td>{b.legs.map((l) => l.eventLabel).join(' + ')}</td>
                  <td>{b.legs.map((l) => l.selectionLabel).join(' / ')}</td>
                  <td className="mono">{b.odds.toFixed(2)}</td>
                  <td>{currency(b.stake)}</td>
                  <td>{currency(b.returns ?? b.potential)}</td>
                  <td>{b.status}</td>
                  <td>{b.settledAt ? formatDate(b.settledAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No bets" body="Place a demo wager from any event card." />
      )}
    </div>
  );
}

export function TransactionsPage() {
  const txs = useWallet((s) => s.txs);
  return (
    <div className="col gap-16">
      <h1>Transactions</h1>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id}>
                <td>{formatKickoff(t.createdAt)}</td>
                <td>{t.type}</td>
                <td>{t.status}</td>
                <td>{t.reference ?? t.note ?? '—'}</td>
                <td className="mono">{currency(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BonusesPage() {
  const wallet = useWallet((s) => s.wallet);
  const claimed = useWallet((s) => s.claimed);
  return (
    <div className="col gap-16">
      <h1>Bonuses</h1>
      <div className="grid-3">
        <StatCard label="Bonus balance" value={currency(wallet.bonus)} />
        <StatCard label="Promo balance" value={currency(wallet.promo)} />
        <StatCard label="Claimed offers" value={String(claimed.length)} />
      </div>
      <Link to="/promotions" className="btn">
        Open marketplace
      </Link>
    </div>
  );
}

export function FavoritesPage() {
  const ids = useFavorites((s) => s.events);
  const list = events.filter((e) => ids.includes(e.id));
  return (
    <div className="col gap-16">
      <h1>Favorites</h1>
      {list.length ? list.map((e) => <EventCard key={e.id} event={e} />) : <EmptyState title="No favorites" body="Star any event to pin it here." />}
    </div>
  );
}

export function NotificationsPage() {
  const items = useNotify((s) => s.items);
  const markRead = useNotify((s) => s.markRead);
  return (
    <div className="col gap-12">
      <h1>Notifications</h1>
      {items.map((n) => (
        <button key={n.id} type="button" className="card card-pad" style={{ textAlign: 'left', opacity: n.read ? 0.7 : 1 }} onClick={() => markRead(n.id)}>
          <div className="between">
            <span className="badge">{n.kind}</span>
            <span className="faint">{n.read ? 'Read' : 'Unread'}</span>
          </div>
          <strong>{n.title}</strong>
          <p className="muted">{n.body}</p>
        </button>
      ))}
    </div>
  );
}

export function SecurityPage() {
  const user = useAuth((s) => s.user)!;
  const update = useAuth((s) => s.updateProfile);
  const setKyc = useAuth((s) => s.setKyc);
  const format = useUi((s) => s.oddsFormat);
  const setFormat = useUi((s) => s.setOddsFormat);
  const toast = useUi((s) => s.pushToast);
  return (
    <div className="col gap-16">
      <h1>Security</h1>
      <div className="card card-pad col gap-10">
        <div className="between">
          <div>
            <strong>Two-factor authentication</strong>
            <p className="muted">Authenticator app. Demo code remains 847291.</p>
          </div>
          <Button onClick={() => update({ twoFactor: !user.twoFactor })}>{user.twoFactor ? 'Disable' : 'Enable'}</Button>
        </div>
        <div className="between">
          <div>
            <strong>KYC / AML verification</strong>
            <p className="muted">Status: {user.kyc}. File upload is visual only.</p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              setKyc('pending');
              window.setTimeout(() => {
                setKyc('verified');
                toast('success', 'KYC verified', 'Demo identity check passed.');
              }, 1200);
            }}
          >
            Start KYC
          </Button>
        </div>
        <Field label="Odds format">
          <select className="select" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="decimal">Decimal</option>
            <option value="american">American</option>
            <option value="fractional">Fractional</option>
          </select>
        </Field>
        <div className="between wrap gap-12">
          <div>
            <strong>Theme colour</strong>
            <p className="muted">Tap the colour button for light or dark.</p>
          </div>
          <ThemeToggle label />
        </div>
        <Button
          variant="danger"
          onClick={() => {
            localStorage.clear();
            window.location.href = '/';
          }}
        >
          Reset demo data
        </Button>
      </div>
    </div>
  );
}
