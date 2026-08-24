const express = require('express');
const db = require('../db');
const { requireRole, hashPassword } = require('../lib/auth');
const { upload } = require('../lib/upload');
const util = require('../lib/util');
const bookings = require('../lib/bookings');
const theatre = require('../lib/theatre');

const router = express.Router();
router.use(requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const [[users], [shows], [venues], [bookCount], [revenue], recent] = await Promise.all([
      db.query(`SELECT COUNT(*) AS n FROM users`),
      db.query(`SELECT COUNT(*) AS n FROM shows`),
      db.query(`SELECT COUNT(*) AS n FROM venues`),
      db.query(`SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed'`),
      db.query(`SELECT COALESCE(SUM(total),0) AS n FROM bookings WHERE status = 'confirmed'`),
      db.query(
        `SELECT b.*, u.name AS user_name, s.title
         FROM bookings b
         JOIN users u ON u.id = b.user_id
         JOIN showtimes st ON st.id = b.showtime_id
         JOIN shows s ON s.id = st.show_id
         ORDER BY b.created_at DESC LIMIT 8`
      ),
    ]);
    const byType = await db.query(
      `SELECT s.type, COUNT(*) AS n FROM shows s GROUP BY s.type`
    );
    const pendingApps = await db.query(
      `SELECT a.*, u.name, u.email FROM organizer_applications a
       JOIN users u ON u.id = a.user_id WHERE a.status = 'pending' ORDER BY a.created_at DESC`
    );
    res.render('admin/dashboard', {
      title: 'Admin',
      stats: {
        users: users.n,
        shows: shows.n,
        venues: venues.n,
        bookings: bookCount.n,
        revenue: revenue.n,
      },
      byType,
      recent,
      pendingApps,
      flash: util.flash(req),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const rows = await db.query(
      `SELECT u.*, c.name AS city_name
       FROM users u LEFT JOIN cities c ON c.id = u.city_id
       WHERE (? = '' OR u.name LIKE ? OR u.email LIKE ?)
       ORDER BY u.created_at DESC LIMIT 200`,
      [q, `%${q}%`, `%${q}%`]
    );
    res.render('admin/users', { title: 'Users', users: rows, q, flash: util.flash(req) });
  } catch (e) {
    next(e);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email || !req.body.name || !req.body.password) {
      return res.redirect(`/admin/users?error=${util.encodeFlash('Name, email and password are required')}`);
    }
    const exists = await db.one('SELECT id FROM users WHERE email = ?', [email]);
    if (exists) return res.redirect(`/admin/users?error=${util.encodeFlash('Email already exists')}`);
    const hash = await hashPassword(req.body.password);
    await db.query(
      `INSERT INTO users (name, email, password, phone, role, status) VALUES (?, ?, ?, ?, ?, 'active')`,
      [req.body.name, email, hash, req.body.phone || null, req.body.role || 'user']
    );
    res.redirect(`/admin/users?ok=${util.encodeFlash('User created')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id && req.body.role && req.body.role !== 'admin') {
      return res.redirect(`/admin/users?error=${util.encodeFlash('You cannot demote yourself')}`);
    }
    if (req.body.action === 'delete') {
      if (id === req.user.id) return res.redirect(`/admin/users?error=${util.encodeFlash('You cannot delete yourself')}`);
      await db.query('DELETE FROM users WHERE id = ?', [id]);
      return res.redirect(`/admin/users?ok=${util.encodeFlash('User deleted')}`);
    }
    const fields = [];
    const params = [];
    if (req.body.role) {
      fields.push('role = ?');
      params.push(req.body.role);
    }
    if (req.body.status) {
      fields.push('status = ?');
      params.push(req.body.status);
    }
    if (req.body.password) {
      fields.push('password = ?');
      params.push(await hashPassword(req.body.password));
    }
    if (fields.length) {
      params.push(id);
      await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    res.redirect(`/admin/users?ok=${util.encodeFlash('User updated')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/applications/:id', async (req, res, next) => {
  try {
    const app = await db.one('SELECT * FROM organizer_applications WHERE id = ?', [req.params.id]);
    if (!app) return res.redirect('/admin');
    const status = req.body.status === 'approved' ? 'approved' : 'rejected';
    await db.query('UPDATE organizer_applications SET status = ? WHERE id = ?', [status, app.id]);
    if (status === 'approved') {
      await db.query(`UPDATE users SET role = 'organizer', status = 'active' WHERE id = ?`, [app.user_id]);
    }
    res.redirect(`/admin?ok=${util.encodeFlash('Application updated')}`);
  } catch (e) {
    next(e);
  }
});

router.get('/cities', async (req, res, next) => {
  try {
    const cities = await db.query('SELECT * FROM cities ORDER BY name');
    res.render('admin/cities', { title: 'Cities', cities, flash: util.flash(req) });
  } catch (e) {
    next(e);
  }
});

router.post('/cities', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.redirect(`/admin/cities?error=${util.encodeFlash('Name required')}`);
    const citySlug = await util.uniqueSlug(db, 'cities', name);
    await db.query('INSERT INTO cities (name, slug, state, is_active) VALUES (?, ?, ?, 1)', [
      name,
      citySlug,
      req.body.state || null,
    ]);
    res.redirect(`/admin/cities?ok=${util.encodeFlash('City added')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/cities/:id', async (req, res, next) => {
  try {
    if (req.body.action === 'delete') {
      await db.query('DELETE FROM cities WHERE id = ?', [req.params.id]);
    } else {
      await db.query('UPDATE cities SET name = ?, state = ?, is_active = ? WHERE id = ?', [
        req.body.name,
        req.body.state || null,
        req.body.is_active ? 1 : 0,
        req.params.id,
      ]);
    }
    res.redirect('/admin/cities');
  } catch (e) {
    next(e);
  }
});

router.get('/shows', async (req, res, next) => {
  try {
    const items = await db.query(
      `SELECT s.*, u.name AS organizer_name
       FROM shows s JOIN users u ON u.id = s.organizer_id
       ORDER BY s.created_at DESC`
    );
    const organizers = await db.query(`SELECT id, name FROM users WHERE role IN ('admin','organizer') ORDER BY name`);
    res.render('admin/shows', { title: 'Shows', items, organizers, flash: util.flash(req) });
  } catch (e) {
    next(e);
  }
});

router.post('/shows', upload.single('poster'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) return res.redirect(`/admin/shows?error=${util.encodeFlash('Title required')}`);
    const showSlug = await util.uniqueSlug(db, 'shows', title);
    const poster = req.file ? `/uploads/${req.file.filename}` : req.body.poster_url || null;
    await db.query(
      `INSERT INTO shows (organizer_id, type, title, slug, synopsis, language, genre, duration_min, age_rating, poster, release_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.organizer_id || req.user.id,
        req.body.type || 'movie',
        title,
        showSlug,
        req.body.synopsis || null,
        req.body.language || null,
        req.body.genre || null,
        req.body.duration_min || null,
        req.body.age_rating || null,
        poster,
        req.body.release_date || null,
        req.body.status || 'published',
      ]
    );
    res.redirect(`/admin/shows?ok=${util.encodeFlash('Show created')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/shows/:id', upload.single('poster'), async (req, res, next) => {
  try {
    if (req.body.action === 'delete') {
      await db.query('DELETE FROM shows WHERE id = ?', [req.params.id]);
      return res.redirect(`/admin/shows?ok=${util.encodeFlash('Show deleted')}`);
    }
    const current = await db.one('SELECT * FROM shows WHERE id = ?', [req.params.id]);
    if (!current) return res.redirect('/admin/shows');
    const poster = req.file ? `/uploads/${req.file.filename}` : current.poster;
    await db.query(
      `UPDATE shows SET title=?, type=?, synopsis=?, language=?, genre=?, duration_min=?, age_rating=?, poster=?, release_date=?, status=?, organizer_id=?
       WHERE id=?`,
      [
        req.body.title,
        req.body.type,
        req.body.synopsis || null,
        req.body.language || null,
        req.body.genre || null,
        req.body.duration_min || null,
        req.body.age_rating || null,
        poster,
        req.body.release_date || null,
        req.body.status,
        req.body.organizer_id || current.organizer_id,
        req.params.id,
      ]
    );
    res.redirect(`/admin/shows?ok=${util.encodeFlash('Show updated')}`);
  } catch (e) {
    next(e);
  }
});

router.get('/venues', async (req, res, next) => {
  try {
    const venues = await db.query(
      `SELECT v.*, c.name AS city_name, u.name AS organizer_name,
              (SELECT COUNT(*) FROM screens sc WHERE sc.venue_id = v.id) AS screen_count
       FROM venues v
       JOIN cities c ON c.id = v.city_id
       JOIN users u ON u.id = v.organizer_id
       ORDER BY v.name`
    );
    const organizers = await db.query(`SELECT id, name FROM users WHERE role IN ('admin','organizer') ORDER BY name`);
    res.render('admin/venues', { title: 'Venues', venues, organizers, flash: util.flash(req) });
  } catch (e) {
    next(e);
  }
});

router.post('/venues', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name || !req.body.city_id) {
      return res.redirect(`/admin/venues?error=${util.encodeFlash('Name and city are required')}`);
    }
    const ownerId = req.body.organizer_id || req.user.id;
    try {
      await theatre.assertOneTheatre(ownerId);
    } catch (err) {
      return res.redirect(`/admin/venues?error=${util.encodeFlash(err.message)}`);
    }
    const vSlug = await util.uniqueSlug(db, 'venues', name);
    const amenities = String(req.body.amenities || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await db.query(
      `INSERT INTO venues (organizer_id, city_id, name, slug, address, amenities, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [ownerId, req.body.city_id, name, vSlug, req.body.address || null, JSON.stringify(amenities)]
    );
    const rows = Number(req.body.row_count) || 10;
    const cols = Number(req.body.col_count) || 14;
    const screens = Number(req.body.screens) || 1;
    for (let i = 1; i <= screens; i++) {
      await db.query('INSERT INTO screens (venue_id, name, row_count, col_count) VALUES (?, ?, ?, ?)', [
        result.insertId,
        `Audi ${i}`,
        rows,
        cols,
      ]);
    }
    res.redirect(`/admin/venues?ok=${util.encodeFlash('Venue created')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/venues/:id', async (req, res, next) => {
  try {
    if (req.body.action === 'delete') {
      await db.query('DELETE FROM venues WHERE id = ?', [req.params.id]);
      return res.redirect(`/admin/venues?ok=${util.encodeFlash('Theatre deleted')}`);
    }
    try {
      await theatre.assertOneTheatre(req.body.organizer_id, req.params.id);
    } catch (err) {
      return res.redirect(`/admin/venues?error=${util.encodeFlash(err.message)}`);
    }
    const amenities = String(req.body.amenities || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await db.query(
      `UPDATE venues SET name=?, city_id=?, address=?, amenities=?, status=?, organizer_id=? WHERE id=?`,
      [
        req.body.name,
        req.body.city_id,
        req.body.address || null,
        JSON.stringify(amenities),
        req.body.status || 'active',
        req.body.organizer_id,
        req.params.id,
      ]
    );
    res.redirect(`/admin/venues?ok=${util.encodeFlash('Venue updated')}`);
  } catch (e) {
    next(e);
  }
});

router.get('/showtimes', async (req, res, next) => {
  try {
    const rows = await db.query(
      `${bookings.SHOWTIME_SELECT} ORDER BY st.starts_at DESC LIMIT 200`
    );
    const shows = await db.query('SELECT id, title FROM shows ORDER BY title');
    const venues = await db.query(
      `SELECT v.id, v.name, c.name AS city_name FROM venues v JOIN cities c ON c.id = v.city_id ORDER BY v.name`
    );
    const screens = await db.query(
      `SELECT sc.id, sc.name, sc.venue_id, v.name AS venue_name
       FROM screens sc JOIN venues v ON v.id = sc.venue_id ORDER BY v.name, sc.name`
    );
    res.render('admin/showtimes', {
      title: 'Showtimes',
      rows,
      shows,
      venues,
      screens,
      flash: util.flash(req),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/showtimes', async (req, res, next) => {
  try {
    await db.query(
      `INSERT INTO showtimes (show_id, venue_id, screen_id, starts_at, price_regular, price_premium, price_vip, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [
        req.body.show_id,
        req.body.venue_id,
        req.body.screen_id,
        req.body.starts_at.replace('T', ' '),
        req.body.price_regular || 8,
        req.body.price_premium || 12,
        req.body.price_vip || 18,
      ]
    );
    res.redirect(`/admin/showtimes?ok=${util.encodeFlash('Showtime added')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/showtimes/:id', async (req, res, next) => {
  try {
    if (req.body.action === 'delete') {
      await db.query('DELETE FROM showtimes WHERE id = ?', [req.params.id]);
    } else {
      await db.query(
        `UPDATE showtimes SET starts_at=?, price_regular=?, price_premium=?, price_vip=?, status=? WHERE id=?`,
        [
          String(req.body.starts_at).replace('T', ' '),
          req.body.price_regular,
          req.body.price_premium,
          req.body.price_vip,
          req.body.status,
          req.params.id,
        ]
      );
    }
    res.redirect('/admin/showtimes');
  } catch (e) {
    next(e);
  }
});

router.get('/bookings', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const rows = await db.query(
      `SELECT b.*, u.name AS user_name, u.email, s.title, st.starts_at, v.name AS venue_name
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN showtimes st ON st.id = b.showtime_id
       JOIN shows s ON s.id = st.show_id
       JOIN venues v ON v.id = st.venue_id
       WHERE (? = '' OR b.booking_ref LIKE ? OR u.email LIKE ? OR s.title LIKE ?)
       ORDER BY b.created_at DESC LIMIT 200`,
      [q, `%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.render('admin/bookings', { title: 'Bookings', rows, q, flash: util.flash(req) });
  } catch (e) {
    next(e);
  }
});

router.post('/bookings/:id/cancel', async (req, res, next) => {
  try {
    await bookings.cancelBooking(req.params.id, req.user);
    res.redirect(`/admin/bookings?ok=${util.encodeFlash('Booking cancelled')}`);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
