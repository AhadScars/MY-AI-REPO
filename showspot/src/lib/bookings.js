const db = require('../db');
const config = require('../config');
const seatsLib = require('./seats');
const util = require('./util');

const SHOWTIME_SELECT = `
  SELECT st.*,
         s.title, s.slug AS show_slug, s.type, s.poster, s.language, s.duration_min, s.genre,
         s.age_rating, s.organizer_id,
         v.name AS venue_name, v.slug AS venue_slug, v.address AS venue_address, v.city_id,
         c.name AS city_name,
         sc.name AS screen_name, sc.row_count, sc.col_count
  FROM showtimes st
  JOIN shows s ON s.id = st.show_id
  JOIN venues v ON v.id = st.venue_id
  JOIN cities c ON c.id = v.city_id
  JOIN screens sc ON sc.id = st.screen_id
`;

async function expireHolds() {
  const stale = await db.query(
    `SELECT id FROM bookings
     WHERE status = 'held' AND payment_status = 'pending'
       AND hold_expires_at IS NOT NULL AND hold_expires_at < UTC_TIMESTAMP()`
  );
  for (const row of stale) {
    await db.withTransaction(async (tx) => {
      await tx.query('DELETE FROM booking_seats WHERE booking_id = ?', [row.id]);
      await tx.query(
        `UPDATE bookings SET status = 'expired', payment_status = 'failed' WHERE id = ? AND status = 'held'`,
        [row.id]
      );
    });
  }
  return stale.length;
}

async function takenSeats(showtimeId) {
  await expireHolds();
  const rows = await db.query(
    `SELECT bs.seat_label
     FROM booking_seats bs
     JOIN bookings b ON b.id = bs.booking_id
     WHERE bs.showtime_id = ?
       AND b.status IN ('held', 'confirmed')`,
    [showtimeId]
  );
  return new Set(rows.map((r) => r.seat_label));
}

async function getShowtime(id) {
  return db.one(`${SHOWTIME_SELECT} WHERE st.id = ?`, [id]);
}

async function holdSeats(user, showtimeId, seatLabels) {
  await expireHolds();
  return db.withTransaction(async (tx) => {
    const showtime = await tx.one(`${SHOWTIME_SELECT} WHERE st.id = ?`, [showtimeId]);
    if (!showtime) throw Object.assign(new Error('Showtime not found'), { status: 404 });
    if (showtime.status !== 'open') throw Object.assign(new Error('This showtime is closed'), { status: 400 });
    if (new Date(showtime.starts_at) < new Date()) {
      throw Object.assign(new Error('This showtime has already started'), { status: 400 });
    }

    const selected = seatsLib.validateSeats(
      { row_count: showtime.row_count, col_count: showtime.col_count },
      showtime,
      seatLabels
    );
    if (selected.length > config.maxSeats) {
      throw Object.assign(new Error(`You can book at most ${config.maxSeats} seats`), { status: 400 });
    }

    const taken = await tx.query(
      `SELECT bs.seat_label
       FROM booking_seats bs
       JOIN bookings b ON b.id = bs.booking_id
       WHERE bs.showtime_id = ? AND b.status IN ('held', 'confirmed')`,
      [showtimeId]
    );
    const takenSet = new Set(taken.map((r) => r.seat_label));
    for (const seat of selected) {
      if (takenSet.has(seat.label)) {
        throw Object.assign(new Error(`Seat ${seat.label} was just taken`), { status: 409 });
      }
    }

    const subtotal = selected.reduce((sum, s) => sum + Number(s.price), 0);
    const money = util.pricing(subtotal);
    const ref = util.bookingRef();
    const expires = util.addMinutes(new Date(), config.holdMinutes);

    const result = await tx.query(
      `INSERT INTO bookings
        (booking_ref, user_id, showtime_id, seats_json, subtotal, fee, tax, total, payment_status, status, hold_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'held', ?)`,
      [
        ref,
        user.id,
        showtimeId,
        JSON.stringify(selected),
        money.subtotal,
        money.fee,
        money.tax,
        money.total,
        expires,
      ]
    );
    const bookingId = result.insertId;
    for (const seat of selected) {
      try {
        await tx.query(
          `INSERT INTO booking_seats (booking_id, showtime_id, seat_label, category, price)
           VALUES (?, ?, ?, ?, ?)`,
          [bookingId, showtimeId, seat.label, seat.category, seat.price]
        );
      } catch (err) {
        if (err && (err.code === 'ER_DUP_ENTRY' || /UNIQUE/i.test(err.message || ''))) {
          throw Object.assign(new Error(`Seat ${seat.label} was just taken`), { status: 409 });
        }
        throw err;
      }
    }
    return tx.one('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  });
}

async function confirmBooking(bookingId, extras = {}) {
  const fields = ["status = 'confirmed'", "payment_status = 'paid'", 'hold_expires_at = NULL'];
  const params = [];
  if (extras.stripe_session_id) {
    fields.push('stripe_session_id = ?');
    params.push(extras.stripe_session_id);
  }
  if (extras.stripe_payment_intent) {
    fields.push('stripe_payment_intent = ?');
    params.push(extras.stripe_payment_intent);
  }
  params.push(bookingId);
  await db.query(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ? AND status IN ('held', 'confirmed')`, params);
  return getBooking(bookingId);
}

async function cancelBooking(bookingId, user) {
  return db.withTransaction(async (tx) => {
    const booking = await tx.one('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
    if (user.role !== 'admin' && booking.user_id !== user.id) {
      throw Object.assign(new Error('Not your booking'), { status: 403 });
    }
    if (booking.status === 'cancelled') return booking;
    await tx.query('DELETE FROM booking_seats WHERE booking_id = ?', [bookingId]);
    await tx.query(
      `UPDATE bookings SET status = 'cancelled',
        payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE id = ?`,
      [bookingId]
    );
    return tx.one('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  });
}

async function getBooking(id) {
  const booking = await db.one(
    `SELECT b.*,
            u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
            st.starts_at, st.price_regular, st.show_id, st.venue_id, st.screen_id,
            s.title, s.slug AS show_slug, s.type, s.poster, s.language, s.duration_min,
            v.name AS venue_name, v.address AS venue_address, v.organizer_id AS venue_organizer_id,
            c.name AS city_name,
            sc.name AS screen_name
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN showtimes st ON st.id = b.showtime_id
     JOIN shows s ON s.id = st.show_id
     JOIN venues v ON v.id = st.venue_id
     JOIN cities c ON c.id = v.city_id
     JOIN screens sc ON sc.id = st.screen_id
     WHERE b.id = ?`,
    [id]
  );
  if (booking) booking.seats = util.parseJson(booking.seats_json, []);
  return booking;
}

async function getBookingByRef(ref) {
  const row = await db.one('SELECT id FROM bookings WHERE booking_ref = ?', [String(ref || '').toUpperCase()]);
  return row ? getBooking(row.id) : null;
}

async function checkIn(ref, staff) {
  const booking = await getBookingByRef(ref);
  if (!booking) throw Object.assign(new Error('Ticket not found'), { status: 404, code: 'not_found' });
  if (staff.role !== 'admin' && booking.venue_organizer_id !== staff.id) {
    throw Object.assign(new Error('This ticket is for another theatre'), { status: 403, code: 'wrong_theatre' });
  }
  if (booking.status !== 'confirmed' || booking.payment_status !== 'paid') {
    throw Object.assign(new Error('Ticket is not paid'), { status: 400, code: 'not_paid', booking });
  }
  if (booking.checked_in_at) {
    throw Object.assign(new Error('Already admitted'), { status: 409, code: 'already', booking });
  }
  await db.query('UPDATE bookings SET checked_in_at = ?, checked_in_by = ? WHERE id = ? AND checked_in_at IS NULL', [
    new Date().toISOString().slice(0, 19).replace('T', ' '),
    staff.id,
    booking.id,
  ]);
  return getBooking(booking.id);
}

module.exports = {
  expireHolds,
  takenSeats,
  getShowtime,
  holdSeats,
  confirmBooking,
  cancelBooking,
  getBooking,
  getBookingByRef,
  checkIn,
  SHOWTIME_SELECT,
};
