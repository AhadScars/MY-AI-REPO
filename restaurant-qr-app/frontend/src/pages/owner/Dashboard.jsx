import { useEffect, useState, useCallback, useRef } from 'react';
import { ordersApi } from '../../api';
import { joinRestaurant } from '../../socket';
import OrderCard from '../../components/OrderCard.jsx';

export default function Dashboard({ restaurant }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const audioCtx = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await ordersApi.list('?active=1');
      setOrders(data);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const beep = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.start();
      setTimeout(() => o.stop(), 180);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const s = joinRestaurant(restaurant.id);
    const onNew = (order) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [order, ...prev];
      });
      setFlash(`New order · Table ${order.table?.table_number ?? '?'} · #${order.id}`);
      beep();
      setTimeout(() => setFlash(''), 4000);
    };
    const onUpd = (order) => {
      if (!order?.id) {
        load();
        return;
      }
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === order.id ? order : o));
        if (['served', 'cancelled'].includes(order.status)) {
          return next.filter((o) => o.id !== order.id);
        }
        if (!next.some((o) => o.id === order.id) && ['pending', 'accepted', 'preparing'].includes(order.status)) {
          return [order, ...next];
        }
        return next;
      });
    };
    s.on('order:new', onNew);
    s.on('order:updated', onUpd);
    return () => {
      s.off('order:new', onNew);
      s.off('order:updated', onUpd);
    };
  }, [restaurant?.id, load]);

  const setStatus = async (id, status) => {
    try {
      const updated = await ordersApi.setStatus(id, status);
      setOrders((prev) => {
        if (['served', 'cancelled'].includes(updated.status)) {
          return prev.filter((o) => o.id !== id);
        }
        return prev.map((o) => (o.id === id ? updated : o));
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const pending = orders.filter((o) => o.status === 'pending');
  const rest = orders.filter((o) => o.status !== 'pending');

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Live orders</h1>
          <p className="muted">Real-time kitchen feed — seat tables before guests can order</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {flash && <div className="alert alert-ok">{flash}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <section className="stats-row">
        <div className="stat">
          <span>Pending</span>
          <strong>{pending.length}</strong>
        </div>
        <div className="stat">
          <span>In kitchen</span>
          <strong>{rest.length}</strong>
        </div>
      </section>

      {orders.length === 0 ? (
        <div className="empty-state">
          <h3>No active orders</h3>
          <p>Seat a table from Tables &amp; QR, then guest scans and orders.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mb">
              <h2 className="section-title">New · needs accept</h2>
              <div className="cards-grid">
                {pending.map((o) => (
                  <OrderCard key={o.id} order={o} onStatus={setStatus} />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <h2 className="section-title">In progress</h2>
              <div className="cards-grid">
                {rest.map((o) => (
                  <OrderCard key={o.id} order={o} onStatus={setStatus} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
