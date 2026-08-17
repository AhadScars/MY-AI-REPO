import StatusBadge from './StatusBadge.jsx';

export default function OrderCard({ order, onStatus, compact }) {
  const next = {
    pending: [
      { s: 'accepted', label: 'Accept' },
      { s: 'cancelled', label: 'Cancel', ghost: true },
    ],
    accepted: [{ s: 'preparing', label: 'Preparing' }],
    preparing: [{ s: 'served', label: 'Mark served' }],
  };

  return (
    <article className={`order-card ${order.status === 'pending' ? 'pulse' : ''}`}>
      <header className="order-card-head">
        <div>
          <strong>
            Table {order.table?.table_number ?? '—'} · #{order.id}
          </strong>
          <div className="muted small">
            {order.guest_name} · {order.guest_phone}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </header>
      <ul className="order-items">
        {order.items?.map((it) => (
          <li key={it.id}>
            <span>
              {it.qty}× {it.name_snapshot}
            </span>
            <span>₹{(it.price_snapshot * it.qty).toFixed(0)}</span>
          </li>
        ))}
      </ul>
      <footer className="order-card-foot">
        <strong>₹{Number(order.total).toFixed(0)}</strong>
        <span className="muted small">{new Date(order.created_at + 'Z').toLocaleTimeString()}</span>
      </footer>
      {!compact && next[order.status] && (
        <div className="row gap wrap mt">
          {next[order.status].map((a) => (
            <button
              key={a.s}
              className={a.ghost ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
              onClick={() => onStatus?.(order.id, a.s)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
