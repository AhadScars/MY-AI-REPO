import { Bell, Menu, Search, Wallet } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { Brand } from '../brand/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuth } from '../../store/authStore';
import { useNotify } from '../../store/notifyStore';
import { useUi } from '../../store/uiStore';
import { useWallet } from '../../store/walletStore';
import { currency } from '../../lib/format';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/games', label: 'Games' },
  { to: '/wallet', label: 'Wallet' },
  { to: '/help', label: 'Help' },
];

export function Navbar() {
  const user = useAuth((s) => s.user);
  const wallet = useWallet((s) => s.wallet);
  const unread = useNotify((s) => s.items.filter((n) => !n.read).length);
  const { setSearchOpen, setNotifyOpen, setMenuOpen } = useUi();

  return (
    <header className="nav">
      <div className="nav-inner">
        <button className="icon-btn nav-burger" type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <Menu size={18} />
        </button>
        <Link to="/" aria-label="Nexora home">
          <Brand />
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-tools">
          <ThemeToggle />
          <button className="icon-btn" type="button" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <Search size={16} />
          </button>
          <button className="icon-btn" type="button" aria-label="Notifications" onClick={() => setNotifyOpen(true)}>
            <Bell size={16} />
            {unread ? <span className="dot" /> : null}
          </button>
          {user ? (
            <Link to="/wallet" className="btn btn-sm">
              <Wallet size={14} />
              {currency(wallet.cash + wallet.bonus)}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
