import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publicApi, getGuest, setGuest } from '../../api';

export default function TableEntry() {
  const { slug, code } = useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await publicApi.table(slug, code);
        if (cancelled) return;
        setInfo(data);

        // If already joined this table session, skip to menu
        const g = getGuest();
        if (g && g.slug === slug && g.code === code.toUpperCase() && g.guestToken && data.canOrder) {
          nav(`/t/${slug}/${code}/menu`, { replace: true });
          return;
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Table not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, code, nav]);

  const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(-10);

  const join = async (e) => {
    e.preventDefault();
    setError('');

    const phoneNorm = normalizePhone(phone);
    if (!/^[6-9]\d{9}$/.test(phoneNorm)) {
      setError('Sahi 10-digit mobile number likhein (jaise 9876543210). +91 bhi chalega.');
      return;
    }
    if (!name || String(name).trim().length < 2) {
      setError('Naam kam se kam 2 letters hona chahiye.');
      return;
    }

    setJoining(true);
    try {
      const data = await publicApi.join(slug, code, { name: name.trim(), phone: phoneNorm });
      setGuest({
        guestToken: data.guestToken,
        sessionId: data.sessionId,
        slug,
        code: code.toUpperCase(),
        guest: data.guest,
        table: data.table,
        restaurant: data.restaurant,
      });
      nav(`/t/${slug}/${code}/menu`);
    } catch (err) {
      setError(err.data?.message || err.message);
      // refresh table status
      try {
        setInfo(await publicApi.table(slug, code));
      } catch {
        /* ignore */
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="center-screen customer-bg">Loading table…</div>;

  if (!info && error) {
    return (
      <div className="center-screen customer-bg">
        <div className="customer-card">
          <h1>Table not found</h1>
          <p className="muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-bg">
      <div className="customer-card">
        <p className="eyebrow">{info.restaurant.name}</p>
        <h1>
          {info.table.label || `Table ${info.table.table_number}`}
        </h1>
        <p className="muted">Code {info.table.code}</p>

        {!info.canOrder ? (
          <div className="block-box">
            <div className="block-icon">🔒</div>
            <h2>Table not active yet</h2>
            <p>
              Waiter se bolo: <strong>“Table seat / activate kar do”</strong>
            </p>
            <p className="muted small">
              Yeh protection isliye hai taaki koi QR save karke ghar se order na kar sake.
            </p>
            <button
              className="btn btn-secondary btn-block mt"
              onClick={async () => {
                setLoading(true);
                try {
                  setInfo(await publicApi.table(slug, code));
                  setError('');
                } catch (e) {
                  setError(e.message);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Check again
            </button>
          </div>
        ) : (
          <form className="stack mt" onSubmit={join}>
            <p className="ok-line">✓ Table active — apna naam &amp; phone dein</p>
            {error && <div className="alert alert-error">{error}</div>}
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Aapka naam" />
            </label>
            <label>
              Phone
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  // Allow typing digits, spaces, +91 — strip mess as user types (keep last 12 chars of digits max for +91)
                  const raw = e.target.value.replace(/[^\d+\s-]/g, '');
                  setPhone(raw);
                }}
                required
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9876543210 ya +91 9876543210"
              />
            </label>
            <p className="muted small">10-digit Indian mobile (6–9 se start). Space / +91 allowed.</p>
            <button className="btn btn-primary btn-block" disabled={joining}>
              {joining ? 'Joining…' : 'Open menu & order'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
