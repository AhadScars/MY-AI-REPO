const db = require('../db');

async function getTheatre(organizerId) {
  return db.one(
    `SELECT v.*, c.name AS city_name
     FROM venues v JOIN cities c ON c.id = v.city_id
     WHERE v.organizer_id = ?`,
    [organizerId]
  );
}

async function assertOneTheatre(organizerId, exceptVenueId) {
  const row = exceptVenueId
    ? await db.one('SELECT id FROM venues WHERE organizer_id = ? AND id != ?', [organizerId, exceptVenueId])
    : await db.one('SELECT id FROM venues WHERE organizer_id = ?', [organizerId]);
  if (row) {
    throw Object.assign(new Error('Each organiser can own only one theatre'), { status: 400 });
  }
}

module.exports = { getTheatre, assertOneTheatre };
