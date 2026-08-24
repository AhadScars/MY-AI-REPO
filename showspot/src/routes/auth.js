const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const auth = require('../lib/auth');
const util = require('../lib/util');

const router = express.Router();

function errorsOf(req) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;
  return result.array()[0].msg;
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', {
    title: 'Sign in',
    next: req.query.next || '/',
    flash: util.flash(req),
  });
});

router.post(
  '/login',
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res, next) => {
    try {
      const err = errorsOf(req);
      const nextUrl = req.body.next || '/';
      if (err) return res.redirect(`/login?next=${encodeURIComponent(nextUrl)}&error=${util.encodeFlash(err)}`);
      const user = await db.one('SELECT * FROM users WHERE email = ?', [req.body.email]);
      if (!user || !(await auth.checkPassword(req.body.password, user.password))) {
        return res.redirect(`/login?next=${encodeURIComponent(nextUrl)}&error=${util.encodeFlash('Email or password is wrong')}`);
      }
      if (user.status === 'suspended') {
        return res.redirect(`/login?error=${util.encodeFlash('This account is suspended')}`);
      }
      auth.setAuthCookie(res, user);
      if (user.role === 'admin') return res.redirect('/admin');
      if (user.role === 'organizer') return res.redirect('/manage');
      res.redirect(nextUrl.startsWith('/') ? nextUrl : '/');
    } catch (e) {
      next(e);
    }
  }
);

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/register', { title: 'Create account', flash: util.flash(req) });
});

router.post(
  '/register',
  body('name').trim().isLength({ min: 2 }).withMessage('Name is too short'),
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional({ checkFalsy: true }).trim(),
  async (req, res, next) => {
    try {
      const err = errorsOf(req);
      if (err) return res.redirect(`/register?error=${util.encodeFlash(err)}`);
      const exists = await db.one('SELECT id FROM users WHERE email = ?', [req.body.email]);
      if (exists) return res.redirect(`/register?error=${util.encodeFlash('That email is already registered')}`);
      const hash = await auth.hashPassword(req.body.password);
      const cityId = req.city ? req.city.id : null;
      const result = await db.query(
        `INSERT INTO users (name, email, password, phone, role, status, city_id)
         VALUES (?, ?, ?, ?, 'user', 'active', ?)`,
        [req.body.name, req.body.email, hash, req.body.phone || null, cityId]
      );
      const user = await db.one('SELECT * FROM users WHERE id = ?', [result.insertId]);
      auth.setAuthCookie(res, user);
      res.redirect('/?ok=' + util.encodeFlash('Welcome to ShowSpot'));
    } catch (e) {
      next(e);
    }
  }
);

router.post('/logout', (req, res) => {
  auth.clearAuthCookie(res);
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  auth.clearAuthCookie(res);
  res.redirect('/');
});

module.exports = router;
