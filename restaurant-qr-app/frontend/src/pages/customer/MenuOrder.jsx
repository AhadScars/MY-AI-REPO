import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { publicApi, getGuest, setGuest } from '../../api';

export default function MenuOrder() {
  const { slug, code } = useParams();
  const nav = useNavigate();
  const guest = getGuest();
  const [menu, setMenu] = useState(null);
  const [cart, setCart] = useState({});
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (!guest?.guestToken || guest.slug !== slug || guest.code !== code.toUpperCase()) {
      nav(`/t/${slug}/${code}`, { replace: true });
      return;
    }
    publicApi
      .menu(slug)
      .then(setMenu)
      .catch((e) => setError(e.message));
  }, [slug, code, nav]); // eslint-disable-line

  const lines = useMemo(() => {
    if (!menu) return [];
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = menu.items.find((i) => String(i.id) === String(id));
        return item ? { item, qty } : null;
      })
      .filter(Boolean);
  }, [cart, menu]);

  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);

  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const sub = (id) =>
    setCart((c) => {
      const n = (c[id] || 0) - 1;
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });

  const place = async () => {
    if (!lines.length) return;
    setPlacing(true);
    setError('');
    setOk('');
    try {
      await publicApi.placeOrder(
        guest.guestToken,
        lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty }))
      );
      setCart({});
      setOk('Order bhej diya! Kitchen me notification chala gaya.');
    } catch (e) {
      setError(e.data?.message || e.message);
      if (e.data?.code === 'SESSION_INVALID' || e.status === 403) {
        setGuest(null);
        setTimeout(() => nav(`/t/${slug}/${code}`), 1500);
      }
    } finally {
      setPlacing(false);
    }
  };

  if (!menu && !error) return <div className="center-screen customer-bg">Loading menu…</div>;

  return (
    <div className="customer-bg customer-menu-page">
      <header className="customer-top">
        <div>
          <p className="eyebrow">{menu?.restaurant?.name || guest?.restaurant?.name}</p>
          <h1>Menu</h1>
          <p className="muted small">
            Table {guest?.table?.table_number} · {guest?.guest?.name}
          </p>
        </div>
        <Link className="btn btn-secondary btn-sm" to={`/t/${slug}/${code}/orders`}>
          My orders
        </Link>
      </header>

      {error && <div className="alert alert-error mx">{error}</div>}
      {ok && <div className="alert alert-ok mx">{ok}</div>}

      <div className="customer-menu">
        {menu?.categories.map((cat) => {
          const catItems = menu.items.filter((i) => i.category_id === cat.id);
          if (!catItems.length) return null;
          return (
            <section key={cat.id}>
              <h2 className="section-title">{cat.name}</h2>
              <div className="stack gap-sm">
                {catItems.map((item) => (
                  <article key={item.id} className="menu-item-row">
                    <div>
                      <strong>{item.name}</strong>
                      {item.description && <p className="muted small">{item.description}</p>}
                      <div className="price">₹{item.price}</div>
                    </div>
                    <div className="qty-ctrl">
                      {cart[item.id] ? (
                        <>
                          <button type="button" onClick={() => sub(item.id)}>
                            −
                          </button>
                          <span>{cart[item.id]}</span>
                          <button type="button" onClick={() => add(item.id)}>
                            +
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add(item.id)}>
                          Add
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {lines.length > 0 && (
        <div className="cart-bar">
          <div>
            <strong>{lines.reduce((s, l) => s + l.qty, 0)} items</strong>
            <div>₹{total.toFixed(0)}</div>
          </div>
          <button className="btn btn-primary" disabled={placing} onClick={place}>
            {placing ? 'Sending…' : 'Place order'}
          </button>
        </div>
      )}
    </div>
  );
}
