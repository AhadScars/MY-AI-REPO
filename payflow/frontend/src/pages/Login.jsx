import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phoneOrUsername, setPhoneOrUsername] = useState('9876543210');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(phoneOrUsername, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <h1>PayFlow</h1>
        <p>Pay anyone via UPI, username, or bank transfer</p>
      </div>
      <div className="auth-card">
        <h2>Welcome back</h2>
        <p className="subtitle">Login to your PayFlow wallet</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Phone or username</label>
            <input
              value={phoneOrUsername}
              onChange={(e) => setPhoneOrUsername(e.target.value)}
              placeholder="9876543210 or shoaib"
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>
        <div className="demo-hint">
          <strong>Demo account</strong>
          Phone: <code>9876543210</code> · Password: <code>demo123</code>
          <br />
          Also try: priya / rahul (same password)
        </div>
        <p className="auth-switch">
          New here? <Link to="/register" className="btn-ghost">Create account</Link>
        </p>
      </div>
    </div>
  );
}
