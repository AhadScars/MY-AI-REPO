import { Router } from 'express';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { db, getOpenSessionForTable, padTableCode, closeExpiredSessions } from '../db.js';
import { requireAuth, requireRestaurant } from '../middleware/auth.js';
import { emitToRestaurant } from '../socket.js';

const router = Router();
const SESSION_MINUTES = Number(process.env.SESSION_MINUTES || 90);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function tableWithStatus(table) {
  const session = getOpenSessionForTable(table.id);
  return {
    ...table,
    status: session ? session.status : 'free',
    session: session
      ? {
          id: session.id,
          status: session.status,
          guest_name: session.guest_name,
          guest_phone: session.guest_phone,
          started_at: session.started_at,
          expires_at: session.expires_at,
        }
      : null,
    qrUrl: `${FRONTEND_URL}/t/${table.slug || ''}/${table.code}`,
  };
}

router.get('/', requireAuth, requireRestaurant, (req, res) => {
  closeExpiredSessions();
  const tables = db
    .prepare(
      `SELECT t.*, r.slug FROM tables t
       JOIN restaurants r ON r.id = t.restaurant_id
       WHERE t.restaurant_id = ?
       ORDER BY t.table_number ASC`
    )
    .all(req.restaurant.id)
    .map((t) => {
      const session = getOpenSessionForTable(t.id);
      return {
        id: t.id,
        restaurant_id: t.restaurant_id,
        table_number: t.table_number,
        code: t.code,
        label: t.label,
        created_at: t.created_at,
        status: session ? session.status : 'free',
        session: session
          ? {
              id: session.id,
              status: session.status,
              guest_name: session.guest_name,
              guest_phone: session.guest_phone,
              started_at: session.started_at,
              expires_at: session.expires_at,
            }
          : null,
        qrUrl: `${FRONTEND_URL}/t/${t.slug}/${t.code}`,
      };
    });
  res.json(tables);
});

router.post('/', requireAuth, requireRestaurant, (req, res) => {
  const { table_number, label } = req.body || {};
  let num = Number(table_number);
  if (!num || num < 1) {
    const max = db
      .prepare('SELECT COALESCE(MAX(table_number), 0) as m FROM tables WHERE restaurant_id = ?')
      .get(req.restaurant.id);
    num = max.m + 1;
  }
  const code = padTableCode(num);
  try {
    const result = db
      .prepare(
        'INSERT INTO tables (restaurant_id, table_number, code, label) VALUES (?, ?, ?, ?)'
      )
      .run(req.restaurant.id, num, code, label || `Table ${num}`);
    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(Number(result.lastInsertRowid));
    emitToRestaurant(req.restaurant.id, 'table:updated', { tableId: table.id });
    res.status(201).json({
      ...table,
      status: 'free',
      session: null,
      qrUrl: `${FRONTEND_URL}/t/${req.restaurant.slug}/${table.code}`,
    });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Table number already exists' });
    }
    throw e;
  }
});

router.delete('/:id', requireAuth, requireRestaurant, (req, res) => {
  const table = db
    .prepare('SELECT * FROM tables WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.restaurant.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  const open = getOpenSessionForTable(table.id);
  if (open) return res.status(400).json({ error: 'Close active session before deleting table' });
  db.prepare('DELETE FROM tables WHERE id = ?').run(table.id);
  res.json({ ok: true });
});

router.get('/:id/qr', requireAuth, requireRestaurant, async (req, res) => {
  const table = db
    .prepare(
      `SELECT t.*, r.slug FROM tables t
       JOIN restaurants r ON r.id = t.restaurant_id
       WHERE t.id = ? AND t.restaurant_id = ?`
    )
    .get(req.params.id, req.restaurant.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  const url = `${FRONTEND_URL}/t/${table.slug}/${table.code}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 });
  res.json({ url, dataUrl, table_number: table.table_number, code: table.code });
});

router.post('/:id/seat', requireAuth, requireRestaurant, (req, res) => {
  const table = db
    .prepare('SELECT * FROM tables WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.restaurant.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const open = getOpenSessionForTable(table.id);
  if (open) return res.status(400).json({ error: 'Table already has an active session' });

  const expires = new Date(Date.now() + SESSION_MINUTES * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  const result = db
    .prepare(
      `INSERT INTO table_sessions (restaurant_id, table_id, status, expires_at)
       VALUES (?, ?, 'seated', ?)`
    )
    .run(req.restaurant.id, table.id, expires);

  const session = db.prepare('SELECT * FROM table_sessions WHERE id = ?').get(Number(result.lastInsertRowid));
  emitToRestaurant(req.restaurant.id, 'table:updated', {
    tableId: table.id,
    status: 'seated',
    session,
  });
  res.status(201).json({
    message: 'Table seated — customer can now scan QR and order',
    session: {
      id: session.id,
      status: session.status,
      started_at: session.started_at,
      expires_at: session.expires_at,
    },
  });
});

router.post('/:id/close', requireAuth, requireRestaurant, (req, res) => {
  const table = db
    .prepare('SELECT * FROM tables WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.restaurant.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const open = getOpenSessionForTable(table.id);
  if (!open) return res.status(400).json({ error: 'No active session on this table' });

  db.prepare(
    `UPDATE table_sessions SET status = 'closed', closed_at = datetime('now') WHERE id = ?`
  ).run(open.id);

  // cancel pending orders for this session
  db.prepare(
    `UPDATE orders SET status = 'cancelled', updated_at = datetime('now')
     WHERE session_id = ? AND status = 'pending'`
  ).run(open.id);

  emitToRestaurant(req.restaurant.id, 'table:updated', {
    tableId: table.id,
    status: 'free',
    session: null,
  });
  emitToRestaurant(req.restaurant.id, 'order:updated', { sessionId: open.id });

  res.json({ message: 'Table closed — QR orders blocked until seated again', ok: true });
});

export default router;
