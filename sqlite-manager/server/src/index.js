const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3847;

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const SAMPLE_DIR = path.resolve(__dirname, '..', '..', 'sample-data');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(SAMPLE_DIR)) fs.mkdirSync(SAMPLE_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = (file.originalname || 'database.db').replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
});

/** @type {DatabaseSync | null} */
let db = null;
let dbMeta = { path: null, name: null };

function requireDb(_req, res, next) {
  if (!db) return res.status(400).json({ error: 'No database open. Upload or open a SQLite file first.' });
  next();
}

/** Allow typical SQL identifiers; quote everything for safety. */
function isSafeIdent(name) {
  return typeof name === 'string' && name.length > 0 && name.length < 200 && !name.includes('\0');
}

function quoteIdent(name) {
  if (!isSafeIdent(name)) throw new Error(`Invalid identifier: ${name}`);
  return `"${String(name).replace(/"/g, '""')}"`;
}

function closeDb() {
  if (db) {
    try {
      db.close();
    } catch (_) {
      /* ignore */
    }
    db = null;
  }
  dbMeta = { path: null, name: null };
}

function isSqliteFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    if (n < 16) return false;
    return buf.toString('utf8', 0, 15) === 'SQLite format 3';
  } catch {
    return false;
  }
}

function openDatabase(filePath, displayName) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }
  const stat = fs.statSync(abs);
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }
  if (stat.size < 100) {
    throw new Error('File is too small to be a valid SQLite database');
  }
  if (!isSqliteFile(abs)) {
    throw new Error('Not a valid SQLite database (missing SQLite header). Use a .db / .sqlite file.');
  }

  closeDb();

  // Brief pause helps WSL/Windows release file handles after close
  // when re-opening the same path.
  try {
    db = new DatabaseSync(abs);
  } catch (err) {
    // Retry once after a short delay for lock/handle races
    const start = Date.now();
    while (Date.now() - start < 80) {
      /* spin */
    }
    try {
      db = new DatabaseSync(abs);
    } catch (err2) {
      throw new Error(
        `Unable to open database: ${err2.message || err.message}. ` +
          'If the file is open in another program, close it and try again.'
      );
    }
  }

  // Sanity query
  try {
    db.prepare('SELECT 1 AS ok').get();
  } catch (err) {
    closeDb();
    throw new Error(`Database opened but is not readable: ${err.message}`);
  }

  dbMeta = { path: abs, name: displayName || path.basename(abs) };
  return dbMeta;
}

/** Copy source into uploads under a unique name, then open the copy. */
function openViaCopy(sourcePath, displayName) {
  const absSource = path.resolve(sourcePath);
  const safe = (displayName || path.basename(absSource)).replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = path.join(UPLOAD_DIR, `${Date.now()}-${safe}`);
  fs.copyFileSync(absSource, dest);
  return openDatabase(dest, displayName || path.basename(absSource));
}

function getTables() {
  const rows = db
    .prepare(
      `
    SELECT name, type
    FROM sqlite_master
    WHERE type IN ('table', 'view')
      AND name NOT LIKE 'sqlite_%'
    ORDER BY type, name COLLATE NOCASE
  `
    )
    .all();
  return rows.map((r) => ({ name: r.name, type: r.type }));
}

function getColumns(table) {
  const cols = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  return cols.map((c) => ({
    cid: c.cid,
    name: c.name,
    type: c.type || 'ANY',
    notnull: !!c.notnull,
    defaultValue: c.dflt_value,
    pk: c.pk || 0,
  }));
}

function getPrimaryKeyColumns(columns) {
  return columns
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);
}

function serializeRows(rows) {
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) out[k] = null;
      else if (typeof v === 'bigint') out[k] = v.toString();
      else if (Buffer.isBuffer(v)) out[k] = `[BLOB ${v.length} bytes]`;
      else out[k] = v;
    }
    return out;
  });
}

// ---------- Routes ----------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, open: !!db, database: dbMeta.name });
});

app.get('/api/status', (_req, res) => {
  if (!db) return res.json({ open: false, database: null, tables: [] });
  try {
    res.json({ open: true, database: dbMeta.name, path: dbMeta.path, tables: getTables() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/open', (req, res) => {
  upload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || 'Upload failed' });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Choose a .db or .sqlite file.' });
      }
      const original = req.file.originalname || 'database.db';
      const dest = req.file.path; // already in UPLOAD_DIR with unique name
      openDatabase(dest, original);
      res.json({ ok: true, database: dbMeta.name, tables: getTables() });
    } catch (err) {
      closeDb();
      // cleanup bad upload
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }
      res.status(500).json({ error: err.message || 'Failed to open database' });
    }
  });
});

app.post('/api/open-sample', (_req, res) => {
  try {
    const samplePath = path.join(SAMPLE_DIR, 'demo.db');
    if (!fs.existsSync(samplePath)) {
      // try to create it
      try {
        require('./create-sample.js');
      } catch (_) {
        /* create-sample exits after write; also runs as script */
      }
    }
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({
        error: `Sample database not found at ${samplePath}. Run: npm run sample`,
      });
    }
    // Always open a fresh copy so locks / regenerate never block
    openViaCopy(samplePath, 'demo.db (sample)');
    res.json({ ok: true, database: dbMeta.name, tables: getTables() });
  } catch (err) {
    closeDb();
    res.status(500).json({ error: err.message || 'Failed to open sample database' });
  }
});

app.post('/api/close', (_req, res) => {
  closeDb();
  res.json({ ok: true });
});

app.get('/api/download', requireDb, (_req, res) => {
  const filePath = dbMeta.path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Database file not found' });
  }
  res.download(filePath, dbMeta.name || 'database.db');
});

app.get('/api/tables', requireDb, (_req, res) => {
  try {
    res.json({ tables: getTables() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tables/:table/schema', requireDb, (req, res) => {
  try {
    const table = req.params.table;
    if (!isSafeIdent(table)) return res.status(400).json({ error: 'Invalid table name' });
    const columns = getColumns(table);
    if (!columns.length) return res.status(404).json({ error: 'Table not found' });
    res.json({ table, columns, primaryKey: getPrimaryKeyColumns(columns) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tables/:table/rows', requireDb, (req, res) => {
  try {
    const table = req.params.table;
    if (!isSafeIdent(table)) return res.status(400).json({ error: 'Invalid table name' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').toString().trim();
    const sortCol = (req.query.sort || '').toString();
    const sortDir = (req.query.dir || 'asc').toString().toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const columns = getColumns(table);
    if (!columns.length) return res.status(404).json({ error: 'Table not found' });

    const colNames = columns.map((c) => c.name);
    let where = '';
    const params = [];

    if (search) {
      const parts = colNames.map((c) => `CAST(${quoteIdent(c)} AS TEXT) LIKE ?`);
      where = `WHERE ${parts.join(' OR ')}`;
      const like = `%${search}%`;
      for (let i = 0; i < colNames.length; i++) params.push(like);
    }

    let order = 'ORDER BY rowid';
    if (sortCol && colNames.includes(sortCol)) {
      order = `ORDER BY ${quoteIdent(sortCol)} ${sortDir}`;
    }

    const countRow = db.prepare(`SELECT COUNT(*) AS n FROM ${quoteIdent(table)} ${where}`).get(...params);
    const total = Number(countRow?.n || 0);

    const sql = `
      SELECT rowid AS __rowid__, *
      FROM ${quoteIdent(table)}
      ${where}
      ${order}
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(sql).all(...params, limit, offset);

    res.json({
      table,
      columns,
      primaryKey: getPrimaryKeyColumns(columns),
      rows: serializeRows(rows),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tables/:table/rows', requireDb, (req, res) => {
  try {
    const table = req.params.table;
    if (!isSafeIdent(table)) return res.status(400).json({ error: 'Invalid table name' });

    const { rowid, values } = req.body || {};
    if (rowid === undefined || rowid === null) {
      return res.status(400).json({ error: 'rowid is required' });
    }
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'values object is required' });
    }

    const columns = getColumns(table);
    const colNames = new Set(columns.map((c) => c.name));
    const entries = Object.entries(values).filter(([k]) => colNames.has(k));
    if (!entries.length) return res.status(400).json({ error: 'No valid columns to update' });

    const sets = entries.map(([k]) => `${quoteIdent(k)} = ?`).join(', ');
    const params = entries.map(([, v]) => (v === '' ? null : v));
    params.push(rowid);

    const info = db.prepare(`UPDATE ${quoteIdent(table)} SET ${sets} WHERE rowid = ?`).run(...params);
    res.json({ ok: true, changes: info.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tables/:table/rows', requireDb, (req, res) => {
  try {
    const table = req.params.table;
    if (!isSafeIdent(table)) return res.status(400).json({ error: 'Invalid table name' });

    const { rowid, rowids } = req.body || {};
    const ids = Array.isArray(rowids) ? rowids : rowid !== undefined ? [rowid] : [];
    if (!ids.length) return res.status(400).json({ error: 'rowid or rowids required' });

    const stmt = db.prepare(`DELETE FROM ${quoteIdent(table)} WHERE rowid = ?`);
    let changes = 0;
    db.exec('BEGIN');
    try {
      for (const id of ids) {
        const info = stmt.run(id);
        changes += info.changes;
      }
      db.exec('COMMIT');
    } catch (e) {
      try {
        db.exec('ROLLBACK');
      } catch (_) {
        /* ignore */
      }
      throw e;
    }
    res.json({ ok: true, changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tables/:table/rows', requireDb, (req, res) => {
  try {
    const table = req.params.table;
    if (!isSafeIdent(table)) return res.status(400).json({ error: 'Invalid table name' });

    const { values } = req.body || {};
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'values object is required' });
    }

    const columns = getColumns(table);
    const colNames = new Set(columns.map((c) => c.name));
    const entries = Object.entries(values).filter(([k]) => colNames.has(k));

    if (!entries.length) {
      const info = db.prepare(`INSERT INTO ${quoteIdent(table)} DEFAULT VALUES`).run();
      return res.json({ ok: true, changes: info.changes, lastInsertRowid: String(info.lastInsertRowid) });
    }

    const cols = entries.map(([k]) => quoteIdent(k)).join(', ');
    const placeholders = entries.map(() => '?').join(', ');
    const params = entries.map(([, v]) => (v === '' ? null : v));
    const info = db
      .prepare(`INSERT INTO ${quoteIdent(table)} (${cols}) VALUES (${placeholders})`)
      .run(...params);

    res.json({ ok: true, changes: info.changes, lastInsertRowid: String(info.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Request failed' });
});

app.listen(PORT, () => {
  console.log(`SQLite Manager API running on http://localhost:${PORT}`);
  console.log(`Uploads: ${UPLOAD_DIR}`);
  console.log(`Sample:  ${path.join(SAMPLE_DIR, 'demo.db')}`);
});
