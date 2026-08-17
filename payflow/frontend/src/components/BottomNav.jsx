import { NavLink } from 'react-router-dom';
import { Home, Send, Landmark, History, User } from 'lucide-react';

const items = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/pay', icon: Send, label: 'Pay' },
  { to: '/banks', icon: Landmark, label: 'Banks' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Icon strokeWidth={2.2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
