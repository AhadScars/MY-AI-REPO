const slugify = require('slugify');
const config = require('../config');

function slug(text) {
  return slugify(String(text || ''), { lower: true, strict: true, trim: true });
}

function bookingRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'SS-';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function money(n) {
  const val = Number(n || 0);
  if (config.currency === 'inr') {
    const rounded = Math.round(val);
    return `₹${rounded.toLocaleString('en-IN')}`;
  }
  return `${config.currencySymbol}${val.toFixed(2)}`;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function pricing(subtotal) {
  const fee = roundMoney((subtotal * config.feePercent) / 100);
  const taxBase = config.currency === 'inr' ? fee : subtotal + fee;
  const tax = roundMoney((taxBase * config.taxPercent) / 100);
  const total = roundMoney(subtotal + fee + tax);
  return { subtotal: roundMoney(subtotal), fee, tax, total };
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

function formatDateTime(d) {
  return `${formatDate(d)} · ${formatTime(d)}`;
}

function toDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toInputDate(d) {
  const dt = toDate(d);
  if (!dt) return '';
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function toInputDateTime(d) {
  const dt = toDate(d);
  if (!dt) return '';
  return `${toInputDate(dt)}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`;
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60 * 1000);
}

function typeLabel(type) {
  return { movie: 'Movies', event: 'Events', sports: 'Sports', play: 'Plays' }[type] || type;
}

function typeSingular(type) {
  return { movie: 'Movie', event: 'Event', sports: 'Sports', play: 'Play' }[type] || type;
}

function initials(name) {
  return String(name || 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function flash(req) {
  const q = req.query || {};
  if (q.error) return { type: 'error', text: String(q.error) };
  if (q.ok) return { type: 'ok', text: String(q.ok) };
  return null;
}

function encodeFlash(text) {
  return encodeURIComponent(text);
}

async function uniqueSlug(db, table, base, ignoreId) {
  let candidate = slug(base) || 'item';
  let n = 1;
  while (true) {
    const row = ignoreId
      ? await db.one(`SELECT id FROM ${table} WHERE slug = ? AND id != ? LIMIT 1`, [candidate, ignoreId])
      : await db.one(`SELECT id FROM ${table} WHERE slug = ? LIMIT 1`, [candidate]);
    if (!row) return candidate;
    n += 1;
    candidate = `${slug(base)}-${n}`;
  }
}

function posterUrl(show) {
  if (!show) return '/img/poster-fallback.svg';
  const p = show.poster;
  if (!p) return '/img/poster-fallback.svg';
  if (p.startsWith('http') || p.startsWith('/')) return p;
  return `/uploads/${p}`;
}

function bannerUrl(show) {
  if (show && show.banner) {
    if (show.banner.startsWith('http') || show.banner.startsWith('/')) return show.banner;
    return `/uploads/${show.banner}`;
  }
  return posterUrl(show);
}

module.exports = {
  slug,
  bookingRef,
  money,
  roundMoney,
  pricing,
  parseJson,
  formatDate,
  formatTime,
  formatDateTime,
  toInputDate,
  toInputDateTime,
  addMinutes,
  typeLabel,
  typeSingular,
  initials,
  flash,
  encodeFlash,
  uniqueSlug,
  posterUrl,
  bannerUrl,
};
