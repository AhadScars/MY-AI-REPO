const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const db = require('./db');
const util = require('./lib/util');
const { loadUser } = require('./lib/auth');
const bookings = require('./lib/bookings');
const stripeLib = require('./lib/stripe');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/booking');
const accountRoutes = require('./routes/account');
const adminRoutes = require('./routes/admin');
const organizerRoutes = require('./routes/organizer');

function createApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('trust proxy', 1);

  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = stripeLib.stripeClient();
    if (!stripe) return res.status(400).send('Stripe off');
    let event = req.body;
    if (config.stripe.webhook) {
      try {
        event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhook);
      } catch (err) {
        return res.status(400).send(`Webhook error: ${err.message}`);
      }
    } else if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString('utf8'));
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata && session.metadata.booking_id;
      if (bookingId) {
        await bookings.confirmBooking(bookingId, {
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        });
      }
    }
    res.json({ received: true });
  });

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(loadUser);

  app.use(async (req, res, next) => {
    try {
      const cities = await db.query('SELECT * FROM cities WHERE is_active = 1 ORDER BY name');
      const slug =
        (req.cookies && req.cookies.showspot_city) ||
        (req.user && req.user.city_id && (cities.find((c) => c.id === req.user.city_id) || {}).slug) ||
        ((cities.find((c) => c.slug === 'kanpur') || cities.find((c) => c.slug === 'mumbai') || cities[0] || {}).slug);
      req.cities = cities;
      req.city = cities.find((c) => c.slug === slug) || cities[0] || null;
      res.locals.appName = config.appName;
      res.locals.config = config;
      res.locals.user = req.user;
      res.locals.cities = cities;
      res.locals.city = req.city;
      res.locals.money = util.money;
      res.locals.formatDate = util.formatDate;
      res.locals.formatTime = util.formatTime;
      res.locals.formatDateTime = util.formatDateTime;
      res.locals.toInputDate = util.toInputDate;
      res.locals.toInputDateTime = util.toInputDateTime;
      res.locals.typeLabel = util.typeLabel;
      res.locals.typeSingular = util.typeSingular;
      res.locals.initials = util.initials;
      res.locals.posterUrl = util.posterUrl;
      res.locals.bannerUrl = util.bannerUrl;
      res.locals.parseJson = util.parseJson;
      res.locals.stripeEnabled = stripeLib.enabled();
      res.locals.taxLabel = config.currency === 'inr' ? `GST (${config.taxPercent}%)` : 'Tax';
      res.locals.currentPath = req.path;
      res.locals.query = req.query;
      next();
    } catch (err) {
      next(err);
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, app: config.appName, stripe: stripeLib.enabled() });
  });

  app.use(publicRoutes);
  app.use(authRoutes);
  app.use(bookingRoutes);
  app.use(accountRoutes);
  app.use('/admin', adminRoutes);
  app.use('/manage', organizerRoutes);

  app.use((req, res) => {
    res.status(404).render('error', {
      title: 'Not found',
      code: 404,
      message: 'That page is not on the marquee.',
    });
  });

  app.use((err, req, res, _next) => {
    console.error(err);
    const status = err.status || 500;
    if (req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(status).json({ error: err.message || 'Server error' });
    }
    res.status(status).render('error', {
      title: 'Something broke',
      code: status,
      message: config.env === 'production' ? 'Please try again in a moment.' : err.message,
    });
  });

  return app;
}

function startCleanup() {
  bookings.expireHolds().catch(() => {});
  setInterval(() => {
    bookings.expireHolds().catch((err) => console.error('hold cleanup', err.message));
  }, 60 * 1000);
}

module.exports = { createApp, startCleanup };
