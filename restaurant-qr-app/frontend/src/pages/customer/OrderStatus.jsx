import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { publicApi, getGuest, setGuest } from '../../api';
import { joinSession } from '../../socket';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function OrderStatus() {
  const { slug, code } = useParams();
  const nav = useNavigate();
  const guest = getGuest();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    if (!guest?.guestToken) return;
    try {
      setOrders(await publicApi.myOrders(guest.guestToken));
      setError('');
    } catch (e) {
      setError(e.data?.message || e.message);
      if (e.data?.code === 'SESSION_INVALID') {
        setGuest(null);
      }
    }
  };

  useEffect(() => {
    if (!guest?.guestToken || guest.slug !== slug) {
      nav(`/t/${slug}/${code}`, { replace: true });
      return;
    }
    load();
    const t = setInterval(load, 10000);
    const s = joinSession(guest.sessionId);
    const onUpd = (order) => {
      setOrders((prev) => {
        const i = prev.findIndex((o) => o.id === order.id);
        if (i === -1) return [order, ...prev];
        const next = [...prev];
        next[i] = order;
        return next;
      });
    };
    s.on('order:updated', onUpd);
    return () => {
      clearInterval(t);
      s.off('order:updated', onUpd);
    };
  }, [slug, code]); // eslint-disable-line

  return (
    <div className="customer-bg">
      <div className="customer-card wide">
        <div className="row between">
          <div>
            <h1>My orders</h1>
            <p className="muted">Table {guest?.table?.table_number}</p>
          </div>
          <Link className="btn btn-secondary btn-sm" to={`/t/${slug}/${code}/menu`}>
            ← Menu
          </Link>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="stack gap mt">
          {orders.map((o) => (
            <article key={o.id} className="order-card">
              <header className="order-card-head">
                <strong>Order #{o.id}</strong>
                <StatusBadge status={o.status} />
              </header>
              <ul className="order-items">
                {o.items?.map((it) => (
                  <li key={it.id}>
                    <span>
                      {it.qty}× {it.name_snapshot}
                    </span>
                    <span>₹{(it.price_snapshot * it.qty).toFixed(0)}</span>
                  </li>
                ))}
              </ul>
              <footer className="order-card-foot">
                <strong>₹{Number(o.total).toFixed(0)}</strong>
              </footer>
            </article>
          ))}
          {orders.length === 0 && !error && <p className="muted">Abhi koi order nahi</p>}
        </div>
      </div>
    </div>
  );
}
