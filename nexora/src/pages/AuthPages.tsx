import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/brand/Logo';
import { Button, Field } from '../components/ui/Primitives';
import { useAuth } from '../store/authStore';
import { useUi } from '../store/uiStore';

function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page" style={{ minHeight: '80vh', display: 'grid', placeItems: 'center' }}>
      <div className="card card-pad" style={{ width: 'min(460px, calc(100% - 24px))' }}>
        <Link to="/">
          <Brand />
        </Link>
        <h1 style={{ margin: '16px 0 8px', fontSize: 28 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/account';
  const login = useAuth((s) => s.login);
  const user = useAuth((s) => s.user);
  const toast = useUi((s) => s.pushToast);
  const [email, setEmail] = useState('alex@nexora.demo');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  if (user) return <Navigate to={from} replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const res = login(email, password);
    if (!res.ok) {
      setError(res.error || 'Failed');
      return;
    }
    if (res.needs2fa) {
      nav('/login/2fa', { state: { from } });
      return;
    }
    toast('success', 'Welcome back');
    nav(from);
  };

  return (
    <AuthFrame title="Log in">
      <p className="muted">Demo: alex@nexora.demo / demo1234 · admin@nexora.demo / admin1234</p>
      <form className="col gap-12" style={{ marginTop: 16 }} onSubmit={onSubmit}>
        <Field label="Email" error={error}>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </Field>
        <Field label="Password">
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </Field>
        <Button variant="primary" type="submit">
          Continue
        </Button>
        <div className="between">
          <Link to="/forgot-password">Forgot password</Link>
          <Link to="/register">Create account</Link>
        </div>
      </form>
    </AuthFrame>
  );
}

export function TwoFactorPage() {
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/account';
  const complete2fa = useAuth((s) => s.complete2fa);
  const pending = useAuth((s) => s.pendingEmail);
  const [code, setCode] = useState('847291');
  const [error, setError] = useState('');
  if (!pending) return <Navigate to="/login" replace />;
  return (
    <AuthFrame title="Two-factor">
      <p className="muted">Enter the authenticator code. Demo code: 847291</p>
      <form
        className="col gap-12"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          const res = complete2fa(code);
          if (!res.ok) setError(res.error || 'Failed');
          else nav(from);
        }}
      >
        <Field label="6-digit code" error={error}>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
        </Field>
        <Button variant="primary" type="submit">
          Verify
        </Button>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const nav = useNavigate();
  const register = useAuth((s) => s.register);
  const toast = useUi((s) => s.pushToast);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    dob: '',
    country: 'India',
    rg: false,
    age: false,
  });
  const [error, setError] = useState('');
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AuthFrame title="Create account">
      <p className="muted">18+ only. Age, identity and responsible-gambling confirmations are required.</p>
      <form
        className="col gap-12"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.age || !form.rg) {
            setError('Confirm age and responsible gambling to continue.');
            return;
          }
          const res = register(form);
          if (!res.ok) setError(res.error || 'Failed');
          else {
            toast('success', 'Account created', 'Verify the demo email to unlock withdrawals.');
            nav('/verify-email');
          }
        }}
      >
        <div className="grid-2">
          <Field label="First name">
            <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
          </Field>
          <Field label="Last name">
            <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
          </Field>
        </div>
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required />
        </Field>
        <Field label="Date of birth">
          <input className="input" type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} required />
        </Field>
        <Field label="Country">
          <select className="select" value={form.country} onChange={(e) => set('country', e.target.value)}>
            {['India', 'United Kingdom', 'United States', 'Ireland', 'Canada', 'Australia'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <label className="center gap-8">
          <input type="checkbox" checked={form.age} onChange={(e) => set('age', e.target.checked)} /> I am 18 or over (21+ if required where I live)
        </label>
        <label className="center gap-8">
          <input type="checkbox" checked={form.rg} onChange={(e) => set('rg', e.target.checked)} /> I understand this is a demo and I can set limits any time
        </label>
        {error ? <div className="field-error">{error}</div> : null}
        <Button variant="primary" type="submit">
          Create demo account
        </Button>
        <Link to="/login">Already have an account</Link>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  return (
    <AuthFrame title="Forgot password">
      {sent ? (
        <p className="muted">If that email exists, a reset link would be sent. Open the demo reset screen to continue.</p>
      ) : (
        <form
          className="col gap-12"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <Field label="Email">
            <input className="input" type="email" required defaultValue="alex@nexora.demo" />
          </Field>
          <Button variant="primary" type="submit">
            Send reset link
          </Button>
        </form>
      )}
      <Link to="/reset-password" style={{ display: 'inline-block', marginTop: 12 }}>
        Use demo reset
      </Link>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const nav = useNavigate();
  return (
    <AuthFrame title="Reset password">
      <form
        className="col gap-12"
        onSubmit={(e) => {
          e.preventDefault();
          nav('/login');
        }}
      >
        <Field label="New password">
          <input className="input" type="password" required minLength={8} />
        </Field>
        <Field label="Confirm password">
          <input className="input" type="password" required minLength={8} />
        </Field>
        <Button variant="primary" type="submit">
          Update password
        </Button>
      </form>
    </AuthFrame>
  );
}

export function VerifyEmailPage() {
  const update = useAuth((s) => s.updateProfile);
  const nav = useNavigate();
  return (
    <AuthFrame title="Verify email">
      <p className="muted">In production this would be a signed link. Confirm the demo address to continue.</p>
      <Button
        variant="primary"
        onClick={() => {
          update({ emailVerified: true });
          nav('/account');
        }}
      >
        Mark email verified
      </Button>
    </AuthFrame>
  );
}
