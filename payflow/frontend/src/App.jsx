import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Pay from './pages/Pay';
import Banks from './pages/Banks';
import History from './pages/History';
import Profile from './pages/Profile';
import AddMoney from './pages/AddMoney';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div>PayFlow</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children, hideNav }) {
  return (
    <div className="app-shell">
      <div className="phone">
        {children}
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const hideNav = ['/login', '/register', '/pay', '/add-money'].some((p) =>
    location.pathname.startsWith(p)
  );
  const isAuth = location.pathname === '/login' || location.pathname === '/register';

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Shell hideNav>
            <Login />
          </Shell>
        }
      />
      <Route
        path="/register"
        element={
          <Shell hideNav>
            <Register />
          </Shell>
        }
      />
      <Route
        path="/*"
        element={
          <Protected>
            <Shell hideNav={hideNav && !isAuth}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/pay" element={<Pay />} />
                <Route path="/banks" element={<Banks />} />
                <Route path="/history" element={<History />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/add-money" element={<AddMoney />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Shell>
          </Protected>
        }
      />
    </Routes>
  );
}
