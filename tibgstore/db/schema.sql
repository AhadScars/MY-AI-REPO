-- TIBGSTORE · Hostinger MySQL / MariaDB
-- Import this file in hPanel → Databases → phpMyAdmin → Import
-- Character set: utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(80) NOT NULL,
  payload LONGTEXT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(80) NOT NULL,
  published TINYINT(1) NOT NULL DEFAULT 1,
  post_date VARCHAR(20) DEFAULT '',
  payload LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_posts_date (post_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(160) NOT NULL,
  user_id VARCHAR(80) DEFAULT '',
  email VARCHAR(160) DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  method VARCHAR(20) DEFAULT 'stripe',
  total INT NOT NULL DEFAULT 0,
  created_at VARCHAR(40) DEFAULT '',
  payload LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_orders_email (email),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR(80) NOT NULL,
  code VARCHAR(40) NOT NULL,
  payload LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_coupon_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR(80) NOT NULL,
  created_at VARCHAR(40) DEFAULT '',
  payload LONGTEXT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(80) NOT NULL,
  google_id VARCHAR(80) DEFAULT '',
  email VARCHAR(160) DEFAULT '',
  payload LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_users_google (google_id),
  KEY idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wishlists (
  user_id VARCHAR(80) NOT NULL,
  product_id VARCHAR(80) NOT NULL,
  PRIMARY KEY (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(80) NOT NULL,
  payload LONGTEXT NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_auth (
  id TINYINT NOT NULL DEFAULT 1,
  hash VARCHAR(128) NOT NULL DEFAULT '',
  salt VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
