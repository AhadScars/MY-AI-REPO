import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'restaurant';
}

router.post('/register', (req, res) => {
  try {
    const { name, email, password, restaurantName, phone, address } = req.body || {};
    if (!name || !email || !password || !restaurantName) {
      return res.status(400).json({ error: 'name, email, password, restaurantName required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password min 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    let slug = slugify(restaurantName);
    let i = 1;
    while (db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(slug)) {
      slug = `${slugify(restaurantName)}-${i++}`;
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const insertUser = db.prepare(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    );
    const userResult = insertUser.run(name, String(email).toLowerCase(), password_hash);
    const userId = Number(userResult.lastInsertRowid);

    db.prepare(
      'INSERT INTO restaurants (owner_id, name, slug, phone, address) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, restaurantName, slug, phone || null, address || null);

    const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(userId);
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(userId);
    const token = signToken(user);

    res.status(201).json({ token, user, restaurant });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = { id: row.id, name: row.name, email: row.email, created_at: row.created_at };
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(row.id);
    res.json({ token: signToken(user), user, restaurant });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(req.user.id);
  res.json({ user: req.user, restaurant });
});

export default router;
