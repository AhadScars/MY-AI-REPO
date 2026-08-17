/**
 * SQLite engine via sql.js (WASM) — no native rebuild required.
 * Supports open/create .db files, run SQL from editor, list tables.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type {
  MysqlConnectionConfig,
  SqlConnectionState,
  SqlExecuteRequest,
  SqlExecuteResult,
  SqlOpenResult,
  SqlResultSet,
  SqlTableInfo,
} from '../../../packages/protocol/src/sql.js';
import { MysqlService } from './mysql-service.js';

// sql.js types are loose; keep local shape
type SqlJsDatabase = {
  run: (sql: string, params?: unknown[]) => void;
  exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
  prepare: (sql: string) => {
    bind: (params?: unknown[]) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    getColumnNames: () => string[];
    free: () => void;
  };
  export: () => Uint8Array;
  close: () => void;
  getRowsModified: () => number;
};

type SqlJsStatic = {
  Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
};

const require = createRequire(import.meta.url);

let SQL: SqlJsStatic | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require('sql.js') as (config?: {
    locateFile?: (file: string) => string;
  }) => Promise<SqlJsStatic>;

  let wasmPath: string | undefined;
  try {
    wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  } catch {
    // Fallbacks for packaged / alternate layouts
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.join(here, '../../../node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        wasmPath = c;
        break;
      }
    }
  }

  SQL = await initSqlJs({
    locateFile: (file) => {
      if (wasmPath && file.endsWith('.wasm')) return wasmPath;
      if (wasmPath) return path.join(path.dirname(wasmPath), file);
      return file;
    },
  });
  return SQL;
}

/** Split SQL into statements on bare `;` outside quotes / comments (simple). */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < sql.length) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (inLineComment) {
      cur += ch;
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      cur += ch;
      if (ch === '*' && next === '/') {
        cur += '/';
        i += 2;
        inBlockComment = false;
        continue;
      }
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === '-' && next === '-') {
        cur += ch;
        inLineComment = true;
        i += 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        cur += ch;
        inBlockComment = true;
        i += 1;
        continue;
      }
    }
    if (ch === "'" && !inDouble) {
      // handle escaped ''
      cur += ch;
      if (inSingle && next === "'") {
        cur += next;
        i += 2;
        continue;
      }
      inSingle = !inSingle;
      i += 1;
      continue;
    }
    if (ch === '"' && !inSingle) {
      cur += ch;
      inDouble = !inDouble;
      i += 1;
      continue;
    }
    if (ch === ';' && !inSingle && !inDouble) {
      const stmt = cur.trim();
      if (stmt) out.push(stmt);
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  const last = cur.trim();
  if (last) out.push(last);
  return out;
}

function isSelectLike(sql: string): boolean {
  const s = sql.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*/g, '').trimStart();
  return /^(select|with|pragma|explain|values)\b/i.test(s);
}

export class SqlService {
  private db: SqlJsDatabase | null = null;
  private dbPath: string | null = null;
  private dirty = false;
  readonly mysql = new MysqlService();

  getOpenPath(): string | null {
    return this.dbPath;
  }

  async getConnectionState(): Promise<SqlConnectionState> {
    if (this.mysql.isConnected()) {
      const cfg = this.mysql.getConfig()!;
      return {
        type: 'mysql',
        path: this.mysql.label(),
        label: this.mysql.label(),
        mysql: {
          host: cfg.host,
          port: cfg.port,
          user: cfg.user,
          database: cfg.database || null,
        },
        tables: await this.mysql.listTables().catch(() => []),
        databases: await this.mysql.listDatabases().catch(() => []),
      };
    }
    if (this.dbPath && this.db) {
      return {
        type: 'sqlite',
        path: this.dbPath,
        label: path.basename(this.dbPath),
        mysql: null,
        tables: this.listSqliteTables(),
        databases: [],
      };
    }
    return {
      type: null,
      path: null,
      label: null,
      mysql: null,
      tables: [],
      databases: [],
    };
  }

  async open(filePath: string): Promise<SqlOpenResult> {
    // Close MySQL if switching to sqlite
    await this.mysql.close();

    const abs = path.resolve(filePath);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Persist previous SQLite first
    if (this.db && this.dbPath) {
      this.persist();
      this.db.close();
      this.db = null;
      this.dbPath = null;
    }

    const Sql = await loadSqlJs();
    if (fs.existsSync(abs) && fs.statSync(abs).size > 0) {
      const buf = fs.readFileSync(abs);
      this.db = new Sql.Database(buf);
    } else {
      this.db = new Sql.Database();
      this.dirty = true;
    }
    this.dbPath = abs;
    this.persist();
    this.dirty = false;

    return {
      path: abs,
      tables: this.listSqliteTables(),
      type: 'sqlite',
      label: path.basename(abs),
    };
  }

  async connectMysql(cfg: MysqlConnectionConfig) {
    // Close sqlite when connecting mysql
    if (this.db && this.dbPath) {
      this.persist();
      this.db.close();
      this.db = null;
      this.dbPath = null;
    }
    const { databases, tables } = await this.mysql.connect(cfg);
    return {
      type: 'mysql' as const,
      label: this.mysql.label(),
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      database: cfg.database?.trim() || null,
      tables,
      databases,
    };
  }

  async close(): Promise<void> {
    if (this.db && this.dbPath) {
      this.persist();
      this.db.close();
    }
    this.db = null;
    this.dbPath = null;
    this.dirty = false;
    await this.mysql.close();
  }

  private ensureDb(): SqlJsDatabase {
    if (!this.db) throw new Error('No database open. Open or create a .db file first.');
    return this.db;
  }

  private persist(): void {
    if (!this.db || !this.dbPath) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
    this.dirty = false;
  }

  private listSqliteTables(): string[] {
    if (!this.db) return [];
    try {
      const res = this.db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      );
      if (!res[0]) return [];
      return res[0].values.map((r) => String(r[0]));
    } catch {
      return [];
    }
  }

  async listTables(): Promise<string[]> {
    if (this.mysql.isConnected()) return this.mysql.listTables();
    return this.listSqliteTables();
  }

  async tableInfo(name: string): Promise<SqlTableInfo> {
    if (this.mysql.isConnected()) return this.mysql.tableInfo(name);
    const db = this.ensureDb();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error('Invalid table name');
    }
    const res = db.exec(`PRAGMA table_info(${name})`);
    const columns =
      res[0]?.values.map((row) => ({
        name: String(row[1]),
        type: String(row[2] ?? ''),
        notnull: Boolean(row[3]),
        pk: Boolean(row[5]),
      })) ?? [];
    return { name, columns };
  }

  async execute(request: SqlExecuteRequest): Promise<SqlExecuteResult> {
    if (this.mysql.isConnected()) {
      return this.mysql.execute(request.sql, request.maxRows ?? 500);
    }

    const db = this.ensureDb();
    const maxRows = Math.min(Math.max(request.maxRows ?? 500, 1), 5000);
    const started = Date.now();
    const statements = splitSqlStatements(request.sql);
    if (statements.length === 0) {
      return { results: [], statementCount: 0, durationMs: 0, error: 'Empty SQL' };
    }

    const results: SqlResultSet[] = [];

    try {
      for (const stmt of statements) {
        if (isSelectLike(stmt)) {
          const stmtObj = db.prepare(stmt);
          try {
            const columns = stmtObj.getColumnNames();
            const rows: unknown[][] = [];
            let truncated = false;
            while (stmtObj.step()) {
              if (rows.length >= maxRows) {
                truncated = true;
                break;
              }
              const obj = stmtObj.getAsObject();
              rows.push(columns.map((c) => obj[c] ?? null));
            }
            results.push({
              columns,
              rows,
              changes: null,
              lastInsertRowid: null,
              truncated,
            });
          } finally {
            stmtObj.free();
          }
        } else {
          db.run(stmt);
          const changes = db.getRowsModified();
          this.dirty = true;
          let lastInsertRowid: number | null = null;
          try {
            const r = db.exec('SELECT last_insert_rowid() AS id');
            if (r[0]?.values[0]) lastInsertRowid = Number(r[0].values[0][0]);
          } catch {
            // ignore
          }
          results.push({
            columns: [],
            rows: [],
            changes,
            lastInsertRowid,
            truncated: false,
          });
        }
      }

      if (this.dirty) this.persist();

      return {
        results,
        statementCount: statements.length,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      if (this.dirty) {
        try {
          this.persist();
        } catch {
          // ignore
        }
      }
      return {
        results,
        statementCount: statements.length,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
