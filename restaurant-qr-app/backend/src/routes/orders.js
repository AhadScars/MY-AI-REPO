import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRestaurant } from '../middleware/auth.js';
import { emitToRestaurant, emitToSession } from '../socket.js';

const router = Router();

function hydrateOrder(order) {
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(order.id);
  const table = db.prepare('SELECT table_number, code, label FROM tables WHERE id = ?').get(order.table_id);
  return { ...order, items, table };
}

router.get('/', requireAuth, requireRestaurant, (req, res) => {
  const { status, active } = req.query;
  let orders;
  if (active === '1' || active === 'true') {
    orders = db
      .prepare(
        `SELECT * FROM orders
         WHERE restaurant_id = ? AND status IN ('pending','accepted','preparing')
         ORDER BY created_at DESC`
      )
      .all(req.restaurant.id);
  } else if (status) {
    orders = db
      .prepare(
        `SELECT * FROM orders WHERE restaurant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 100`
      )
      .all(req.restaurant.id, status);
  } else {
    orders = db
      .prepare(
        `SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 100`
      )
      .all(req.restaurant.id);
  }
  res.json(orders.map(hydrateOrder));
});

router.patch('/:id/status', requireAuth, requireRestaurant, (req, res) => {
  const { status } = req.body || {};
  const allowed = ['pending', 'accepted', 'preparing', 'served', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.restaurant.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, order.id);

  const updated = hydrateOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id));
  emitToRestaurant(req.restaurant.id, 'order:updated', updated);
  emitToSession(order.session_id, 'order:updated', updated);
  res.json(updated);
});

export default router;
