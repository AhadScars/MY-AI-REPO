import { useEffect, useState } from 'react';
import { ordersApi } from '../../api';
import OrderCard from '../../components/OrderCard.jsx';

export default function OrdersHistory() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    ordersApi
      .list()
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Order history</h1>
          <p className="muted">Last 100 orders</p>
        </div>
      </header>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="cards-grid">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} compact />
        ))}
      </div>
      {orders.length === 0 && !error && <div className="empty-state">No orders yet</div>}
    </div>
  );
}
