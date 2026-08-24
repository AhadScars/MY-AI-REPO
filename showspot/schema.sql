-- ShowSpot schema — import this in Hostinger phpMyAdmin if you prefer not to run `npm run migrate`.
-- Character set: utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  state VARCHAR(80) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  role ENUM('admin','organizer','user') NOT NULL DEFAULT 'user',
  status ENUM('active','pending','suspended') NOT NULL DEFAULT 'active',
  avatar VARCHAR(255) DEFAULT NULL,
  city_id INT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organizer_id INT NOT NULL,
  city_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  address VARCHAR(255) DEFAULT NULL,
  description TEXT,
  amenities JSON DEFAULT NULL,
  image VARCHAR(255) DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_venue_slug (slug),
  UNIQUE KEY uq_venue_organizer (organizer_id),
  KEY idx_venues_city (city_id),
  CONSTRAINT fk_venues_org FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_venues_city FOREIGN KEY (city_id) REFERENCES cities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS screens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venue_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  row_count INT NOT NULL DEFAULT 10,
  col_count INT NOT NULL DEFAULT 14,
  CONSTRAINT fk_screens_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organizer_id INT NOT NULL,
  type ENUM('movie','event','sports','play') NOT NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  synopsis TEXT,
  language VARCHAR(40) DEFAULT NULL,
  genre VARCHAR(120) DEFAULT NULL,
  duration_min INT DEFAULT NULL,
  age_rating VARCHAR(16) DEFAULT NULL,
  poster VARCHAR(255) DEFAULT NULL,
  banner VARCHAR(255) DEFAULT NULL,
  trailer_url VARCHAR(255) DEFAULT NULL,
  release_date DATE DEFAULT NULL,
  status ENUM('draft','published','ended') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shows_type (type, status),
  CONSTRAINT fk_shows_org FOREIGN KEY (organizer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS showtimes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  show_id INT NOT NULL,
  venue_id INT NOT NULL,
  screen_id INT NOT NULL,
  starts_at DATETIME NOT NULL,
  price_regular DECIMAL(10,2) NOT NULL,
  price_premium DECIMAL(10,2) NOT NULL,
  price_vip DECIMAL(10,2) NOT NULL,
  status ENUM('open','closed','cancelled') NOT NULL DEFAULT 'open',
  KEY idx_st_show_time (show_id, starts_at),
  KEY idx_st_venue (venue_id, starts_at),
  CONSTRAINT fk_st_show FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
  CONSTRAINT fk_st_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
  CONSTRAINT fk_st_screen FOREIGN KEY (screen_id) REFERENCES screens(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_ref VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  showtime_id INT NOT NULL,
  seats_json JSON NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  fee DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  stripe_session_id VARCHAR(255) DEFAULT NULL,
  stripe_payment_intent VARCHAR(255) DEFAULT NULL,
  status ENUM('held','confirmed','cancelled','expired') NOT NULL DEFAULT 'held',
  hold_expires_at DATETIME DEFAULT NULL,
  checked_in_at DATETIME DEFAULT NULL,
  checked_in_by INT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_book_user (user_id, created_at),
  KEY idx_book_showtime (showtime_id, status),
  CONSTRAINT fk_book_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_book_st FOREIGN KEY (showtime_id) REFERENCES showtimes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  showtime_id INT NOT NULL,
  seat_label VARCHAR(8) NOT NULL,
  category ENUM('regular','premium','vip') NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  UNIQUE KEY uq_live_seat (showtime_id, seat_label),
  CONSTRAINT fk_bseats_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  show_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (user_id, show_id),
  CONSTRAINT fk_rev_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_show FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizer_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company VARCHAR(160) DEFAULT NULL,
  message TEXT,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_oa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(80) PRIMARY KEY,
  v TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
