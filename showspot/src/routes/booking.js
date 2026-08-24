const express = require('express');
const bookings = require('../lib/bookings');
const stripeLib = require('../lib/stripe');
const { requireAuth } = require('../lib/auth');
const util = require('../lib/util');
const qr = require('../lib/qr');

const router = express.Router();

router.post('/book/:showtimeId', requireAuth, async (req, res, next) => {
  try {
    const booking = await bookings.holdSeats(req.user, req.params.showtimeId, req.body.seats);
    res.redirect(`/book/${booking.id}/checkout`);
  } catch (e) {
    if (e.status && e.status < 500) {
      return res.redirect(`/book/${req.params.showtimeId}?error=${util.encodeFlash(e.message)}`);
    }
    next(e);
  }
});

router.get('/book/:id/checkout', requireAuth, async (req, res, next) => {
  try {
    const booking = await bookings.getBooking(req.params.id);
    if (!booking || booking.user_id !== req.user.id) {
      return res.status(404).render('error', { title: 'Not found', code: 404, message: 'Booking not found.' });
    }
    if (booking.status === 'confirmed') return res.redirect(`/book/${booking.id}/success`);
    if (booking.status !== 'held') {
      return res.status(410).render('error', {
        title: 'Hold expired',
        code: 410,
        message: 'Your seat hold expired. Pick seats again.',
      });
    }
    res.render('checkout', {
      title: 'Checkout',
      booking,
      stripeEnabled: stripeLib.enabled(),
      flash: util.flash(req),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/book/:id/pay', requireAuth, async (req, res, next) => {
  try {
    const booking = await bookings.getBooking(req.params.id);
    if (!booking || booking.user_id !== req.user.id) {
      return res.status(404).render('error', { title: 'Not found', code: 404, message: 'Booking not found.' });
    }
    if (booking.status === 'confirmed') return res.redirect(`/book/${booking.id}/success`);
    if (booking.status !== 'held') {
      return res.redirect(`/book/${booking.showtime_id}?error=${util.encodeFlash('Hold expired. Pick seats again.')}`);
    }

    if (req.body.method === 'demo' || !stripeLib.enabled()) {
      await bookings.confirmBooking(booking.id);
      return res.redirect(`/book/${booking.id}/success`);
    }

    const session = await stripeLib.createCheckout({
      booking: {
        ...booking,
        email: req.user.email,
        seats: booking.seats.map((s) => s.label),
      },
      show: { title: booking.title },
      venue: { name: booking.venue_name },
      showtime: booking,
    });
    await require('../db').query('UPDATE bookings SET stripe_session_id = ? WHERE id = ?', [session.id, booking.id]);
    res.redirect(session.url);
  } catch (e) {
    next(e);
  }
});

router.get('/book/:id/success', requireAuth, async (req, res, next) => {
  try {
    let booking = await bookings.getBooking(req.params.id);
    if (!booking || (booking.user_id !== req.user.id && req.user.role !== 'admin')) {
      return res.status(404).render('error', { title: 'Not found', code: 404, message: 'Booking not found.' });
    }
    if (booking.status === 'held' && req.query.session_id && stripeLib.enabled()) {
      const session = await stripeLib.retrieveSession(req.query.session_id);
      if (session && session.payment_status === 'paid') {
        booking = await bookings.confirmBooking(booking.id, {
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        });
      }
    }
    const qrSvg = booking.status === 'confirmed' ? await qr.ticketQrSvg(booking.booking_ref) : '';
    res.render('ticket', {
      title: booking.status === 'confirmed' ? 'Booking confirmed' : 'Payment pending',
      booking,
      qrSvg,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
