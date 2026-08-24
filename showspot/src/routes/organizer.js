const express = require('express');
const db = require('../db');
const { requireRole } = require('../lib/auth');
const { upload } = require('../lib/upload');
const util = require('../lib/util');
const bookings = require('../lib/bookings');
const theatre = require('../lib/theatre');
const qr = require('../lib/qr');

const router = express.Router();
router.use(requireRole('organizer', 'admin'));

function ownerClause(user) {
  if (user.role === 'admin') return { sql: '1=1', params: [] };
  return { sql: 'organizer_id = ?', params: [user.id] };
}

router.get('/', async (req, res, next) => {
  try {
    const orgFilter = req.user.role === 'admin' ? '' : 'AND s.organizer_id = ?';
    const params = req.user.role === 'admin' ? [] : [req.user.id];
    const shows = await db.query(`SELECT COUNT(*) AS n FROM shows s WHERE 1=1 ${orgFilter}`, params);
    const venues = await db.query(
      `SELECT COUNT(*) AS n FROM venues v WHERE 1=1 ${req.user.role === 'admin' ? '' : 'AND v.organizer_id = ?'}`,
      params
    );
    const salesFilter = req.user.role === 'admin' ? '' : 'AND v.organizer_id = ?';
    const sales = await db.query(
      `SELECT COUNT(*) AS tickets, COALESCE(SUM(b.total),0) AS revenue
       FROM bookings b
       JOIN showtimes st ON st.id = b.showtime_id
       JOIN venues v ON v.id = st.venue_id
       WHERE b.status = 'confirmed' ${salesFilter}`,
      params
    );
    const upcoming = await db.query(
      `${bookings.SHOWTIME_SELECT}
       WHERE st.starts_at > UTC_TIMESTAMP() ${req.user.role === 'admin' ? '' : 'AND v.organizer_id = ?'}
       ORDER BY st.starts_at ASC LIMIT 8`,
      params
    );
    res.render('organizer/dashboard', {
      title: 'Organizer',
      stats: {
        shows: shows[0].n,
        venues: venues[0].n,
        tickets: sales[0].tickets,
        revenue: sales[0].revenue,
      },
      upcoming,
      flash: util.flash(req),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/shows', async (req, res, next) => {
  try {
    const own = ownerClause(req.user);
    const items = await db.query(`SELECT * FROM shows WHERE ${own.sql} ORDER BY created_at DESC`, own.params);
    res.render('organizer/shows', { title: 'My shows', items, flash: util.flash(req) });
  } catch (e) {
    next(e);
  }
});

router.post('/shows', upload.single('poster'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) return res.redirect(`/manage/shows?error=${util.encodeFlash('Title required')}`);
    const showSlug = await util.uniqueSlug(db, 'shows', title);
    const poster = req.file ? `/uploads/${req.file.filename}` : req.body.poster_url || null;
    await db.query(
      `INSERT INTO shows (organizer_id, type, title, slug, synopsis, language, genre, duration_min, age_rating, poster, release_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.role === 'admin' && req.body.organizer_id ? req.body.organizer_id : req.user.id,
        req.body.type || 'event',
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
    res.redirect(`/manage/shows?ok=${util.encodeFlash('Show created')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/shows/:id', upload.single('poster'), async (req, res, next) => {
  try {
    const own = ownerClause(req.user);
    const current = await db.one(`SELECT * FROM shows WHERE id = ? AND ${own.sql}`, [req.params.id, ...own.params]);
    if (!current) return res.redirect('/manage/shows');
    if (req.body.action === 'delete') {
      await db.query('DELETE FROM shows WHERE id = ?', [current.id]);
      return res.redirect(`/manage/shows?ok=${util.encodeFlash('Deleted')}`);
    }
    const poster = req.file ? `/uploads/${req.file.filename}` : current.poster;
    await db.query(
      `UPDATE shows SET title=?, type=?, synopsis=?, language=?, genre=?, duration_min=?, age_rating=?, poster=?, release_date=?, status=?
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
        current.id,
      ]
    );
    res.redirect(`/manage/shows?ok=${util.encodeFlash('Updated')}`);
  } catch (e) {
    next(e);
  }
});

router.get('/venues', async (req, res, next) => {
  try {
    const own = ownerClause(req.user);
    const venues = await db.query(
      `SELECT v.*, c.name AS city_name,
              (SELECT COUNT(*) FROM screens sc WHERE sc.venue_id = v.id) AS screen_count
       FROM venues v JOIN cities c ON c.id = v.city_id
       WHERE ${own.sql.replace('organizer_id', 'v.organizer_id')}
       ORDER BY v.name`,
      own.params
    );
    res.render('organizer/venues', {
      title: 'Your theatre',
      venues,
      canCreate: req.user.role === 'admin' || venues.length === 0,
      flash: util.flash(req),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/venues', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name || !req.body.city_id) {
      return res.redirect(`/manage/venues?error=${util.encodeFlash('Name and city required')}`);
    }
    if (req.user.role !== 'admin') {
      try {
        await theatre.assertOneTheatre(req.user.id);
      } catch (err) {
        return res.redirect(`/manage/venues?error=${util.encodeFlash(err.message)}`);
      }
    }
    const vSlug = await util.uniqueSlug(db, 'venues', name);
    const amenities = String(req.body.amenities || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await db.query(
      `INSERT INTO venues (organizer_id, city_id, name, slug, address, amenities, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [req.user.id, req.body.city_id, name, vSlug, req.body.address || null, JSON.stringify(amenities)]
    );
    await db.query('INSERT INTO screens (venue_id, name, row_count, col_count) VALUES (?, ?, ?, ?)', [
      result.insertId,
      req.body.screen_name || 'Main Hall',
      Number(req.body.row_count) || 10,
      Number(req.body.col_count) || 14,
    ]);
    res.redirect(`/manage/venues?ok=${util.encodeFlash('Venue created')}`);
  } catch (e) {
    next(e);
  }
});

router.post('/venues/:id', async (req, res, next) => {
  try {
    const own = ownerClause(req.user);
    const current = await db.one(`SELECT * FROM venues WHERE id = ? AND ${own.sql}`, [req.params.id, ...own.params]);
    if (!current) return res.redirect('/manage/venues');
    if (req.body.action === 'add-screen') {
      await db.query('INSERT INTO screens (venue_id, name, row_count, col_count) VALUES (?, ?, ?, ?)', [
        current.id,
        req.body.screen_name || 'New Audi',
        Number(req.body.row_count) || 10,
        Number(req.body.col_count) || 14,
      ]);
      return res.redirect(`/manage/venues?ok=${util.encodeFlash('Screen added')}`);
    }
    if (req.body.action === 'delete') {
      await db.query('DELETE FROM venues WHERE id = ?', [current.id]);
      return res.redirect(`/manage/venues?ok=${util.encodeFlash('Venue deleted')}`);
    }
    const amenities = String(req.body.amenities || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await db.query(`UPDATE venues SET name=?, city_id=?, address=?, amenities=?, status=? WHERE id=?`, [
      req.body.name,
      req.body.city_id,
      req.body.address || null,
      JSON.stringify(amenities),
      req.body.status || 'active',
      current.id,
    ]);
    res.redirect(`/manage/venues?ok=${util.encodeFlash('Venue updated')}`);
  } catch (e) {
    next(e);
  }
});

router.get('/showtimes', async (req, res, next) => {
  try {
    const params = req.user.role === 'admin' ? [] : [req.user.id];
    const rows = await db.query(
      `${bookings.SHOWTIME_SELECT}
       ${req.user.role === 'admin' ? '' : 'WHERE v.organizer_id = ?'}
       ORDER BY st.starts_at DESC LIMIT 200`,
      params
    );
    const own = ownerClause(req.user);
    const shows =
      req.user.role === 'admin'
        ? await db.query('SELECT id, title FROM shows ORDER BY title')
        : await db.query(
            `SELECT id, title FROM shows WHERE status = 'published' OR organizer_id = ? ORDER BY title`,
            [req.user.id]
          );
    const venues = await db.query(
      `SELECT v.id, v.name, c.name AS city_name FROM venues v JOIN cities c ON c.id = v.city_id
       WHERE ${own.sql.replace('organizer_id', 'v.organizer_id')} ORDER BY v.name`,
      own.params
    );
    const screens = await db.query(
      `SELECT sc.id, sc.name, sc.venue_id FROM screens sc
       JOIN venues v ON v.id = sc.venue_id
       WHERE ${own.sql.replace('organizer_id', 'v.organizer_id')}`,
      own.params
    );
    res.render('organizer/showtimes', {
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
    const own = ownerClause(req.user);
    const show =
      req.user.role === 'admin'
        ? await db.one('SELECT * FROM shows WHERE id = ?', [req.body.show_id])
        : await db.one(
            `SELECT * FROM shows WHERE id = ? AND (status = 'published' OR organizer_id = ?)`,
            [req.body.show_id, req.user.id]
          );
    const ownTheatre = req.user.role === 'admin' ? null : await theatre.getTheatre(req.user.id);
    const venueId = ownTheatre ? ownTheatre.id : req.body.venue_id;
    const venue = await db.one(
      `SELECT * FROM venues WHERE id = ? AND ${own.sql}`,
      [venueId, ...own.params]
    );
    if (!show || !venue) return res.redirect(`/manage/showtimes?error=${util.encodeFlash('Invalid show or theatre')}`);
    const screen = await db.one('SELECT * FROM screens WHERE id = ? AND venue_id = ?', [
      req.body.screen_id,
      venue.id,
    ]);
    if (!screen) return res.redirect(`/manage/showtimes?error=${util.encodeFlash('Screen must belong to your theatre')}`);
    await db.query(
      `INSERT INTO showtimes (show_id, venue_id, screen_id, starts_at, price_regular, price_premium, price_vip, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [
        show.id,
        venue.id,
        screen.id,
        String(req.body.starts_at).replace('T', ' '),
        req.body.price_regular || 220,
        req.body.price_premium || 320,
        req.body.price_vip || 480,
      ]
    );
    res.redirect(`/manage/showtimes?ok=${util.encodeFlash('Showtime added')}`);
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
    res.redirect('/manage/showtimes');
  } catch (e) {
    next(e);
  }
});

router.get('/bookings', async (req, res, next) => {
  try {
    const params = req.user.role === 'admin' ? [] : [req.user.id];
    const rows = await db.query(
      `SELECT b.*, u.name AS user_name, u.email, s.title, st.starts_at, v.name AS venue_name
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN showtimes st ON st.id = b.showtime_id
       JOIN shows s ON s.id = st.show_id
       JOIN venues v ON v.id = st.venue_id
       ${req.user.role === 'admin' ? '' : 'WHERE v.organizer_id = ?'}
       ORDER BY b.created_at DESC LIMIT 200`,
      params
    );
    res.render('organizer/bookings', { title: 'Bookings', rows, flash: util.flash(req) });
  } catch (e) {
    next(e);
  }
});

router.get('/gate', async (req, res) => {
  res.render('organizer/gate', {
    title: 'Gate scan',
    result: null,
    lookup: '',
    flash: util.flash(req),
  });
});

router.get('/gate/:ref', async (req, res, next) => {
  try {
    const ref = qr.parseScannedRef(req.params.ref);
    const booking = await bookings.getBookingByRef(ref);
    let result = { kind: 'missing', ref };
    if (booking) {
      const mine = req.user.role === 'admin' || booking.venue_organizer_id === req.user.id;
      if (!mine) result = { kind: 'wrong_theatre', booking, ref };
      else if (booking.status !== 'confirmed' || booking.payment_status !== 'paid') {
        result = { kind: 'invalid', booking, ref };
      } else if (booking.checked_in_at) result = { kind: 'already', booking, ref };
      else result = { kind: 'ready', booking, ref };
    }
    res.render('organizer/gate', {
      title: `Gate · ${ref}`,
      result,
      lookup: ref,
      flash: util.flash(req),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/gate', async (req, res) => {
  const ref = qr.parseScannedRef(req.body.ref || '');
  if (!ref) return res.redirect(`/manage/gate?error=${util.encodeFlash('Enter a booking reference')}`);
  res.redirect(`/manage/gate/${encodeURIComponent(ref)}`);
});

router.post('/gate/:ref', async (req, res, next) => {
  try {
    const ref = qr.parseScannedRef(req.params.ref);
    const updated = await bookings.checkIn(ref, req.user);
    res.redirect(`/manage/gate/${encodeURIComponent(updated.booking_ref)}?ok=${util.encodeFlash('Guest admitted')}`);
  } catch (e) {
    if (e.code === 'already' && e.booking) {
      return res.redirect(
        `/manage/gate/${encodeURIComponent(e.booking.booking_ref)}?error=${util.encodeFlash('Already admitted')}`
      );
    }
    if (e.status && e.status < 500) {
      const ref = qr.parseScannedRef(req.params.ref);
      return res.redirect(`/manage/gate/${encodeURIComponent(ref)}?error=${util.encodeFlash(e.message)}`);
    }
    next(e);
  }
});

module.exports = router;
