import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth } from './api';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/owner/Dashboard.jsx';
import Tables from './pages/owner/Tables.jsx';
import MenuPage from './pages/owner/Menu.jsx';
import OrdersHistory from './pages/owner/OrdersHistory.jsx';
import TableEntry from './pages/customer/TableEntry.jsx';
import MenuOrder from './pages/customer/MenuOrder.jsx';
import OrderStatus from './pages/customer/OrderStatus.jsx';

function useAuth() {
  const [state, setState] = useState({ loading: true, user: null, restaurant: null });

  const refresh = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setState({ loading: false, user: null, restaurant: null });
      return;
    }
    try {
      const data = await auth.me();
      setState({ loading: false, user: data.user, restaurant: data.restaurant });
    } catch {
      localStorage.removeItem('token');
      setState({ loading: false, user: null, restaurant: null });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const loginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    setState({ loading: false, user: data.user, restaurant: data.restaurant });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setState({ loading: false, user: null, restaurant: null });
  };

  return { ...state, refresh, loginSuccess, logout };
}

function OwnerLayout({ authState, children }) {
  const nav = useNavigate();
  const loc = useLocation();
  const links = [
    { to: '/app', label: 'Live Orders', end: true },
    { to: '/app/tables', label: 'Tables & QR' },
    { to: '/app/menu', label: 'Menu' },
    { to: '/app/history', label: 'History' },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">TO</span>
          <div>
            <strong>TableOrder</strong>
            <small>{authState.restaurant?.name || 'Restaurant'}</small>
          </div>
        </div>
        <nav>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={
                l.end
                  ? loc.pathname === l.to
                    ? 'nav-link active'
                    : 'nav-link'
                  : loc.pathname.startsWith(l.to)
                    ? 'nav-link active'
                    : 'nav-link'
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">{authState.user?.name}</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              authState.logout();
              nav('/login');
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="main-pane">{children}</main>
    </div>
  );
}

function RequireOwner({ authState, children }) {
  if (authState.loading) return <div className="center-screen">Loading…</div>;
  if (!authState.user) return <Navigate to="/login" replace />;
  return <OwnerLayout authState={authState}>{children}</OwnerLayout>;
}

export default function App() {
  const authState = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login authState={authState} />} />
      <Route path="/register" element={<Register authState={authState} />} />

      <Route
        path="/app"
        element={
          <RequireOwner authState={authState}>
            <Dashboard restaurant={authState.restaurant} />
          </RequireOwner>
        }
      />
      <Route
        path="/app/tables"
        element={
          <RequireOwner authState={authState}>
            <Tables restaurant={authState.restaurant} />
          </RequireOwner>
        }
      />
      <Route
        path="/app/menu"
        element={
          <RequireOwner authState={authState}>
            <MenuPage />
          </RequireOwner>
        }
      />
      <Route
        path="/app/history"
        element={
          <RequireOwner authState={authState}>
            <OrdersHistory />
          </RequireOwner>
        }
      />

      <Route path="/t/:slug/:code" element={<TableEntry />} />
      <Route path="/t/:slug/:code/menu" element={<MenuOrder />} />
      <Route path="/t/:slug/:code/orders" element={<OrderStatus />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
