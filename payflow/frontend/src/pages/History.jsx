import { useEffect, useState } from 'react';
import { History as HistoryIcon } from 'lucide-react';
import { api } from '../api/client';
import TxItem from '../components/TxItem';

export default function History() {
  const [txs, setTxs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/transactions')
      .then((d) => setTxs(d.transactions || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <div className="sub-header" style={{ borderBottom: 'none' }}>
        <h1>Transaction history</h1>
      </div>
      <div style={{ padding: '0 16px 24px' }}>
        {error && <div className="error-banner">{error}</div>}
        {txs.length === 0 ? (
          <div className="empty-state">
            <HistoryIcon size={36} style={{ opacity: 0.4 }} />
            <p>No transactions yet</p>
          </div>
        ) : (
          <div className="tx-list">
            {txs.map((tx) => (
              <TxItem key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
