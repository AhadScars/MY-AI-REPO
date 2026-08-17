import { useEffect, useState, useCallback } from 'react';
import { tablesApi } from '../../api';
import { joinRestaurant } from '../../socket';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function Tables({ restaurant }) {
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');
  const [qrModal, setQrModal] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setTables(await tablesApi.list());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const s = joinRestaurant(restaurant.id);
    const onUpd = () => load();
    s.on('table:updated', onUpd);
    return () => s.off('table:updated', onUpd);
  }, [restaurant?.id, load]);

  const addTable = async () => {
    setBusy('add');
    try {
      await tablesApi.create({});
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const seat = async (id) => {
    setBusy(id);
    try {
      await tablesApi.seat(id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const close = async (id) => {
    if (!confirm('Close table? Guest will not be able to place new orders.')) return;
    setBusy(id);
    try {
      await tablesApi.close(id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const showQr = async (id) => {
    setBusy(id);
    try {
      const data = await tablesApi.qr(id);
      setQrModal(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this table?')) return;
    try {
      await tablesApi.remove(id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tables &amp; QR</h1>
          <p className="muted">
            <strong>Seat</strong> when guest arrives · <strong>Close</strong> when bill done.
            QR is permanent — ordering only works while seated.
          </p>
        </div>
        <button className="btn btn-primary" onClick={addTable} disabled={busy === 'add'}>
          + Add table
        </button>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="info-box">
        <strong>Anti-home-order:</strong> Guest QR save karke ghar se order nahi kar sakta jab tak aap
        dashboard se table <em>Seat</em> na karein. Meal ke baad <em>Close</em> kar dein.
      </div>

      <div className="cards-grid tables-grid">
        {tables.map((t) => (
          <article key={t.id} className="table-card">
            <header className="table-card-head">
              <div>
                <h3>{t.label || `Table ${t.table_number}`}</h3>
                <span className="muted small">{t.code}</span>
              </div>
              <StatusBadge status={t.status} />
            </header>
            {t.session?.guest_name && (
              <p className="guest-line">
                👤 {t.session.guest_name} · {t.session.guest_phone}
              </p>
            )}
            {t.session && (
              <p className="muted small">Expires: {t.session.expires_at}</p>
            )}
            <div className="row gap wrap mt">
              {t.status === 'free' ? (
                <button className="btn btn-primary btn-sm" disabled={busy === t.id} onClick={() => seat(t.id)}>
                  Seat table
                </button>
              ) : (
                <button className="btn btn-danger btn-sm" disabled={busy === t.id} onClick={() => close(t.id)}>
                  Close table
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => showQr(t.id)}>
                Show QR
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(t.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      {qrModal && (
        <div className="modal-backdrop" onClick={() => setQrModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Table {qrModal.table_number} · {qrModal.code}</h2>
            <img src={qrModal.dataUrl} alt="QR code" className="qr-img" />
            <p className="mono small break">{qrModal.url}</p>
            <p className="muted small">Print this QR and put on the table. No need to reprint when seating.</p>
            <div className="row gap">
              <a className="btn btn-primary" href={qrModal.dataUrl} download={`table-${qrModal.code}.png`}>
                Download PNG
              </a>
              <button className="btn btn-ghost" onClick={() => setQrModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
