import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRestaurant } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRestaurant, (req, res) => {
  const categories = db
    .prepare(
      'SELECT * FROM menu_categories WHERE restaurant_id = ? ORDER BY sort_order, id'
    )
    .all(req.restaurant.id);
  const items = db
    .prepare(
      'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY sort_order, id'
    )
    .all(req.restaurant.id);
  res.json({ categories, items });
});

router.post('/categories', requireAuth, requireRestaurant, (req, res) => {
  const { name, sort_order } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db
    .prepare(
      'INSERT INTO menu_categories (restaurant_id, name, sort_order) VALUES (?, ?, ?)'
    )
    .run(req.restaurant.id, name, Number(sort_order) || 0);
  const cat = db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json(cat);
});

router.put('/categories/:id', requireAuth, requireRestaurant, (req, res) => {
  const cat = db
    .prepare('SELECT * FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.restaurant.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const { name, sort_order } = req.body || {};
  db.prepare(
    'UPDATE menu_categories SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?'
  ).run(name ?? null, sort_order != null ? Number(sort_order) : null, cat.id);
  res.json(db.prepare('SELECT * FROM menu_categories WHERE id = ?').get(cat.id));
});

router.delete('/categories/:id', requireAuth, requireRestaurant, (req, res) => {
  const cat = db
    .prepare('SELECT * FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.restaurant.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  db.prepare('DELETE FROM menu_items WHERE category_id = ?').run(cat.id);
  db.prepare('DELETE FROM menu_categories WHERE id = ?').run(cat.id);
  res.json({ ok: true });
});

router.post('/items', requireAuth, requireRestaurant, (req, res) => {
  const { category_id, name, description, price, is_available, sort_order } = req.body || {};
  if (!category_id || !name || price == null) {
    return res.status(400).json({ error: 'category_id, name, price required' });
  }
  const cat = db
    .prepare('SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(category_id, req.restaurant.id);
  if (!cat) return res.status(400).json({ error: 'Invalid category' });

  const result = db
    .prepare(
      `INSERT INTO menu_items (restaurant_id, category_id, name, description, price, is_available, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.restaurant.id,
      category_id,
      name,
      description || null,
      Number(price),
      is_available === false || is_available === 0 ? 0 : 1,
      Number(sort_order) || 0
    );
  res.status(201).json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(result.lastInsertRowid)));
});

router.put('/items/:id', requireAuth, requireRestaurant, (req, res) => {
  const item = db
    .prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.restaurant.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const { name, description, price, is_available, sort_order, category_id } = req.body || {};
  db.prepare(
    `UPDATE menu_items SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      is_available = COALESCE(?, is_available),
      sort_order = COALESCE(?, sort_order),
      category_id = COALESCE(?, category_id)
     WHERE id = ?`
  ).run(
    name ?? null,
    description ?? null,
    price != null ? Number(price) : null,
    is_available === undefined ? null : is_available ? 1 : 0,
    sort_order != null ? Number(sort_order) : null,
    category_id ?? null,
    item.id
  );
  res.json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.id));
});

router.delete('/items/:id', requireAuth, requireRestaurant, (req, res) => {
  const item = db
    .prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.restaurant.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

export default router;
