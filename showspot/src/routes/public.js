const express = require('express');
const db = require('../db');
const util = require('../lib/util');
const bookings = require('../lib/bookings');
const seatsLib = require('../lib/seats');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

async function listShows({ type, q, limit = 24 }) {
  const where = ["s.status = 'published'"];
  const params = [];
  if (type) {
    where.push('s.type = ?');
    params.push(type);
  }
  if (q) {
    where.push('(s.title LIKE ? OR s.genre LIKE ? OR s.language LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  params.push(limit);
  return db.query(
    `SELECT s.*,
            (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.show_id = s.id) AS avg_rating,
            (SELECT COUNT(*) FROM reviews r WHERE r.show_id = s.id) AS review_count
     FROM shows s
     WHERE ${where.join(' AND ')}
     ORDER BY s.release_date DESC, s.id DESC
     LIMIT ?`,
    params
  );
}

router.get('/', async (req, res, next) => {
  try {
    const movies = await listShows({ type: 'movie', limit: 8 });
    const events = await listShows({ type: 'event', limit: 6 });
    const sports = await listShows({ type: 'sports', limit: 4 });
    const plays = await listShows({ type: 'play', limit: 4 });
    const featured = movies[0] || events[0] || null;
    res.render('home', {
      title: 'Book movies, events & live shows',
      featured,
      movies,
      events,
      sports,
      plays,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/movies', async (req, res, next) => {
  try {
    const items = await listShows({ type: 'movie', q: req.query.q });
    res.render('listing', {
      title: 'Movies',
      heading: 'Movies',
      type: 'movie',
      items,
      q: req.query.q || '',
    });
  } catch (e) {
    next(e);
  }
});

router.get('/events', async (req, res, next) => {
  try {
    const items = await listShows({ type: 'event', q: req.query.q });
    res.render('listing', {
      title: 'Events',
      heading: 'Events',
      type: 'event',
      items,
      q: req.query.q || '',
    });
  } catch (e) {
    next(e);
  }
});

router.get('/sports', async (req, res, next) => {
  try {
    const items = await listShows({ type: 'sports', q: req.query.q });
    res.render('listing', {
      title: 'Sports',
      heading: 'Sports',
      type: 'sports',
      items,
      q: req.query.q || '',
    });
  } catch (e) {
    next(e);
  }
});

router.get('/plays', async (req, res, next) => {
  try {
    const items = await listShows({ type: 'play', q: req.query.q });
    res.render('listing', {
      title: 'Plays',
      heading: 'Plays',
      type: 'play',
      items,
      q: req.query.q || '',
    });
  } catch (e) {
    next(e);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const items = q ? await listShows({ q, limit: 40 }) : [];
    res.render('listing', {
      title: q ? `Search: ${q}` : 'Search',
      heading: q ? `Results for “${q}”` : 'Search',
      type: null,
      items,
      q,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/show/:slug', async (req, res, next) => {
  try {
    const show = await db.one(
      `SELECT s.*,
              (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.show_id = s.id) AS avg_rating,
              (SELECT COUNT(*) FROM reviews r WHERE r.show_id = s.id) AS review_count
       FROM shows s WHERE s.slug = ?`,
      [req.params.slug]
    );
    if (!show || show.status === 'draft') {
      return res.status(404).render('error', { title: 'Not found', code: 404, message: 'That show is not listed.' });
    }
    const cityId = req.city ? req.city.id : null;
    const showtimes = await db.query(
      `${bookings.SHOWTIME_SELECT}
       WHERE st.show_id = ? AND st.status = 'open' AND st.starts_at > UTC_TIMESTAMP()
         ${cityId ? 'AND v.city_id = ?' : ''}
       ORDER BY v.name, st.starts_at`,
      cityId ? [show.id, cityId] : [show.id]
    );
    const byVenue = [];
    const map = new Map();
    for (const st of showtimes) {
      if (!map.has(st.venue_id)) {
        const group = {
          venue_id: st.venue_id,
          venue_name: st.venue_name,
          venue_address: st.venue_address,
          city_name: st.city_name,
          times: [],
        };
        map.set(st.venue_id, group);
        byVenue.push(group);
      }
      map.get(st.venue_id).times.push(st);
    }
    const reviews = await db.query(
      `SELECT r.*, u.name AS user_name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.show_id = ? ORDER BY r.created_at DESC LIMIT 20`,
      [show.id]
    );
    const userReview = req.user
      ? await db.one('SELECT * FROM reviews WHERE user_id = ? AND show_id = ?', [req.user.id, show.id])
      : null;
    const otherCities = cityId
      ? await db.query(
          `SELECT DISTINCT c.name
           FROM showtimes st
           JOIN venues v ON v.id = st.venue_id
           JOIN cities c ON c.id = v.city_id
           WHERE st.show_id = ? AND st.status = 'open' AND st.starts_at > UTC_TIMESTAMP() AND v.city_id != ?`,
          [show.id, cityId]
        )
      : [];
    res.render('show', {
      title: show.title,
      show,
      byVenue,
      reviews,
      userReview,
      otherCities,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/book/:showtimeId', requireAuth, async (req, res, next) => {
  try {
    const showtime = await bookings.getShowtime(req.params.showtimeId);
    if (!showtime) {
      return res.status(404).render('error', { title: 'Not found', code: 404, message: 'Showtime not found.' });
    }
    const taken = await bookings.takenSeats(showtime.id);
    const layout = seatsLib.buildLayout(
      { row_count: showtime.row_count, col_count: showtime.col_count },
      showtime,
      taken
    );
    res.render('seats', {
      title: `Select seats · ${showtime.title}`,
      showtime,
      layout,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/show/:slug/reviews', requireAuth, async (req, res, next) => {
  try {
    const show = await db.one('SELECT * FROM shows WHERE slug = ?', [req.params.slug]);
    if (!show) return res.redirect('/');
    const rating = Math.min(5, Math.max(1, Number(req.body.rating) || 5));
    const comment = String(req.body.comment || '').slice(0, 800);
    if (db.dialect === 'sqlite') {
      await db.query(
        `INSERT INTO reviews (user_id, show_id, rating, comment)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, show_id) DO UPDATE SET
           rating = excluded.rating,
           comment = excluded.comment,
           created_at = datetime('now')`,
        [req.user.id, show.id, rating, comment]
      );
    } else {
      await db.query(
        `INSERT INTO reviews (user_id, show_id, rating, comment)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP`,
        [req.user.id, show.id, rating, comment]
      );
    }
    res.redirect(`/show/${show.slug}#reviews`);
  } catch (e) {
    next(e);
  }
});

router.post('/city', (req, res) => {
  const slug = String(req.body.city || req.query.city || '').toLowerCase();
  res.cookie('showspot_city', slug, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
  const back = req.body.next || req.get('referer') || '/';
  res.redirect(back);
});

router.get('/city/:slug', (req, res) => {
  res.cookie('showspot_city', req.params.slug, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });
  res.redirect(req.query.next || '/');
});

module.exports = router;
