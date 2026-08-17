/**
 * Project database discovery + configuration.
 * Config file: <project>/.terminal-ide/databases.json
 */
import fs from 'node:fs';
import path from 'node:path';

export type ProjectDbType = 'sqlite' | 'mysql';

export interface ProjectDbEntry {
  /** Stable id (unique within project). */
  id: string;
  /** Display name */
  name: string;
  type: ProjectDbType;
  /** Path relative to project root, or absolute (sqlite) */
  path?: string;
  description?: string;
  /** MySQL / XAMPP fields */
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export interface ProjectDbConfig {
  version: 1;
  /** id of default database */
  default?: string | null;
  databases: ProjectDbEntry[];
}

export interface DiscoveredProjectDb {
  id: string;
  name: string;
  type: ProjectDbType;
  /** Absolute path on disk (sqlite); empty for mysql */
  absolutePath: string;
  /** Relative to project root when possible */
  relativePath: string;
  description?: string;
  /** From config vs auto-scanned file */
  source: 'config' | 'scan';
  exists: boolean;
  isDefault: boolean;
  mysql?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database?: string;
    name?: string;
    id?: string;
  };
}

export interface ProjectDbDiscoverResult {
  rootPath: string;
  configPath: string;
  config: ProjectDbConfig | null;
  databases: DiscoveredProjectDb[];
  sqlite3Available: boolean;
  sqlite3Path: string | null;
}

const CONFIG_DIR = '.terminal-ide';
const CONFIG_FILE = 'databases.json';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'release',
  '.next',
  'coverage',
  'dist-electron',
  '.cache',
  '__pycache__',
  'venv',
  '.venv',
  'target',
]);

const DB_EXTS = new Set(['.db', '.sqlite', '.sqlite3']);

export function projectConfigPath(rootPath: string): string {
  return path.join(rootPath, CONFIG_DIR, CONFIG_FILE);
}

export function defaultProjectConfig(): ProjectDbConfig {
  return {
    version: 1,
    default: 'xampp',
    databases: [
      {
        id: 'xampp',
        name: 'XAMPP Local',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: '',
        description: 'XAMPP MySQL/MariaDB on localhost',
      },
    ],
  };
}

export function defaultXamppEntry(database = ''): ProjectDbEntry {
  return {
    id: 'xampp',
    name: 'XAMPP Local',
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database,
    description: 'XAMPP MySQL/MariaDB on localhost',
  };
}

export function readProjectConfig(rootPath: string): ProjectDbConfig | null {
  const file = projectConfigPath(rootPath);
  try {
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<ProjectDbConfig>;
    const databases = Array.isArray(raw.databases)
      ? raw.databases
          .filter((d) => d && (d.type === 'mysql' || (typeof d.path === 'string' && d.path.trim())))
          .map((d, i) => {
            const type: ProjectDbType = d.type === 'mysql' ? 'mysql' : 'sqlite';
            if (type === 'mysql') {
              return {
                id: String(d.id || `mysql${i + 1}`),
                name: String(d.name || d.id || `MySQL ${i + 1}`),
                type: 'mysql' as const,
                host: String(d.host || 'localhost'),
                port: Number(d.port) || 3306,
                user: String(d.user || 'root'),
                password: String(d.password ?? ''),
                database: d.database != null ? String(d.database) : '',
                description: d.description ? String(d.description) : undefined,
              };
            }
            return {
              id: String(d.id || `db${i + 1}`),
              name: String(d.name || d.id || `Database ${i + 1}`),
              type: 'sqlite' as const,
              path: String(d.path).trim(),
              description: d.description ? String(d.description) : undefined,
            };
          })
      : [];
    return {
      version: 1,
      default: raw.default ?? databases[0]?.id ?? null,
      databases,
    };
  } catch {
    return null;
  }
}

export function writeProjectConfig(rootPath: string, config: ProjectDbConfig): string {
  const dir = path.join(rootPath, CONFIG_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const file = projectConfigPath(rootPath);
  const payload: ProjectDbConfig = {
    version: 1,
    default: config.default ?? config.databases[0]?.id ?? null,
    databases: config.databases,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  return file;
}

function resolveDbPath(rootPath: string, dbPath: string): string {
  if (path.isAbsolute(dbPath)) return path.normalize(dbPath);
  return path.normalize(path.join(rootPath, dbPath));
}

function toRelative(rootPath: string, abs: string): string {
  const rel = path.relative(rootPath, abs);
  if (!rel || rel.startsWith('..')) return abs;
  return rel.split(path.sep).join('/');
}

export function whichSqlite3(): string | null {
  const pathEnv = process.env.PATH ?? process.env.Path ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const names =
    process.platform === 'win32'
      ? ['sqlite3.exe', 'sqlite3.cmd', 'sqlite3']
      : ['sqlite3'];
  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').filter(Boolean)
      : [''];

  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    for (const name of names) {
      for (const ext of exts) {
        const candidate = path.join(dir, name.endsWith(ext) || !ext ? name : name + ext);
        try {
          if (fs.existsSync(candidate)) return candidate;
        } catch {
          // continue
        }
      }
    }
  }
  return null;
}

function scanDbFiles(rootPath: string, maxFiles = 40, maxDepth = 6): string[] {
  const found: string[] = [];

  const walk = (dir: string, depth: number) => {
    if (found.length >= maxFiles || depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (found.length >= maxFiles) break;
      if (e.name.startsWith('.') && e.name !== '.terminal-ide') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(full, depth + 1);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (DB_EXTS.has(ext)) found.push(full);
      }
    }
  };

  walk(rootPath, 0);
  return found;
}

export function discoverProjectDatabases(rootPath: string): ProjectDbDiscoverResult {
  const root = path.resolve(rootPath);
  const configPath = projectConfigPath(root);
  const config = readProjectConfig(root);
  const sqlite3Path = whichSqlite3();

  const byAbs = new Map<string, DiscoveredProjectDb>();

  if (config) {
    for (const entry of config.databases) {
      if (entry.type === 'mysql') {
        const key = `mysql:${entry.id}:${entry.host}:${entry.port}:${entry.database || ''}`;
        byAbs.set(key, {
          id: entry.id,
          name: entry.name,
          type: 'mysql',
          absolutePath: '',
          relativePath: `${entry.user}@${entry.host}:${entry.port}/${entry.database || '*'}`,
          description: entry.description ?? 'MySQL / XAMPP',
          source: 'config',
          exists: true,
          isDefault: config.default === entry.id,
          mysql: {
            id: entry.id,
            name: entry.name,
            host: entry.host || 'localhost',
            port: entry.port || 3306,
            user: entry.user || 'root',
            password: entry.password ?? '',
            database: entry.database || '',
          },
        });
        continue;
      }
      if (!entry.path) continue;
      const abs = resolveDbPath(root, entry.path);
      const key = abs.toLowerCase();
      byAbs.set(key, {
        id: entry.id,
        name: entry.name,
        type: 'sqlite',
        absolutePath: abs,
        relativePath: toRelative(root, abs),
        description: entry.description,
        source: 'config',
        exists: fs.existsSync(abs),
        isDefault: config.default === entry.id,
      });
    }
  }

  // Auto-scan file system for sqlite files not already listed
  const scanned = scanDbFiles(root);
  let scanIdx = 0;
  for (const abs of scanned) {
    const key = abs.toLowerCase();
    if (byAbs.has(key)) continue;
    scanIdx += 1;
    const base = path.basename(abs, path.extname(abs));
    byAbs.set(key, {
      id: `scan-${scanIdx}-${base}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      name: path.basename(abs),
      type: 'sqlite',
      absolutePath: abs,
      relativePath: toRelative(root, abs),
      description: 'Found in project',
      source: 'scan',
      exists: true,
      isDefault: false,
    });
  }

  // Prefer default first, then config, then scan
  const databases = [...byAbs.values()].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.source !== b.source) return a.source === 'config' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    rootPath: root,
    configPath,
    config,
    databases,
    sqlite3Available: Boolean(sqlite3Path),
    sqlite3Path,
  };
}

/** Save or update a MySQL/XAMPP entry in project config. */
export function saveMysqlConfig(
  rootPath: string,
  cfg: {
    id?: string;
    name?: string;
    host: string;
    port: number;
    user: string;
    password: string;
    database?: string;
    setDefault?: boolean;
  },
): { configPath: string; config: ProjectDbConfig } {
  const root = path.resolve(rootPath);
  const config = readProjectConfig(root) ?? { version: 1 as const, default: null, databases: [] as ProjectDbEntry[] };
  const id = cfg.id || 'xampp';
  const entry: ProjectDbEntry = {
    id,
    name: cfg.name || 'XAMPP Local',
    type: 'mysql',
    host: cfg.host || 'localhost',
    port: Number(cfg.port) || 3306,
    user: cfg.user || 'root',
    password: cfg.password ?? '',
    database: cfg.database ?? '',
    description: 'XAMPP MySQL/MariaDB',
  };
  const idx = config.databases.findIndex((d) => d.id === id || d.type === 'mysql');
  if (idx >= 0) config.databases[idx] = { ...config.databases[idx], ...entry };
  else config.databases.unshift(entry);
  if (cfg.setDefault !== false) config.default = entry.id;
  const configPath = writeProjectConfig(root, config);
  return { configPath, config };
}

/** Create config (if missing) and ensure default sqlite file exists under project. */
export function ensureProjectDatabase(
  rootPath: string,
  opts?: { id?: string; name?: string; relativePath?: string },
): { configPath: string; absolutePath: string; entry: ProjectDbEntry; createdFile: boolean } {
  const root = path.resolve(rootPath);
  let config = readProjectConfig(root) ?? defaultProjectConfig();

  const id = opts?.id ?? 'main';
  const relativePath = (opts?.relativePath ?? 'data/database.db').replace(/\\/g, '/');
  const name = opts?.name ?? 'Main';

  let entry = config.databases.find((d) => d.id === id);
  if (!entry) {
    entry = {
      id,
      name,
      type: 'sqlite',
      path: relativePath,
      description: 'Primary project SQLite database',
    };
    config.databases.push(entry);
  } else if (opts?.relativePath) {
    entry.path = relativePath;
  }
  if (!config.default) config.default = entry.id;

  const configPath = writeProjectConfig(root, config);
  const pathForFile = entry.path || relativePath;
  const absolutePath = resolveDbPath(root, pathForFile);
  let createdFile = false;
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, Buffer.alloc(0));
    createdFile = true;
  }

  return { configPath, absolutePath, entry, createdFile };
}

/** Add or update a database entry in project config (path may be abs or relative). */
export function registerProjectDatabase(
  rootPath: string,
  entry: { id?: string; name?: string; path: string; description?: string; setDefault?: boolean },
): ProjectDbConfig {
  const root = path.resolve(rootPath);
  const config = readProjectConfig(root) ?? { version: 1 as const, default: null, databases: [] };
  const abs = resolveDbPath(root, entry.path);
  const rel = toRelative(root, abs);
  const id =
    entry.id ??
    (path
      .basename(abs, path.extname(abs))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase() ||
      'db');

  const existingIdx = config.databases.findIndex(
    (d) =>
      d.id === id ||
      (d.path != null && resolveDbPath(root, d.path).toLowerCase() === abs.toLowerCase()),
  );
  const next: ProjectDbEntry = {
    id: existingIdx >= 0 ? config.databases[existingIdx]!.id : id,
    name: entry.name ?? (existingIdx >= 0 ? config.databases[existingIdx]!.name : path.basename(abs)),
    type: 'sqlite',
    path: rel.includes('..') || path.isAbsolute(rel) ? abs : rel,
    description: entry.description,
  };

  if (existingIdx >= 0) config.databases[existingIdx] = { ...config.databases[existingIdx], ...next };
  else config.databases.push(next);

  if (entry.setDefault || !config.default) config.default = next.id;
  writeProjectConfig(root, config);
  return config;
}

/** Shell command to open interactive sqlite3 CLI (or echo guidance). */
export function buildTerminalDbCommand(
  dbAbsolutePath: string,
  sqlite3Path: string | null,
): { command: string; label: string } {
  const quoted =
    process.platform === 'win32'
      ? `"${dbAbsolutePath.replace(/"/g, '""')}"`
      : `'${dbAbsolutePath.replace(/'/g, `'\\''`)}'`;

  if (sqlite3Path) {
    const tool =
      process.platform === 'win32' && sqlite3Path.includes(' ')
        ? `"${sqlite3Path}"`
        : process.platform === 'win32'
          ? sqlite3Path
          : `'${sqlite3Path}'`;
    return {
      command: `${tool} ${quoted}\r`,
      label: 'sqlite3',
    };
  }

  if (process.platform === 'win32') {
    return {
      command:
        `Write-Host "Database: ${dbAbsolutePath.replace(/"/g, '`"')}" -ForegroundColor Cyan; ` +
        `Write-Host "Install sqlite3 CLI to interact interactively, or use the IDE SQL panel (F5)." -ForegroundColor Yellow; ` +
        `Write-Host "Tip: choco install sqlite  OR  scoop install sqlite" -ForegroundColor DarkGray\r`,
      label: 'info',
    };
  }
  return {
    command:
      `echo "Database: ${dbAbsolutePath}"; ` +
      `echo "Install sqlite3 for interactive CLI (e.g. apt install sqlite3), or use the IDE SQL panel (F5).";\n`,
    label: 'info',
  };
}

/** Build mysql CLI command for XAMPP / MariaDB. */
export function buildMysqlTerminalCommand(cfg: {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}): { command: string; label: string; mysqlCliAvailable: boolean } {
  const mysqlPath = whichMysqlCli();
  const host = cfg.host || 'localhost';
  const port = cfg.port || 3306;
  const user = cfg.user || 'root';
  const db = cfg.database?.trim();

  if (mysqlPath) {
    // Prefer MYSQL_PWD env for non-interactive password (local dev only)
    const tool =
      process.platform === 'win32' && mysqlPath.includes(' ')
        ? `"${mysqlPath}"`
        : process.platform === 'win32'
          ? mysqlPath
          : `'${mysqlPath}'`;
    const dbArg = db ? ` ${db}` : '';
    if (process.platform === 'win32') {
      const pwd = cfg.password ? `$env:MYSQL_PWD='${cfg.password.replace(/'/g, "''")}'; ` : '';
      return {
        command: `${pwd}${tool} -h ${host} -P ${port} -u ${user}${dbArg}\r`,
        label: 'mysql',
        mysqlCliAvailable: true,
      };
    }
    const pwd = cfg.password ? `MYSQL_PWD='${cfg.password.replace(/'/g, `'\\''`)}' ` : '';
    return {
      command: `${pwd}${tool} -h ${host} -P ${port} -u ${user}${dbArg}\n`,
      label: 'mysql',
      mysqlCliAvailable: true,
    };
  }

  // Common XAMPP path hints on Windows
  if (process.platform === 'win32') {
    return {
      command:
        `Write-Host "MySQL: ${user}@${host}:${port}${db ? '/' + db : ''}" -ForegroundColor Cyan; ` +
        `Write-Host "mysql CLI not on PATH. Try: C:\\xampp\\mysql\\bin\\mysql.exe -u root -p" -ForegroundColor Yellow; ` +
        `Write-Host "Or use the IDE SQL panel (F5) to run queries." -ForegroundColor DarkGray\r`,
      label: 'info',
      mysqlCliAvailable: false,
    };
  }
  return {
    command:
      `echo "MySQL: ${user}@${host}:${port}${db ? '/' + db : ''}"; ` +
      `echo "mysql CLI not found. Use the IDE SQL panel (F5).";\n`,
    label: 'info',
    mysqlCliAvailable: false,
  };
}

export function whichMysqlCli(): string | null {
  const candidates: string[] = [];
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\xampp\\mysql\\bin\\mysql.exe',
      'C:\\xampp\\mysql\\bin\\mysql',
      'D:\\xampp\\mysql\\bin\\mysql.exe',
    );
  } else {
    candidates.push('/opt/lampp/bin/mysql', '/usr/bin/mysql');
  }
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // continue
    }
  }
  // PATH
  const pathEnv = process.env.PATH ?? process.env.Path ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const names = process.platform === 'win32' ? ['mysql.exe', 'mysql'] : ['mysql'];
  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    for (const name of names) {
      const full = path.join(dir, name);
      try {
        if (fs.existsSync(full)) return full;
      } catch {
        // continue
      }
    }
  }
  return null;
}
