import { Router } from 'express';
import crypto from 'crypto';
import { db, getOpenSessionForTable, closeExpiredSessions } from '../db.js';
import { emitToRestaurant, emitToSession } from '../socket.js';

const router = Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

function getTableBySlugCode(slug, code) {
  return db
    .prepare(
      `SELECT t.*, r.name as restaurant_name, r.slug, r.phone as restaurant_phone, r.address
       FROM tables t
       JOIN restaurants r ON r.id = t.restaurant_id
       WHERE r.slug = ? AND t.code = ?`
    )
    .get(slug, code.toUpperCase());
}

function hydrateOrder(order) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const table = db.prepare('SELECT table_number, code, label FROM tables WHERE id = ?').get(order.table_id);
  return { ...order, items, table };
}

// Public table status
router.get('/:slug/tables/:code', (req, res) => {
  closeExpiredSessions();
  const table = getTableBySlugCode(req.params.slug, req.params.code);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const session = getOpenSessionForTable(table.id);
  const canOrder = Boolean(session);

  res.json({
    restaurant: {
      name: table.restaurant_name,
      slug: table.slug,
      phone: table.restaurant_phone,
      address: table.address,
    },
    table: {
      id: table.id,
      table_number: table.table_number,
      code: table.code,
      label: table.label,
    },
    session: session
      ? {
          id: session.id,
          status: session.status,
          has_guest: Boolean(session.guest_phone),
          guest_name: session.guest_name ? session.guest_name[0] + '***' : null,
          expires_at: session.expires_at,
        }
      : null,
    canOrder,
    message: canOrder
      ? 'Table is active. Enter your name and phone to order.'
      : 'Table is free. Please ask the waiter to seat/activate your table.',
  });
});

// Join session (name + phone) — only if staff seated the table
router.post('/:slug/tables/:code/join', (req, res) => {
  closeExpiredSessions();
  const table = getTableBySlugCode(req.params.slug, req.params.code);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const session = getOpenSessionForTable(table.id);
  if (!session) {
    return res.status(403).json({
      error: 'Table not active',
      code: 'TABLE_FREE',
      message: 'Waiter se table activate / seat karwayein. Ghar se order nahi ho sakta.',
    });
  }

  const { name, phone } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'Valid name required (min 2 chars)' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'Valid 10-digit Indian mobile required' });
  }

  const phoneNorm = normalizePhone(phone);
  const nameTrim = String(name).trim();

  // If session already claimed by another phone, block
  if (session.guest_phone && session.guest_phone !== phoneNorm) {
    return res.status(403).json({
      error: 'Table already claimed',
      code: 'SESSION_CLAIMED',
      message: 'Is table pe pehle se guest active hai. Apna phone use karein ya waiter se poochein.',
    });
  }

  // Same phone rejoin — issue new token
  const guestToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(guestToken);

  db.prepare(
    `UPDATE table_sessions
     SET guest_name = ?, guest_phone = ?, guest_token_hash = ?, status = 'active'
     WHERE id = ?`
  ).run(nameTrim, phoneNorm, tokenHash, session.id);

  emitToRestaurant(table.restaurant_id, 'table:updated', {
    tableId: table.id,
    status: 'active',
    guest_name: nameTrim,
  });

  res.json({
    guestToken,
    sessionId: session.id,
    restaurant: { name: table.restaurant_name, slug: table.slug },
    table: {
      id: table.id,
      table_number: table.table_number,
      code: table.code,
      label: table.label,
    },
    guest: { name: nameTrim, phone: phoneNorm },
    expires_at: session.expires_at,
  });
});

// Public menu
router.get('/:slug/menu', (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

  const categories = db
    .prepare(
      'SELECT id, name, sort_order FROM menu_categories WHERE restaurant_id = ? ORDER BY sort_order, id'
    )
    .all(restaurant.id);
  const items = db
    .prepare(
      `SELECT id, category_id, name, description, price, is_available, sort_order
       FROM menu_items WHERE restaurant_id = ? AND is_available = 1
       ORDER BY sort_order, id`
    )
    .all(restaurant.id);

  res.json({
    restaurant: { name: restaurant.name, slug: restaurant.slug },
    categories,
    items,
  });
});

function requireGuest(req, res) {
  const token = req.headers['x-guest-token'];
  if (!token) {
    res.status(401).json({ error: 'Guest token required', code: 'NO_GUEST_TOKEN' });
    return null;
  }
  closeExpiredSessions();
  const hash = hashToken(token);
  const session = db
    .prepare(
      `SELECT * FROM table_sessions
       WHERE guest_token_hash = ? AND status IN ('seated', 'active')`
    )
    .get(hash);
  if (!session) {
    res.status(403).json({
      error: 'Session invalid or expired',
      code: 'SESSION_INVALID',
      message: 'Session band ho gayi. Waiter se table dubara seat karwayein.',
    });
    return null;
  }
  return session;
}

// Place order
router.post('/orders', (req, res) => {
  const session = requireGuest(req, res);
  if (!session) return;

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const prepared = [];
  let total = 0;
  for (const line of items) {
    const menuItem = db
      .prepare(
        `SELECT * FROM menu_items
         WHERE id = ? AND restaurant_id = ? AND is_available = 1`
      )
      .get(line.menu_item_id, session.restaurant_id);
    if (!menuItem) {
      return res.status(400).json({ error: `Invalid or unavailable item: ${line.menu_item_id}` });
    }
    const qty = Math.max(1, Math.min(20, Number(line.qty) || 1));
    prepared.push({
      menu_item_id: menuItem.id,
      name_snapshot: menuItem.name,
      price_snapshot: menuItem.price,
      qty,
      notes: line.notes ? String(line.notes).slice(0, 200) : null,
    });
    total += menuItem.price * qty;
  }

  const result = db
    .prepare(
      `INSERT INTO orders (restaurant_id, table_id, session_id, guest_name, guest_phone, status, total)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      session.restaurant_id,
      session.table_id,
      session.id,
      session.guest_name,
      session.guest_phone,
      total
    );

  const orderId = Number(result.lastInsertRowid);
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price_snapshot, qty, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const p of prepared) {
    insertItem.run(orderId, p.menu_item_id, p.name_snapshot, p.price_snapshot, p.qty, p.notes);
  }

  if (session.status === 'seated') {
    db.prepare(`UPDATE table_sessions SET status = 'active' WHERE id = ?`).run(session.id);
  }

  const order = hydrateOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));
  emitToRestaurant(session.restaurant_id, 'order:new', order);
  emitToSession(session.id, 'order:updated', order);

  res.status(201).json(order);
});

// My orders for this guest session
router.get('/orders/mine', (req, res) => {
  const session = requireGuest(req, res);
  if (!session) return;

  const orders = db
    .prepare(
      `SELECT * FROM orders WHERE session_id = ? ORDER BY created_at DESC`
    )
    .all(session.id)
    .map(hydrateOrder);

  res.json(orders);
});

export default router;
