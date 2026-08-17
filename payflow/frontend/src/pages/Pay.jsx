import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'username', label: 'Username' },
  { id: 'upi', label: 'UPI' },
  { id: 'bank', label: 'Bank transfer' },
];

export default function Pay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const [type, setType] = useState(params.get('type') || 'username');
  const [to, setTo] = useState(params.get('to') || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [banks, setBanks] = useState([]);
  const [bankId, setBankId] = useState('');
  const [lookup, setLookup] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (type === 'bank') {
      api('/api/banks').then((d) => {
        setBanks(d.banks || []);
        const primary = (d.banks || []).find((b) => b.isPrimary);
        setBankId(primary?.id || d.banks?.[0]?.id || '');
      });
    }
  }, [type]);

  useEffect(() => {
    setLookup(null);
    setError('');
  }, [type, to]);

  const doLookup = async () => {
    setError('');
    setLookup(null);
    const q = type === 'username' ? to : to;
    if (!q.trim()) return;
    try {
      const user = await api(`/api/users/lookup?q=${encodeURIComponent(q)}`);
      setLookup(user);
    } catch (err) {
      setError(err.message);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = {
        type,
        amount: Number(amount),
        note,
        pin,
        bankId: type === 'bank' ? bankId : undefined,
      };
      if (type === 'bank') {
        body.accountNumber = accountNumber;
        body.ifsc = ifsc;
        body.accountHolder = accountHolder;
        body.to = accountNumber;
      } else {
        body.to = to;
      }
      const data = await api('/api/pay', { method: 'POST', body: JSON.stringify(body) });
      if (data.walletBalance != null) updateUser({ walletBalance: data.walletBalance });
      setSuccess(data.transaction);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page no-nav">
        <div className="success-page">
          <div className="success-circle">
            <CheckCircle2 size={48} />
          </div>
          <h2>Payment successful</h2>
          <div className="big-amount">₹{Number(success.amount).toLocaleString('en-IN')}</div>
          <p className="detail">
            Paid to <strong>{success.toName}</strong>
            <br />
            via {success.method}
            <br />
            {success.toIdentifier}
            {success.note ? (
              <>
                <br />
                Note: {success.note}
              </>
            ) : null}
          </p>
          <div style={{ width: '100%', marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Done
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setSuccess(null);
                setAmount('');
                setPin('');
                setNote('');
              }}
            >
              Pay again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page no-nav">
      <div className="sub-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1>Send money</h1>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${type === t.id ? ' active' : ''}`}
            onClick={() => setType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form className="form-card" onSubmit={onSubmit}>
        {error && <div className="error-banner">{error}</div>}

        {type === 'username' && (
          <>
            <div className="field">
              <label>Pay to username</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="@priya or priya"
                  required
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={doLookup}>
                  <Search size={16} />
                </button>
              </div>
            </div>
          </>
        )}

        {type === 'upi' && (
          <div className="field">
            <label>UPI ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="name@payflow"
                required
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={doLookup}>
                <Search size={16} />
              </button>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>
              Demo: priya@payflow · rahul@okaxis
            </p>
          </div>
        )}

        {type === 'bank' && (
          <>
            <div className="field">
              <label>Account holder name</label>
              <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Beneficiary name" required />
            </div>
            <div className="field">
              <label>Account number</label>
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Bank account number" required />
            </div>
            <div className="field">
              <label>IFSC code</label>
              <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" required />
            </div>
            <div className="field">
              <label>Pay from bank</label>
              <select value={bankId} onChange={(e) => setBankId(e.target.value)} required>
                {banks.length === 0 && <option value="">No bank linked</option>}
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} · {b.accountNumberMasked} (₹{b.balance.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>
            <p className="muted" style={{ marginBottom: 12 }}>
              Demo: transfer to Priya — A/C 001234567890 · IFSC ICIC0000789
            </p>
          </>
        )}

        {lookup && (
          <div className="lookup-card">
            <div className="contact-avatar" style={{ width: 44, height: 44, fontSize: '0.9rem' }}>
              {lookup.name.slice(0, 1)}
            </div>
            <div className="info">
              <strong>{lookup.name}</strong>
              <span>
                @{lookup.username} · {lookup.upiId}
              </span>
            </div>
          </div>
        )}

        <div className="amount-input-wrap">
          <span className="rupee">₹</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
          />
        </div>

        <div className="field">
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's this for?" maxLength={60} />
        </div>

        <div className="field">
          <label>UPI PIN (demo: 1234)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            required
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Processing…' : `Pay ₹${amount || '0'}`}
        </button>
      </form>
    </div>
  );
}
