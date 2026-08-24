const fs = require('fs');
const path = require('path');
const config = require('./config');

async function migrateMysql() {
  const mysql = require('mysql2/promise');
  const { host, port, user, password, database, ssl } = config.db;
  const base = {
    host,
    port,
    user,
    password,
    multipleStatements: true,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
  };

  try {
    const root = await mysql.createConnection(base);
    await root.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await root.end();
  } catch (err) {
    console.log('Skipping CREATE DATABASE (' + err.message + '). Using the existing Hostinger database.');
  }

  const conn = await mysql.createConnection({ ...base, database });
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await conn.query(sql);
  try {
    await conn.query('ALTER TABLE bookings ADD COLUMN checked_in_at DATETIME NULL');
  } catch (_err) {
    /* already exists */
  }
  try {
    await conn.query('ALTER TABLE bookings ADD COLUMN checked_in_by INT NULL');
  } catch (_err) {
    /* already exists */
  }
  await conn.end();
  console.log('ShowSpot tables are ready on MySQL', database);
}

function sqliteColumns(table) {
  const db = require('./db');
  return db.sqliteDb.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function migrateSqlite() {
  const db = require('./db');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sqlite.sql'), 'utf8');
  db.sqliteDb.exec(sql);
  db.sqliteDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_venue_organizer ON venues(organizer_id)');
  const cols = sqliteColumns('bookings');
  if (!cols.includes('checked_in_at')) db.sqliteDb.exec('ALTER TABLE bookings ADD COLUMN checked_in_at TEXT');
  if (!cols.includes('checked_in_by')) db.sqliteDb.exec('ALTER TABLE bookings ADD COLUMN checked_in_by INTEGER');
  console.log('ShowSpot tables are ready on SQLite', config.db.file);
}

async function migrate() {
  if (config.db.client === 'mysql') return migrateMysql();
  return migrateSqlite();
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { migrate };
