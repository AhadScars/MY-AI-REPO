import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const secret = process.env.JWT_SECRET || 'dev-secret';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    secret,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const payload = jwt.verify(token, secret);
    const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRestaurant(req, res, next) {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
  req.restaurant = restaurant;
  next();
}
