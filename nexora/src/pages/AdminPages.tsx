import { useMemo, useState } from 'react';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminAlerts } from '../data/content';
import { auditLogs, demoUsers, seedBets, seedTransactions } from '../data/account';
import { events } from '../data/events';
import { leagues, sports } from '../data/catalog';
import { promotions } from '../data/content';
import { compact, currency, formatKickoff } from '../lib/format';
import { useAuth } from '../store/authStore';
import { Button, Modal, StatCard, Tabs } from '../components/ui/Primitives';
import { Brand } from '../components/brand/Logo';

const nav = [
  ['/admin', 'Dashboard'],
  ['/admin/users', 'Users'],
  ['/admin/kyc', 'KYC'],
  ['/admin/bets', 'Bets'],
  ['/admin/transactions', 'Transactions'],
  ['/admin/deposits', 'Deposits'],
  ['/admin/withdrawals', 'Withdrawals'],
  ['/admin/sports', 'Sports'],
  ['/admin/leagues', 'Leagues'],
  ['/admin/events', 'Events'],
  ['/admin/markets', 'Markets'],
  ['/admin/odds', 'Odds'],
  ['/admin/promotions', 'Promotions'],
  ['/admin/bonuses', 'Bonuses'],
  ['/admin/notifications', 'Notifications'],
  ['/admin/rg', 'Responsible gambling'],
  ['/admin/reports', 'Reports'],
  ['/admin/audit', 'Audit logs'],
  ['/admin/settings', 'Settings'],
];

const volume = [
  { d: 'Mon', bets: 420, rev: 18 },
  { d: 'Tue', bets: 510, rev: 22 },
  { d: 'Wed', bets: 390, rev: 14 },
  { d: 'Thu', bets: 640, rev: 31 },
  { d: 'Fri', bets: 880, rev: 44 },
  { d: 'Sat', bets: 1120, rev: 61 },
  { d: 'Sun', bets: 970, rev: 52 },
];

export function AdminLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="page">
        <div className="container card card-pad">
          <h2>Admin only</h2>
          <p className="muted">Sign in as admin@nexora.demo / admin1234 to open the control room.</p>
          <Link to="/" className="btn" style={{ marginTop: 12 }}>
            Back home
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link to="/">
          <Brand />
        </Link>
        <div className="kicker" style={{ margin: '18px 8px 8px' }}>
          Control room
        </div>
        {nav.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => `side-link ${isActive ? 'on' : ''}`}>
            {label}
          </NavLink>
        ))}
      </aside>
      <div className="admin-main">
        <div className="hscroll mobile-only-nav" style={{ marginBottom: 16 }}>
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => `sport-chip ${isActive ? 'on' : ''}`}>
              {label}
            </NavLink>
          ))}
        </div>
        <Outlet />
      </div>
    </div>
  );
}

export function AdminDashboard() {
  return (
    <div className="col gap-16">
      <div>
        <div className="kicker">Today</div>
        <h1>Operations</h1>
      </div>
      <div className="grid-4">
        <StatCard label="Total users" value="18,402" hint="+126 this week" />
        <StatCard label="Active now 24h" value="3,118" />
        <StatCard label="Bets" value="6,904" />
        <StatCard label="Betting volume" value={currency(482_330)} />
        <StatCard label="Revenue (GGR)" value={currency(38_440)} />
        <StatCard label="Deposits" value={currency(91_200)} />
        <StatCard label="Withdrawals" value={currency(54_810)} />
        <StatCard label="Live events" value={String(events.filter((e) => e.status === 'live').length)} />
      </div>
      <div className="card card-pad" style={{ height: 280 }}>
        <h3>Volume & GGR</h3>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={volume}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="d" stroke="#8b96a8" />
            <YAxis stroke="#8b96a8" />
            <Tooltip />
            <Area dataKey="bets" stroke="#14f195" fill="rgba(20,241,149,0.15)" />
            <Area dataKey="rev" stroke="#f5c451" fill="rgba(245,196,81,0.12)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid-2">
        {adminAlerts.map((a) => (
          <article key={a.id} className="card card-pad">
            <span className="badge">{a.severity}</span>
            <h3 style={{ marginTop: 8 }}>{a.title}</h3>
            <p className="muted">{a.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function AdminTable({
  title,
  headers,
  rows,
  searchHint,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  searchHint?: string;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string[] | null>(null);
  const filtered = rows.filter((r) => r.join(' ').toLowerCase().includes(q.toLowerCase()));
  const size = 8;
  const slice = filtered.slice(page * size, page * size + size);
  return (
    <div className="col gap-12">
      <div className="between wrap gap-10">
        <h1>{title}</h1>
        <input className="input" style={{ maxWidth: 260 }} placeholder={searchHint ?? 'Search'} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
                <td>
                  <Button size="sm" onClick={() => setOpen(r)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="between">
        <span className="muted">
          {filtered.length} rows · page {page + 1}
        </span>
        <div className="flex gap-8">
          <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button size="sm" disabled={(page + 1) * size >= filtered.length} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
      <Modal open={Boolean(open)} title="Record" onClose={() => setOpen(null)}>
        <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
          {open?.join('\n')}
        </pre>
      </Modal>
    </div>
  );
}

export function AdminUsers() {
  const extras = Array.from({ length: 12 }, (_, i) => [
    `u_${1200 + i}`,
    `user${i}@nexora.demo`,
    i % 4 === 0 ? 'pending' : 'verified',
    i % 5 === 0 ? 'restricted' : 'active',
    currency(80 + i * 35),
  ]);
  return (
    <AdminTable
      title="Users"
      headers={['ID', 'Email', 'KYC', 'Status', 'Balance']}
      rows={[
        ...demoUsers.map((u) => [u.id, u.email, u.kyc, u.role, '—']),
        ...extras,
      ]}
    />
  );
}

export function AdminKyc() {
  return (
    <AdminTable
      title="KYC queue"
      headers={['User', 'Document', 'Submitted', 'Status']}
      rows={[
        ['Maya Chen', 'Passport', '2h ago', 'pending'],
        ['Jonah Blake', 'Driving licence', '5h ago', 'pending'],
        ['Alex Moreau', 'Passport', '10d ago', 'verified'],
        ['Sofia Rahman', 'National ID', '1d ago', 'rejected'],
      ]}
    />
  );
}

export function AdminBets() {
  return (
    <AdminTable
      title="Bets"
      headers={['ID', 'Type', 'Stake', 'Odds', 'Status']}
      rows={seedBets.map((b) => [b.id, b.type, currency(b.stake), b.odds.toFixed(2), b.status])}
    />
  );
}

export function AdminTransactions() {
  return (
    <AdminTable
      title="Transactions"
      headers={['ID', 'Type', 'Status', 'Amount']}
      rows={seedTransactions.map((t) => [t.id, t.type, t.status, currency(t.amount)])}
    />
  );
}

export function AdminMoney({ kind }: { kind: 'deposit' | 'withdrawal' }) {
  const rows = seedTransactions.filter((t) => t.type === kind).map((t) => [t.id, t.status, t.method ?? '—', currency(t.amount)]);
  return <AdminTable title={kind === 'deposit' ? 'Deposits' : 'Withdrawals'} headers={['ID', 'Status', 'Method', 'Amount']} rows={rows} />;
}

export function AdminSports() {
  return <AdminTable title="Sports" headers={['ID', 'Name', 'Live', 'Events']} rows={sports.map((s) => [s.id, s.name, String(s.liveCount), String(s.eventCount)])} />;
}

export function AdminLeagues() {
  return <AdminTable title="Leagues" headers={['ID', 'Name', 'Sport', 'Country']} rows={leagues.map((l) => [l.id, l.name, l.sportId, l.country])} />;
}

export function AdminEvents() {
  return (
    <AdminTable
      title="Events"
      headers={['ID', 'Sport', 'Status', 'Kickoff']}
      rows={events.map((e) => [e.id, e.sportId, e.status, formatKickoff(e.startTime)])}
    />
  );
}

export function AdminMarkets() {
  const rows = events.flatMap((e) => e.markets.map((m) => [m.id, e.id, m.name, String(m.selections.length)]));
  return <AdminTable title="Betting markets" headers={['Market', 'Event', 'Name', 'Selections']} rows={rows} />;
}

export function AdminOdds() {
  const rows = events.flatMap((e) =>
    e.markets.flatMap((m) => m.selections.map((s) => [s.id, s.label, s.odds.toFixed(2), s.suspended ? 'suspended' : 'open'])),
  );
  return <AdminTable title="Odds book" headers={['Selection', 'Label', 'Price', 'State']} rows={rows} />;
}

export function AdminPromos() {
  return <AdminTable title="Promotions" headers={['ID', 'Title', 'Category', 'Expires']} rows={promotions.map((p) => [p.id, p.title, p.category, p.expires.slice(0, 10)])} />;
}

export function AdminBonuses() {
  return (
    <AdminTable
      title="Bonuses"
      headers={['User', 'Type', 'Amount', 'Status']}
      rows={[
        ['alexm', 'Welcome', '$50', 'active'],
        ['maya.edge', 'Cashback', '$12.50', 'used'],
        ['jblake', 'Reload', '$30', 'expired'],
      ]}
    />
  );
}

export function AdminNotifications() {
  return (
    <div className="col gap-12">
      <h1>Notifications</h1>
      <p className="muted">Compose a system announcement. Delivery is simulated.</p>
      <textarea className="textarea" placeholder="Announcement copy" />
      <Button variant="primary">Queue send</Button>
    </div>
  );
}

export function AdminRg() {
  return (
    <div className="col gap-12">
      <h1>Responsible gambling</h1>
      <div className="grid-3">
        <StatCard label="Reality checks today" value="214" />
        <StatCard label="Cooling-off" value="19" />
        <StatCard label="Self-exclusions" value="7" />
      </div>
      <AdminTable
        title="Triggers"
        headers={['User', 'Trigger', 'Action']}
        rows={[
          ['alexm', '80% daily loss', 'Reality check'],
          ['jblake', 'Session 3h', 'Prompt'],
          ['noral', 'Deposit limit hit', 'Blocked'],
        ]}
      />
    </div>
  );
}

export function AdminReports() {
  const [tab, setTab] = useState('hold');
  const hold = useMemo(() => compact(38440), []);
  return (
    <div className="col gap-12">
      <h1>Reports</h1>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'hold', label: 'Hold' },
          { id: 'sport', label: 'By sport' },
          { id: 'rg', label: 'RG activity' },
        ]}
      />
      <div className="card card-pad">
        {tab === 'hold' && <p>Demo GGR this week: {hold}. Figures are illustrative.</p>}
        {tab === 'sport' && <p>Football 54% · Basketball 16% · Tennis 11% · Other 19%.</p>}
        {tab === 'rg' && <p>1,082 limit changes · 64 cooling-off · 7 self-exclusions in 30 days.</p>}
      </div>
    </div>
  );
}

export function AdminAudit() {
  return (
    <AdminTable
      title="Audit logs"
      headers={['Actor', 'Action', 'Target', 'When', 'IP']}
      rows={auditLogs.map((a) => [a.actor, a.action, a.target, formatKickoff(a.time), a.ip])}
    />
  );
}

export function AdminSettings() {
  return (
    <div className="col gap-12">
      <h1>Settings</h1>
      <div className="card card-pad col gap-10">
        <label className="center gap-8">
          <input type="checkbox" defaultChecked /> Accept new registrations
        </label>
        <label className="center gap-8">
          <input type="checkbox" defaultChecked /> In-play enabled
        </label>
        <label className="center gap-8">
          <input type="checkbox" defaultChecked /> Show responsible gambling banner
        </label>
        <Button>Save settings</Button>
      </div>
    </div>
  );
}
