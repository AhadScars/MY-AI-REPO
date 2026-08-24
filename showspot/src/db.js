const fs = require('fs');
const path = require('path');
const config = require('./config');

const dialect = config.db.client === 'mysql' ? 'mysql' : 'sqlite';

function bindParams(params = []) {
  return params.map((p) => {
    if (p instanceof Date) return p.toISOString().slice(0, 19).replace('T', ' ');
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

function adaptSql(sql) {
  if (dialect !== 'sqlite') return sql;
  return sql.replace(/UTC_TIMESTAMP\(\)/gi, "datetime('now')");
}

function isWrite(sql) {
  return !/^\s*(select|pragma|with)\b/i.test(sql);
}

function markDuplicate(err) {
  const msg = String(err && err.message ? err.message : err);
  if (
    err.code === 'ER_DUP_ENTRY' ||
    err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    /UNIQUE constraint failed/i.test(msg)
  ) {
    err.code = 'ER_DUP_ENTRY';
  }
  return err;
}

let query;
let one;
let withTransaction;
let sqliteDb = null;
let mysqlPool = null;

if (dialect === 'sqlite') {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (err) {
    throw new Error(
      'SQLite needs Node.js 22.5+ (built-in node:sqlite). Upgrade Node, or set DB_CLIENT=mysql for Hostinger.'
    );
  }

  const file = path.isAbsolute(config.db.file)
    ? config.db.file
    : path.join(__dirname, '..', config.db.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  sqliteDb = new DatabaseSync(file);
  sqliteDb.exec('PRAGMA foreign_keys = ON');
  sqliteDb.exec('PRAGMA journal_mode = WAL');
  sqliteDb.exec('PRAGMA busy_timeout = 5000');

  function runSqlite(sql, params = []) {
    const adapted = adaptSql(sql);
    const bound = bindParams(params);
    try {
      if (isWrite(adapted)) {
        const info = sqliteDb.prepare(adapted).run(...bound);
        return { insertId: Number(info.lastInsertRowid), changes: info.changes };
      }
      return sqliteDb.prepare(adapted).all(...bound);
    } catch (err) {
      throw markDuplicate(err);
    }
  }

  query = async (sql, params = []) => runSqlite(sql, params);
  one = async (sql, params = []) => {
    const rows = runSqlite(sql, params);
    return Array.isArray(rows) ? rows[0] || null : rows;
  };
  withTransaction = async (fn) => {
    sqliteDb.exec('BEGIN IMMEDIATE');
    const api = { query: async (sql, params = []) => runSqlite(sql, params), one };
    try {
      const result = await fn(api);
      sqliteDb.exec('COMMIT');
      return result;
    } catch (err) {
      sqliteDb.exec('ROLLBACK');
      throw err;
    }
  };
} else {
  const mysql = require('mysql2/promise');
  mysqlPool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',
    charset: 'utf8mb4',
    ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
  });

  query = async (sql, params = []) => {
    const [rows] = await mysqlPool.query(sql, params);
    return rows;
  };
  one = async (sql, params = []) => {
    const rows = await query(sql, params);
    return rows[0] || null;
  };
  withTransaction = async (fn) => {
    const conn = await mysqlPool.getConnection();
    await conn.beginTransaction();
    try {
      const api = {
        query: async (sql, params = []) => {
          const [rows] = await conn.query(sql, params);
          return rows;
        },
        one: async (sql, params = []) => {
          const [rows] = await conn.query(sql, params);
          return rows[0] || null;
        },
      };
      const result = await fn(api);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  };
}

module.exports = {
  dialect,
  query,
  one,
  withTransaction,
  sqliteDb,
  pool: mysqlPool,
};
