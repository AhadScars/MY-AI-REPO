import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRestaurant } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRestaurant, (req, res) => {
  res.json(req.restaurant);
});

router.put('/', requireAuth, requireRestaurant, (req, res) => {
  const { name, phone, address } = req.body || {};
  db.prepare(
    'UPDATE restaurants SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ?'
  ).run(name ?? null, phone ?? null, address ?? null, req.restaurant.id);
  const updated = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.restaurant.id);
  res.json(updated);
});

export default router;
