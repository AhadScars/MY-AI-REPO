/**
 * Browser SQLite via sql.js — no CDN.
 * 1) Load WASM bytes from same origin, pass as wasmBinary
 * 2) If that fails, use pure JS asm build (no WASM)
 */

let SQL = null;
let loadPromise = null;

function basePath() {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

async function fetchBinary(url) {
  const res = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) throw new Error(`Empty file: ${url}`);
  return new Uint8Array(buf);
}

async function initWithWasm() {
  // Browser build of sql.js expects "sql-wasm-browser.wasm"
  const wasmUrl = `${basePath()}sql-wasm-browser.wasm`;
  const wasmBinary = await fetchBinary(wasmUrl);

  // Import the browser entry explicitly (not the Node build)
  const mod = await import('sql.js/dist/sql-wasm-browser.js');
  const initSqlJs = mod.default || mod;

  return initSqlJs({
    wasmBinary,
    // If anything still asks for a path, serve same-origin files
    locateFile: (file) => `${basePath()}${file}`,
  });
}

async function initWithAsm() {
  const mod = await import('sql.js/dist/sql-asm.js');
  const initSqlJs = mod.default || mod;
  // asm build does not need locateFile / wasm
  return initSqlJs({
    locateFile: () => '',
  });
}

export async function loadSqlJs() {
  if (SQL) return SQL;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const errors = [];

    // 1) Local WASM binary (same origin) — no CDN
    try {
      SQL = await initWithWasm();
      console.info('[sqlite] engine: wasm (local)');
      return SQL;
    } catch (e) {
      errors.push(`WASM: ${e?.message || e}`);
      console.warn('[sqlite] local WASM failed, trying asm.js…', e);
    }

    // 2) Pure JS fallback — never needs .wasm files
    try {
      SQL = await initWithAsm();
      console.info('[sqlite] engine: asm.js (fallback)');
      return SQL;
    } catch (e) {
      errors.push(`ASM: ${e?.message || e}`);
      loadPromise = null;
      throw new Error(
        `Failed to load SQLite engine (${errors.join(' | ')}). ` +
          'Hard-refresh (Ctrl+Shift+R). On Vercel, redeploy the latest build.'
      );
    }
  })();

  return loadPromise;
}

function quoteIdent(name) {
  if (typeof name !== 'string' || !name || name.includes('\0')) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function serializeValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v instanceof Uint8Array) {
    return `[BLOB ${v.length} bytes]`;
  }
  return v;
}

export class BrowserDatabase {
  constructor(db, fileName = 'database.db') {
    this.db = db;
    this.fileName = fileName;
  }

  static async fromArrayBuffer(buffer, fileName = 'database.db') {
    const SQLMod = await loadSqlJs();
    const u8 = new Uint8Array(buffer);
    if (u8.length < 16) throw new Error('File is too small to be a SQLite database');
    const header = String.fromCharCode(...u8.slice(0, 15));
    if (header !== 'SQLite format 3') {
      throw new Error('Not a valid SQLite database file');
    }
    const db = new SQLMod.Database(u8);
    return new BrowserDatabase(db, fileName);
  }

  static async fromUrl(url, fileName = 'demo.db') {
    const full = url.startsWith('http') || url.startsWith('data:') ? url : `${basePath()}${url.replace(/^\//, '')}`;
    const res = await fetch(full, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Failed to load sample database (${res.status})`);
    const buffer = await res.arrayBuffer();
    return BrowserDatabase.fromArrayBuffer(buffer, fileName);
  }

  static async fromFile(file) {
    const buffer = await file.arrayBuffer();
    return BrowserDatabase.fromArrayBuffer(buffer, file.name || 'database.db');
  }

  close() {
    try {
      this.db.close();
    } catch {
      /* ignore */
    }
  }

  getTables() {
    const res = this.db.exec(`
      SELECT name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY type, name COLLATE NOCASE
    `);
    if (!res.length) return [];
    const { values } = res[0];
    return values.map(([name, type]) => ({ name, type }));
  }

  getColumns(table) {
    const stmt = this.db.prepare(`PRAGMA table_info(${quoteIdent(table)})`);
    const cols = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      cols.push({
        cid: row.cid,
        name: row.name,
        type: row.type || 'ANY',
        notnull: !!row.notnull,
        defaultValue: row.dflt_value,
        pk: row.pk || 0,
      });
    }
    stmt.free();
    return cols;
  }

  getRows(table, { page = 1, limit = 100, search = '', sort = '', dir = 'asc' } = {}) {
    const columns = this.getColumns(table);
    if (!columns.length) throw new Error('Table not found');

    const colNames = columns.map((c) => c.name);
    const offset = (Math.max(1, page) - 1) * limit;
    const params = {};
    let where = '';

    if (search && search.trim()) {
      const parts = colNames.map((c, i) => {
        params[`$s${i}`] = `%${search.trim()}%`;
        return `CAST(${quoteIdent(c)} AS TEXT) LIKE $s${i}`;
      });
      where = `WHERE ${parts.join(' OR ')}`;
    }

    let order = 'ORDER BY rowid';
    if (sort && colNames.includes(sort)) {
      const sortDir = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      order = `ORDER BY ${quoteIdent(sort)} ${sortDir}`;
    }

    const countStmt = this.db.prepare(
      `SELECT COUNT(*) AS n FROM ${quoteIdent(table)} ${where}`
    );
    countStmt.bind(params);
    countStmt.step();
    const total = Number(countStmt.getAsObject().n || 0);
    countStmt.free();

    const sql = `
      SELECT rowid AS __rowid__, *
      FROM ${quoteIdent(table)}
      ${where}
      ${order}
      LIMIT $limit OFFSET $offset
    `;
    const stmt = this.db.prepare(sql);
    stmt.bind({ ...params, $limit: limit, $offset: offset });

    const rows = [];
    while (stmt.step()) {
      const raw = stmt.getAsObject();
      const out = {};
      for (const [k, v] of Object.entries(raw)) {
        out[k] = serializeValue(v);
      }
      rows.push(out);
    }
    stmt.free();

    return {
      table,
      columns,
      primaryKey: columns
        .filter((c) => c.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((c) => c.name),
      rows,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  updateRow(table, rowid, values) {
    const columns = this.getColumns(table);
    const colNames = new Set(columns.map((c) => c.name));
    const entries = Object.entries(values || {}).filter(([k]) => colNames.has(k));
    if (!entries.length) throw new Error('No valid columns to update');

    const sets = entries.map(([k], i) => `${quoteIdent(k)} = $v${i}`).join(', ');
    const bind = { $rowid: rowid };
    entries.forEach(([, v], i) => {
      bind[`$v${i}`] = v === '' ? null : v;
    });

    this.db.run(`UPDATE ${quoteIdent(table)} SET ${sets} WHERE rowid = $rowid`, bind);
  }

  deleteRows(table, rowids) {
    const ids = Array.isArray(rowids) ? rowids : [rowids];
    const stmt = this.db.prepare(`DELETE FROM ${quoteIdent(table)} WHERE rowid = $id`);
    this.db.run('BEGIN');
    try {
      for (const id of ids) {
        stmt.run({ $id: id });
      }
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    } finally {
      stmt.free();
    }
  }

  insertRow(table, values) {
    const columns = this.getColumns(table);
    const colNames = new Set(columns.map((c) => c.name));
    const entries = Object.entries(values || {}).filter(([k]) => colNames.has(k));

    if (!entries.length) {
      this.db.run(`INSERT INTO ${quoteIdent(table)} DEFAULT VALUES`);
      return;
    }

    const cols = entries.map(([k]) => quoteIdent(k)).join(', ');
    const placeholders = entries.map((_, i) => `$v${i}`).join(', ');
    const bind = {};
    entries.forEach(([, v], i) => {
      bind[`$v${i}`] = v === '' ? null : v;
    });
    this.db.run(
      `INSERT INTO ${quoteIdent(table)} (${cols}) VALUES (${placeholders})`,
      bind
    );
  }

  exportBytes() {
    return this.db.export();
  }

  download() {
    const data = this.exportBytes();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileName?.replace(/\s*\(sample\)\s*$/i, '') || 'database.db';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
