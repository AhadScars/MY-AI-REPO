require('dotenv').config();

function num(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  port: num('PORT', 3000),
  env: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'ShowSpot',
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  db: {
    client: (process.env.DB_CLIENT || 'sqlite').toLowerCase(),
    file: process.env.DB_FILE || 'data/showspot.sqlite',
    host: process.env.DB_HOST || 'localhost',
    port: num('DB_PORT', 3306),
    user: process.env.DB_USER || 'showspot',
    password: process.env.DB_PASSWORD || 'showspot',
    database: process.env.DB_NAME || 'showspot',
    ssl: String(process.env.DB_SSL || 'false').toLowerCase() === 'true',
  },
  stripe: {
    secret: process.env.STRIPE_SECRET_KEY || '',
    publishable: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhook: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  currency: (process.env.CURRENCY || 'inr').toLowerCase(),
  currencySymbol: process.env.CURRENCY_SYMBOL || '₹',
  holdMinutes: num('HOLD_MINUTES', 12),
  feePercent: num('CONVENIENCE_FEE_PERCENT', 5),
  taxPercent: num('TAX_PERCENT', 18),
  maxSeats: num('MAX_SEATS_PER_BOOKING', 10),
};

module.exports = config;
