import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="page">
      <div className="sub-header" style={{ borderBottom: 'none' }}>
        <h1>Profile</h1>
      </div>
      <div className="profile-card">
        <div className="profile-avatar">{initials}</div>
        <h2>{user?.name}</h2>
        <div className="upi">{user?.upiId}</div>
        <div className="profile-rows">
          <div className="profile-row">
            <span>Username</span>
            <span>@{user?.username}</span>
          </div>
          <div className="profile-row">
            <span>Phone</span>
            <span>{user?.phone}</span>
          </div>
          <div className="profile-row">
            <span>Email</span>
            <span>{user?.email || '—'}</span>
          </div>
          <div className="profile-row">
            <span>Wallet</span>
            <span>₹{(user?.walletBalance ?? 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
        <button className="btn btn-outline" style={{ width: '100%', marginTop: 20 }} onClick={onLogout}>
          <LogOut size={16} /> Logout
        </button>
      </div>
      <p className="muted" style={{ textAlign: 'center', padding: '8px 24px 24px' }}>
        PayFlow is a demo app. No real money or bank APIs are used.
      </p>
    </div>
  );
}
