import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const PRESETS = [500, 1000, 2000, 5000];

export default function AddMoney() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [banks, setBanks] = useState([]);
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('1000');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api('/api/banks').then((d) => {
      setBanks(d.banks || []);
      const p = (d.banks || []).find((b) => b.isPrimary);
      setBankId(p?.id || d.banks?.[0]?.id || '');
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/api/wallet/add', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), bankId }),
      });
      updateUser({ walletBalance: data.walletBalance });
      setDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="page no-nav">
        <div className="success-page">
          <div className="success-circle">
            <CheckCircle2 size={48} />
          </div>
          <h2>Money added</h2>
          <div className="big-amount">₹{Number(done.transaction.amount).toLocaleString('en-IN')}</div>
          <p className="detail">
            New wallet balance: ₹{Number(done.walletBalance).toLocaleString('en-IN')}
          </p>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 28 }} onClick={() => navigate('/')}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page no-nav">
      <div className="sub-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1>Add money</h1>
      </div>
      <form className="form-card" onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        {banks.length === 0 ? (
          <div className="error-banner">Link a bank account first from the Banks tab.</div>
        ) : (
          <div className="field">
            <label>From bank account</label>
            <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} · {b.accountNumberMasked} (₹{b.balance.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="amount-input-wrap">
          <span className="rupee">₹</span>
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, justifyContent: 'center' }}>
          {PRESETS.map((p) => (
            <button key={p} type="button" className="btn btn-outline btn-sm" onClick={() => setAmount(String(p))}>
              ₹{p}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || banks.length === 0}>
          {loading ? 'Processing…' : 'Add to wallet'}
        </button>
      </form>
    </div>
  );
}
