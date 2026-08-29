import { useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentMethods } from '../data/account';
import { currency, formatDate } from '../lib/format';
import { useAuth } from '../store/authStore';
import { useUi } from '../store/uiStore';
import { useWallet } from '../store/walletStore';
import { Button, Field, Modal, StatCard, Tabs } from '../components/ui/Primitives';

export function WalletPage() {
  const user = useAuth((s) => s.user);
  const wallet = useWallet((s) => s.wallet);
  const txs = useWallet((s) => s.txs);
  const deposit = useWallet((s) => s.deposit);
  const withdraw = useWallet((s) => s.withdraw);
  const toast = useUi((s) => s.pushToast);
  const [tab, setTab] = useState('all');
  const [depOpen, setDepOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [amount, setAmount] = useState(100);
  const [method, setMethod] = useState(paymentMethods[0].id);

  const filtered = txs.filter((t) => {
    if (tab === 'pending') return t.status === 'pending' || t.status === 'processing';
    if (tab === 'money') return t.type === 'deposit' || t.type === 'withdrawal';
    return true;
  });

  if (!user) {
    return (
      <div className="page">
        <div className="container card card-pad">
          <h2>Sign in to open the wallet</h2>
          <p className="muted">Demo login: alex@nexora.demo / demo1234</p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: 12 }}>
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const methodLabel = paymentMethods.find((m) => m.id === method);

  return (
    <div className="page">
      <div className="wide col gap-16">
        <div className="between wrap">
          <div>
            <div className="kicker">Wallet</div>
            <h1>Balances</h1>
            <p className="muted">Demo funds only. Deposits and withdrawals never touch a real rail.</p>
          </div>
          <div className="flex gap-8">
            <Button variant="primary" onClick={() => setDepOpen(true)}>
              Deposit
            </Button>
            <Button onClick={() => setWdOpen(true)}>Withdraw</Button>
          </div>
        </div>
        <div className="grid-4">
          <StatCard label="Current balance" value={currency(wallet.cash + wallet.bonus + wallet.promo)} />
          <StatCard label="Available cash" value={currency(wallet.cash)} />
          <StatCard label="Bonus" value={currency(wallet.bonus)} hint="Not withdrawable" />
          <StatCard label="Promo / reserved" value={currency(wallet.promo + wallet.reserved)} />
        </div>
        <section className="card card-pad">
          <h3>Payment methods</h3>
          <div className="grid-3" style={{ marginTop: 12 }}>
            {paymentMethods.map((m) => (
              <div key={m.id} className="card card-pad">
                <div className="between">
                  <strong>{m.brand}</strong>
                  {m.primary ? <span className="badge badge-ok">Primary</span> : null}
                </div>
                <div className="mono">•••• {m.last4}</div>
                <div className="faint">Exp {m.expiry}</div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'all', label: 'History' },
              { id: 'pending', label: 'Pending' },
              { id: 'money', label: 'Deposits & withdrawals' },
            ]}
          />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.createdAt)}</td>
                    <td>{t.type}</td>
                    <td>{t.status}</td>
                    <td>{t.method ?? t.note ?? '—'}</td>
                    <td className="mono" style={{ color: t.amount >= 0 ? 'var(--accent)' : 'var(--text)' }}>
                      {currency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={depOpen} title="Demo deposit" onClose={() => setDepOpen(false)}>
        <div className="col gap-12">
          <Field label="Amount">
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Method">
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brand} •{m.last4}
                </option>
              ))}
            </select>
          </Field>
          <Button
            variant="primary"
            onClick={() => {
              const res = deposit(amount, `${methodLabel?.brand} •${methodLabel?.last4}`);
              if (res.ok) {
                toast('success', 'Deposit complete', 'Demo cash credited instantly.');
                setDepOpen(false);
              } else toast('error', res.error || 'Failed');
            }}
          >
            Credit wallet
          </Button>
        </div>
      </Modal>

      <Modal open={wdOpen} title="Demo withdrawal" onClose={() => setWdOpen(false)}>
        <div className="col gap-12">
          <p className="muted">Cash only. Bonus and promo balances stay on the account.</p>
          <Field label="Amount">
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Button
            variant="primary"
            onClick={() => {
              const res = withdraw(amount, `${methodLabel?.brand} •${methodLabel?.last4}`);
              if (res.ok) {
                toast('success', 'Withdrawal queued', 'Status: processing (demo).');
                setWdOpen(false);
              } else toast('error', res.error || 'Failed');
            }}
          >
            Request withdrawal
          </Button>
        </div>
      </Modal>
    </div>
  );
}
