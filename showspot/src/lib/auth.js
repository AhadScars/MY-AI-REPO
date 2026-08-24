const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('../db');

const COOKIE = 'showspot_token';

function sign(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, user) {
  const token = sign(user);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function readToken(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

async function loadUser(req, res, next) {
  req.user = null;
  const payload = readToken(req);
  if (!payload) return next();
  try {
    const user = await db.one(
      'SELECT id, name, email, phone, role, status, city_id, avatar, created_at FROM users WHERE id = ?',
      [payload.id]
    );
    if (user && user.status !== 'suspended') req.user = user;
  } catch (err) {
    return next(err);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(401).json({ error: 'Please sign in' });
    }
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${nextUrl}`);
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      const nextUrl = encodeURIComponent(req.originalUrl);
      return res.redirect(`/login?next=${nextUrl}`);
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('error', {
        title: 'Not allowed',
        code: 403,
        message: 'You do not have access to this area.',
      });
    }
    if (req.user.role === 'organizer' && req.user.status === 'pending') {
      return res.status(403).render('error', {
        title: 'Pending approval',
        code: 403,
        message: 'Your organizer account is waiting for admin approval.',
      });
    }
    next();
  };
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function checkPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

module.exports = {
  COOKIE,
  sign,
  setAuthCookie,
  clearAuthCookie,
  loadUser,
  requireAuth,
  requireRole,
  hashPassword,
  checkPassword,
};
