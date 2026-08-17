import { useEffect, useState } from 'react';
import { Landmark, Plus, Trash2, Star } from 'lucide-react';
import { api } from '../api/client';

const BANKS = ['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank', 'Kotak', 'Yes Bank', 'PNB', 'Other'];

export default function Banks() {
  const [banks, setBanks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    bankName: 'HDFC Bank',
    accountNumber: '',
    ifsc: '',
    accountHolder: '',
    accountType: 'Savings',
    balance: '10000',
  });

  const load = () =>
    api('/api/banks')
      .then((d) => setBanks(d.banks || []))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const link = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api('/api/banks/link', {
        method: 'POST',
        body: JSON.stringify({ ...form, balance: Number(form.balance) }),
      });
      setSuccess('Bank account linked successfully');
      setShowForm(false);
      setForm({
        bankName: 'HDFC Bank',
        accountNumber: '',
        ifsc: '',
        accountHolder: '',
        accountType: 'Savings',
        balance: '10000',
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setPrimary = async (id) => {
    await api(`/api/banks/${id}/primary`, { method: 'POST' });
    load();
  };

  const unlink = async (id) => {
    if (!confirm('Unlink this bank account?')) return;
    await api(`/api/banks/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="page">
      <div className="sub-header" style={{ borderBottom: 'none' }}>
        <div style={{ flex: 1 }}>
          <h1>Linked banks</h1>
          <p className="muted">Connect accounts for transfers & top-ups</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> {showForm ? 'Close' : 'Link'}
        </button>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {showForm && (
          <form className="form-card" style={{ margin: '0 0 16px' }} onSubmit={link}>
            <div className="field">
              <label>Bank</label>
              <select value={form.bankName} onChange={set('bankName')}>
                {BANKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Account holder</label>
              <input value={form.accountHolder} onChange={set('accountHolder')} required />
            </div>
            <div className="field">
              <label>Account number</label>
              <input value={form.accountNumber} onChange={set('accountNumber')} required />
            </div>
            <div className="field">
              <label>IFSC</label>
              <input value={form.ifsc} onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))} placeholder="HDFC0001234" required />
            </div>
            <div className="field">
              <label>Account type</label>
              <select value={form.accountType} onChange={set('accountType')}>
                <option>Savings</option>
                <option>Current</option>
              </select>
            </div>
            <div className="field">
              <label>Demo balance (₹)</label>
              <input type="number" value={form.balance} onChange={set('balance')} min="0" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Linking…' : 'Verify & link'}
            </button>
          </form>
        )}

        {banks.length === 0 && !showForm ? (
          <div className="empty-state">
            <Landmark size={36} style={{ opacity: 0.4 }} />
            <p>No banks linked yet. Link one to send bank transfers.</p>
          </div>
        ) : (
          banks.map((b) => (
            <div key={b.id} className={`bank-card${b.isPrimary ? ' primary' : ''}`}>
              <div className="bank-name">
                {b.bankName}
                {b.isPrimary && <span className="badge">Primary</span>}
              </div>
              <div className="bank-meta">
                {b.accountHolder} · {b.accountType}
                <br />
                {b.accountNumberMasked} · {b.ifsc}
              </div>
              <div className="bank-bal">₹{Number(b.balance).toLocaleString('en-IN')}</div>
              <div className="bank-actions">
                {!b.isPrimary && (
                  <button className="btn btn-outline btn-sm" onClick={() => setPrimary(b.id)}>
                    <Star size={14} /> Set primary
                  </button>
                )}
                <button className="btn btn-outline btn-sm" onClick={() => unlink(b.id)}>
                  <Trash2 size={14} /> Unlink
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
