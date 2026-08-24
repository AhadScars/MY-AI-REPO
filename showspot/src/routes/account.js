const express = require('express');
const db = require('../db');
const { requireAuth, hashPassword, checkPassword } = require('../lib/auth');
const bookings = require('../lib/bookings');
const util = require('../lib/util');
const qr = require('../lib/qr');

const router = express.Router();

router.use(requireAuth);

router.get('/account', async (req, res, next) => {
  try {
    const mine = await db.query(
      `SELECT b.*, s.title, s.poster, s.slug AS show_slug, st.starts_at, v.name AS venue_name, c.name AS city_name
       FROM bookings b
       JOIN showtimes st ON st.id = b.showtime_id
       JOIN shows s ON s.id = st.show_id
       JOIN venues v ON v.id = st.venue_id
       JOIN cities c ON c.id = v.city_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const application = await db.one(
      `SELECT * FROM organizer_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );
    res.render('account/index', {
      title: 'My account',
      bookings: mine,
      application,
      flash: util.flash(req),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/account/bookings/:id', async (req, res, next) => {
  try {
    const booking = await bookings.getBooking(req.params.id);
    if (!booking || (booking.user_id !== req.user.id && req.user.role !== 'admin')) {
      return res.status(404).render('error', { title: 'Not found', code: 404, message: 'Booking not found.' });
    }
    const qrSvg = booking.status === 'confirmed' ? await qr.ticketQrSvg(booking.booking_ref) : '';
    res.render('ticket', { title: `Ticket ${booking.booking_ref}`, booking, qrSvg });
  } catch (e) {
    next(e);
  }
});

router.post('/account/bookings/:id/cancel', async (req, res, next) => {
  try {
    const booking = await bookings.getBooking(req.params.id);
    if (!booking) return res.redirect('/account');
    if (booking.status === 'confirmed' && new Date(booking.starts_at) < new Date()) {
      return res.redirect(`/account?error=${util.encodeFlash('This show has already started')}`);
    }
    await bookings.cancelBooking(req.params.id, req.user);
    res.redirect(`/account?ok=${util.encodeFlash('Booking cancelled')}`);
  } catch (e) {
    if (e.status) return res.redirect(`/account?error=${util.encodeFlash(e.message)}`);
    next(e);
  }
});

router.post('/account/profile', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (name.length < 2) return res.redirect(`/account?error=${util.encodeFlash('Name is too short')}`);
    const cityId = req.body.city_id ? Number(req.body.city_id) : null;
    await db.query('UPDATE users SET name = ?, phone = ?, city_id = ? WHERE id = ?', [
      name,
      phone || null,
      cityId || null,
      req.user.id,
    ]);
    res.redirect(`/account?ok=${util.encodeFlash('Profile updated')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/account/password', async (req, res, next) => {
  try {
    const user = await db.one('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!(await checkPassword(req.body.current || '', user.password))) {
      return res.redirect(`/account?error=${util.encodeFlash('Current password is wrong')}`);
    }
    if (!req.body.next || req.body.next.length < 6) {
      return res.redirect(`/account?error=${util.encodeFlash('New password must be at least 6 characters')}`);
    }
    const hash = await hashPassword(req.body.next);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
    res.redirect(`/account?ok=${util.encodeFlash('Password changed')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/account/apply-organizer', async (req, res, next) => {
  try {
    if (req.user.role !== 'user') return res.redirect('/account');
    const pending = await db.one(
      `SELECT id FROM organizer_applications WHERE user_id = ? AND status = 'pending'`,
      [req.user.id]
    );
    if (pending) return res.redirect(`/account?error=${util.encodeFlash('You already have a pending application')}`);
    await db.query(
      `INSERT INTO organizer_applications (user_id, company, message) VALUES (?, ?, ?)`,
      [req.user.id, String(req.body.company || '').slice(0, 160), String(req.body.message || '').slice(0, 800)]
    );
    res.redirect(`/account?ok=${util.encodeFlash('Application sent. An admin will review it.')}`);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
