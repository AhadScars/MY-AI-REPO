import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, Building2, IndianRupee, Plus, QrCode, Send, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import TxItem from '../components/TxItem';

export default function Home() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [txs, setTxs] = useState([]);

  useEffect(() => {
    refresh();
    api('/api/contacts').then((d) => setContacts(d.contacts || [])).catch(() => {});
    api('/api/transactions').then((d) => setTxs((d.transactions || []).slice(0, 5))).catch(() => {});
  }, [refresh]);

  const initials = (user?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="page">
      <header className="top-header">
        <div className="row">
          <div>
            <div className="greeting">Hello 👋</div>
            <div className="name">{user?.name}</div>
          </div>
          <Link to="/profile" className="avatar">{initials}</Link>
        </div>
      </header>

      <div className="balance-card">
        <div className="label">Wallet balance</div>
        <div className="amount">₹{(user?.walletBalance ?? 0).toLocaleString('en-IN')}</div>
        <div className="balance-actions">
          <button className="btn btn-teal" onClick={() => navigate('/add-money')}>
            <Plus size={16} /> Add money
          </button>
          <button className="btn btn-purple-soft" onClick={() => navigate('/pay')}>
            <Send size={16} /> Send money
          </button>
        </div>
      </div>

      <section className="section">
        <div className="section-title">Pay & transfer</div>
        <div className="actions-grid">
          <Link to="/pay?type=upi" className="action-tile">
            <div className="action-icon" style={{ background: 'linear-gradient(135deg,#5f259f,#7b3fc4)' }}>
              <Smartphone size={22} />
            </div>
            <span>UPI ID</span>
          </Link>
          <Link to="/pay?type=username" className="action-tile">
            <div className="action-icon" style={{ background: 'linear-gradient(135deg,#00baf2,#0088cc)' }}>
              <AtSign size={22} />
            </div>
            <span>Username</span>
          </Link>
          <Link to="/pay?type=bank" className="action-tile">
            <div className="action-icon" style={{ background: 'linear-gradient(135deg,#ff9800,#f57c00)' }}>
              <Building2 size={22} />
            </div>
            <span>Bank</span>
          </Link>
          <Link to="/banks" className="action-tile">
            <div className="action-icon" style={{ background: 'linear-gradient(135deg,#00c853,#009624)' }}>
              <IndianRupee size={22} />
            </div>
            <span>My banks</span>
          </Link>
        </div>
      </section>

      {contacts.length > 0 && (
        <section className="section">
          <div className="section-title">Pay contacts</div>
          <div className="contacts-row">
            {contacts.map((c) => (
              <button
                key={c.id}
                className="contact-chip"
                onClick={() => navigate(`/pay?type=username&to=@${c.username}`)}
              >
                <div className="contact-avatar">
                  {c.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <span>{c.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section" style={{ paddingBottom: 24 }}>
        <div className="section-title">
          Recent
          <Link to="/history">See all</Link>
        </div>
        {txs.length === 0 ? (
          <div className="empty-state">
            <QrCode size={32} style={{ opacity: 0.4 }} />
            <p>No transactions yet. Send your first payment!</p>
          </div>
        ) : (
          <div className="tx-list">
            {txs.map((tx) => (
              <TxItem key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
