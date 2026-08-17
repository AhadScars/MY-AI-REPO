import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TxItem({ tx }) {
  const isIn = tx.direction === 'in';
  const title = isIn
    ? tx.type === 'topup'
      ? 'Wallet top-up'
      : `From ${tx.fromName}`
    : `To ${tx.toName}`;

  return (
    <div className="tx-item">
      <div className={`tx-icon ${isIn ? 'in' : 'out'}`}>
        {isIn ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
      </div>
      <div className="tx-body">
        <div className="title">{title}</div>
        <div className="meta">
          {tx.method}
          {tx.note ? ` · ${tx.note}` : ''} · {formatDate(tx.createdAt)}
        </div>
      </div>
      <div className={`tx-amount ${isIn ? 'in' : 'out'}`}>
        {isIn ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN')}
      </div>
    </div>
  );
}
