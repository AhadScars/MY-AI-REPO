PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  state TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','organizer','user')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
  avatar TEXT,
  city_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organizer_id INTEGER NOT NULL,
  city_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  description TEXT,
  amenities TEXT,
  image TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (city_id) REFERENCES cities(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_venue_organizer ON venues(organizer_id);

CREATE TABLE IF NOT EXISTS screens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 10,
  col_count INTEGER NOT NULL DEFAULT 14,
  FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organizer_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('movie','event','sports','play')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  synopsis TEXT,
  language TEXT,
  genre TEXT,
  duration_min INTEGER,
  age_rating TEXT,
  poster TEXT,
  banner TEXT,
  trailer_url TEXT,
  release_date TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','ended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shows_type ON shows(type, status);

CREATE TABLE IF NOT EXISTS showtimes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL,
  venue_id INTEGER NOT NULL,
  screen_id INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  price_regular REAL NOT NULL,
  price_premium REAL NOT NULL,
  price_vip REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  FOREIGN KEY (venue_id) REFERENCES venues(id),
  FOREIGN KEY (screen_id) REFERENCES screens(id)
);

CREATE INDEX IF NOT EXISTS idx_st_show_time ON showtimes(show_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_st_venue ON showtimes(venue_id, starts_at);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  showtime_id INTEGER NOT NULL,
  seats_json TEXT NOT NULL,
  subtotal REAL NOT NULL,
  fee REAL NOT NULL,
  tax REAL NOT NULL,
  total REAL NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','confirmed','cancelled','expired')),
  hold_expires_at TEXT,
  checked_in_at TEXT,
  checked_in_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (showtime_id) REFERENCES showtimes(id)
);

CREATE INDEX IF NOT EXISTS idx_book_user ON bookings(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_book_showtime ON bookings(showtime_id, status);

CREATE TABLE IF NOT EXISTS booking_seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  showtime_id INTEGER NOT NULL,
  seat_label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('regular','premium','vip')),
  price REAL NOT NULL,
  UNIQUE (showtime_id, seat_label),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  show_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, show_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS organizer_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  company TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT
);
