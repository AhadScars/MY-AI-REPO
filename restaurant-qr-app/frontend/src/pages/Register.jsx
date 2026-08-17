import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { auth } from '../api';

export default function Register({ authState }) {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    restaurantName: '',
    phone: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authState.loading && authState.user) return <Navigate to="/app" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await auth.register(form);
      authState.loginSuccess(data);
      nav('/app');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>Register restaurant</h1>
        <p className="muted">Create owner account + restaurant</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Your name
          <input value={form.name} onChange={set('name')} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={set('password')} minLength={6} required />
        </label>
        <label>
          Restaurant name
          <input value={form.restaurantName} onChange={set('restaurantName')} required />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={set('phone')} />
        </label>
        <label>
          Address
          <input value={form.address} onChange={set('address')} />
        </label>
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className="center muted">
          Already have account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
