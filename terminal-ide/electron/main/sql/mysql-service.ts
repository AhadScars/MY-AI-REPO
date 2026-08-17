/**
 * MySQL / MariaDB (XAMPP) connection via mysql2.
 */
import { createRequire } from 'node:module';
import type {
  MysqlConnectionConfig,
  SqlExecuteResult,
  SqlResultSet,
  SqlTableInfo,
} from '../../../packages/protocol/src/sql.js';
import { splitSqlStatements } from './sql-service.js';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MysqlPool = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MysqlConn = any;

function loadMysql2(): {
  createPool: (opts: Record<string, unknown>) => MysqlPool;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('mysql2/promise') as {
    createPool: (opts: Record<string, unknown>) => MysqlPool;
  };
}

function isSelectLike(sql: string): boolean {
  const s = sql.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*/g, '').trimStart();
  return /^(select|with|show|describe|desc|explain|values)\b/i.test(s);
}

export class MysqlService {
  private pool: MysqlPool | null = null;
  private config: MysqlConnectionConfig | null = null;

  getConfig(): MysqlConnectionConfig | null {
    return this.config ? { ...this.config } : null;
  }

  isConnected(): boolean {
    return this.pool != null;
  }

  async connect(cfg: MysqlConnectionConfig): Promise<{
    databases: string[];
    tables: string[];
  }> {
    await this.close();
    const mysql = loadMysql2();
    const database = cfg.database?.trim() || undefined;
    const pool = mysql.createPool({
      host: cfg.host || 'localhost',
      port: cfg.port || 3306,
      user: cfg.user || 'root',
      password: cfg.password ?? '',
      database,
      waitForConnections: true,
      connectionLimit: 5,
      enableKeepAlive: true,
      // Allow multiple statements carefully — we split client-side
      multipleStatements: false,
      dateStrings: true,
    });

    // Test connection
    const conn: MysqlConn = await pool.getConnection();
    try {
      await conn.ping();
    } finally {
      conn.release();
    }

    this.pool = pool;
    this.config = {
      host: cfg.host || 'localhost',
      port: Number(cfg.port) || 3306,
      user: cfg.user || 'root',
      password: cfg.password ?? '',
      database: database ?? '',
      name: cfg.name,
      id: cfg.id,
    };

    const databases = await this.listDatabases();
    const tables = database ? await this.listTables() : [];
    return { databases, tables };
  }

  async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch {
        // ignore
      }
    }
    this.pool = null;
    this.config = null;
  }

  private ensurePool(): MysqlPool {
    if (!this.pool) {
      throw new Error('Not connected to MySQL. Configure XAMPP connection first.');
    }
    return this.pool;
  }

  async useDatabase(database: string): Promise<string[]> {
    const pool = this.ensurePool();
    const name = database.trim();
    if (!/^[A-Za-z0-9_$]+$/.test(name)) {
      throw new Error('Invalid database name');
    }
    await pool.query(`USE \`${name}\``);
    if (this.config) this.config.database = name;
    return this.listTables();
  }

  async listDatabases(): Promise<string[]> {
    const pool = this.ensurePool();
    const [rows] = await pool.query('SHOW DATABASES');
    const list = (rows as Array<Record<string, string>>).map((r) => Object.values(r)[0] as string);
    const skip = new Set(['information_schema', 'performance_schema', 'mysql', 'sys', 'phpmyadmin']);
    return list.filter((d) => d && !skip.has(d.toLowerCase())).sort();
  }

  async listTables(): Promise<string[]> {
    const pool = this.ensurePool();
    if (!this.config?.database) return [];
    const [rows] = await pool.query('SHOW TABLES');
    return (rows as Array<Record<string, string>>)
      .map((r) => Object.values(r)[0] as string)
      .filter(Boolean)
      .sort();
  }

  async tableInfo(name: string): Promise<SqlTableInfo> {
    const pool = this.ensurePool();
    if (!/^[A-Za-z0-9_$]+$/.test(name)) throw new Error('Invalid table name');
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${name}\``);
    const columns = (rows as Array<Record<string, unknown>>).map((r) => ({
      name: String(r.Field ?? r.field ?? ''),
      type: String(r.Type ?? r.type ?? ''),
      notnull: String(r.Null ?? r.null ?? '').toUpperCase() === 'NO',
      pk: String(r.Key ?? r.key ?? '').toUpperCase() === 'PRI',
    }));
    return { name, columns };
  }

  async execute(sql: string, maxRows = 500): Promise<SqlExecuteResult> {
    const pool = this.ensurePool();
    const limit = Math.min(Math.max(maxRows, 1), 5000);
    const started = Date.now();
    const statements = splitSqlStatements(sql);
    if (statements.length === 0) {
      return { results: [], statementCount: 0, durationMs: 0, error: 'Empty SQL' };
    }

    const results: SqlResultSet[] = [];
    try {
      for (const stmt of statements) {
        if (isSelectLike(stmt)) {
          const [rows, fields] = await pool.query(stmt);
          const arr = rows as unknown[];
          const columns =
            (fields as Array<{ name: string }> | undefined)?.map((f) => f.name) ??
            (arr[0] && typeof arr[0] === 'object'
              ? Object.keys(arr[0] as object)
              : []);
          const truncated = arr.length > limit;
          const slice = (arr as Record<string, unknown>[]).slice(0, limit);
          results.push({
            columns,
            rows: slice.map((row) =>
              columns.map((c) => {
                const v = row[c];
                if (v === undefined) return null;
                if (Buffer.isBuffer(v)) return v.toString('utf8');
                if (typeof v === 'bigint') return v.toString();
                return v;
              }),
            ),
            changes: null,
            lastInsertRowid: null,
            truncated,
          });
        } else {
          const [result] = await pool.query(stmt);
          const header = result as { affectedRows?: number; insertId?: number };
          results.push({
            columns: [],
            rows: [],
            changes: header.affectedRows ?? 0,
            lastInsertRowid: header.insertId ?? null,
            truncated: false,
          });
          // USE database statement
          const useMatch = stmt.match(/^\s*use\s+[`"]?([A-Za-z0-9_$]+)[`"]?/i);
          if (useMatch?.[1] && this.config) {
            this.config.database = useMatch[1];
          }
        }
      }
      return {
        results,
        statementCount: statements.length,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      return {
        results,
        statementCount: statements.length,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  label(): string {
    if (!this.config) return 'MySQL';
    const db = this.config.database || '(no database)';
    return `${this.config.user}@${this.config.host}:${this.config.port}/${db}`;
  }
}
