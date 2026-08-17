import { create } from 'zustand';
import { requireApi } from '../services/platform';
import { useEditorStore } from './editorStore';
import { useLayoutStore } from './layoutStore';
import { useWorkspaceStore } from './workspaceStore';
import { useTerminalStore } from './terminalStore';
import { basename, joinPath } from '../../packages/shared/src/path';
import type {
  MysqlConnectionConfig,
  ProjectDatabaseInfo,
  SqlResultSet,
  SqlTableInfo,
} from '../../packages/protocol/src/sql';
import { XAMPP_MYSQL_DEFAULTS } from '../../packages/protocol/src/sql';
import {
  buildDeleteSql,
  buildInsertSql,
  buildUpdateSql,
  cellToDisplay,
  type ColMeta,
} from '../features/sql/tableEditSql';

export interface TablePreview {
  columns: Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
  rows: unknown[][];
  truncated: boolean;
}

export interface EditorRow {
  id: string;
  /** Display/edit values; null = SQL NULL */
  cells: (string | null)[];
  /** Snapshot when loaded (for UPDATE WHERE) */
  original: (string | null)[];
  isNew: boolean;
  deleted: boolean;
}

export interface TableEditorState {
  schemaKey: string;
  table: string;
  columns: Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
  rows: EditorRow[];
  selected: Set<string>;
  truncated: boolean;
  pageSize: number;
}

interface SqlState {
  engineType: 'sqlite' | 'mysql' | null;
  dbPath: string | null;
  connectionLabel: string | null;
  mysql: {
    host: string;
    port: number;
    user: string;
    database: string | null;
    /** Kept in memory only for terminal CLI (not re-read from disk) */
    password?: string;
  } | null;
  /** Schemas on MySQL server */
  mysqlDatabases: string[];
  tables: string[];
  tableInfo: SqlTableInfo | null;
  results: SqlResultSet[];
  lastError: string | null;
  lastMessage: string | null;
  durationMs: number | null;
  isRunning: boolean;
  recentDbPaths: string[];

  projectDatabases: ProjectDatabaseInfo[];
  projectConfigPath: string | null;
  hasProjectConfig: boolean;
  needsSetup: boolean;
  configDialogOpen: boolean;
  configDraft: Partial<MysqlConnectionConfig> | null;
  sqlite3Available: boolean;
  discovering: boolean;
  /**
   * User clicked Disconnect — skip auto-connect on discover/toggle until they Connect again.
   */
  userDisconnected: boolean;

  /** Explorer tree state */
  expandedSchemas: Set<string>;
  expandedTables: Set<string>;
  expandedRowGroups: Set<string>;
  /** tables per schema key */
  schemaTables: Record<string, string[]>;
  tablePreviews: Record<string, TablePreview>;
  loadingNodes: Set<string>;

  /** Visual grid editor (phpMyAdmin-style) */
  tableEditor: TableEditorState | null;

  refreshOpen: () => Promise<void>;
  discoverProject: (rootPath?: string | null) => Promise<void>;
  openConfigDialog: (draft?: Partial<MysqlConnectionConfig> | null) => void;
  closeConfigDialog: () => void;
  connectMysql: (
    config: MysqlConnectionConfig,
    options?: { save?: boolean },
  ) => Promise<boolean>;
  useMysqlDatabase: (database: string) => Promise<void>;
  openDatabase: (path?: string) => Promise<void>;
  newDatabase: () => Promise<void>;
  createProjectDatabase: () => Promise<void>;
  openProjectDatabase: (db: ProjectDatabaseInfo) => Promise<void>;
  registerCurrentInProject: () => Promise<void>;
  openProjectConfig: () => Promise<void>;
  openInTerminal: (dbPath?: string | null) => Promise<void>;
  /** Ensure terminal session and send lines (login + SQL for editing). */
  writeTerminalLines: (lines: string[]) => Promise<void>;
  toggleSchema: (schemaKey: string) => Promise<void>;
  toggleTable: (schemaKey: string, table: string) => Promise<void>;
  toggleRowGroup: (schemaKey: string, table: string) => void;
  loadSchemaTables: (schemaKey: string) => Promise<void>;
  loadTablePreview: (schemaKey: string, table: string) => Promise<void>;
  editTableInTerminal: (schemaKey: string, table: string) => Promise<void>;
  editRowInTerminal: (
    schemaKey: string,
    table: string,
    row: unknown[],
    rowIndex: number,
  ) => Promise<void>;
  openTableQuery: (schemaKey: string, table: string) => void;
  /** Open visual table editor (edit rows without SQL). */
  openTableEditor: (schemaKey: string, table: string) => Promise<void>;
  closeTableEditor: () => void;
  reloadTableEditor: () => Promise<void>;
  setEditorCell: (rowId: string, colIndex: number, value: string | null) => void;
  toggleEditorNull: (rowId: string, colIndex: number) => void;
  toggleEditorRowSelected: (rowId: string) => void;
  toggleSelectAllEditorRows: () => void;
  addEditorRow: () => void;
  deleteSelectedEditorRows: () => void;
  saveTableEditor: () => Promise<void>;
  closeDatabase: () => Promise<void>;
  refreshTables: () => Promise<void>;
  loadTableInfo: (name: string) => Promise<void>;
  runActiveSql: () => Promise<void>;
  runSql: (sql: string) => Promise<void>;
  previewTable: (name: string) => Promise<void>;
}

function withLoading(set: (p: Partial<SqlState>) => void, get: () => SqlState, key: string) {
  const next = new Set(get().loadingNodes);
  next.add(key);
  set({ loadingNodes: next });
  return () => {
    const n = new Set(get().loadingNodes);
    n.delete(key);
    set({ loadingNodes: n });
  };
}

async function ensureTerminalSession(): Promise<string | null> {
  const root = useWorkspaceStore.getState().rootPath;
  useLayoutStore.getState().setBottomPanelTab('terminal');
  if (!useLayoutStore.getState().bottomPanelVisible) {
    useLayoutStore.setState({ bottomPanelVisible: true });
  }
  const term = useTerminalStore.getState();
  let sessionId = term.activeSessionId;
  if (!sessionId || !term.sessions.find((s) => s.id === sessionId && s.status === 'running')) {
    sessionId = await term.createSession({ cwd: root ?? undefined });
  }
  return sessionId;
}

const RECENT_KEY = 'sql.recentDbPaths';

export const useSqlStore = create<SqlState>((set, get) => ({
  engineType: null,
  dbPath: null,
  connectionLabel: null,
  mysql: null,
  mysqlDatabases: [],
  tables: [],
  tableInfo: null,
  results: [],
  lastError: null,
  lastMessage: null,
  durationMs: null,
  isRunning: false,
  recentDbPaths: [],
  projectDatabases: [],
  projectConfigPath: null,
  hasProjectConfig: false,
  needsSetup: false,
  configDialogOpen: false,
  configDraft: null,
  sqlite3Available: false,
  discovering: false,
  userDisconnected: false,
  expandedSchemas: new Set(),
  expandedTables: new Set(),
  expandedRowGroups: new Set(),
  schemaTables: {},
  tablePreviews: {},
  loadingNodes: new Set(),
  tableEditor: null,

  refreshOpen: async () => {
    try {
      const api = requireApi();
      const open = await api.sqlGetOpen();
      set({
        dbPath: open.path,
        tables: open.tables ?? [],
        engineType: open.type ?? null,
        connectionLabel: open.label ?? open.path,
        mysql: open.mysql ?? null,
        mysqlDatabases: open.databases ?? [],
      });
      try {
        const recent = await api.getSetting<string[]>({ key: RECENT_KEY });
        if (Array.isArray(recent)) {
          set({ recentDbPaths: recent.filter((p) => typeof p === 'string').slice(0, 8) });
        }
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  },

  discoverProject: async (rootPath) => {
    const root = rootPath ?? useWorkspaceStore.getState().rootPath;
    if (!root) {
      set({
        projectDatabases: [],
        projectConfigPath: null,
        hasProjectConfig: false,
        needsSetup: false,
      });
      return;
    }
    set({ discovering: true, lastError: null });
    try {
      const api = requireApi();
      const result = await api.sqlDiscoverProject({ rootPath: root });
      set({
        projectDatabases: result.databases,
        projectConfigPath: result.configPath,
        hasProjectConfig: result.hasConfig,
        needsSetup: result.needsSetup,
        sqlite3Available: result.sqlite3Available,
        discovering: false,
      });

      // No config → ask for XAMPP / MySQL setup (don't re-open if dialog already open
      // or user just disconnected)
      if (result.needsSetup) {
        if (
          !get().configDialogOpen &&
          !get().engineType &&
          !get().userDisconnected
        ) {
          set({
            configDialogOpen: true,
            configDraft: { ...XAMPP_MYSQL_DEFAULTS },
          });
          useLayoutStore.getState().setActivityView('database');
        }
        return;
      }

      // Auto-connect default MySQL/sqlite only when user has not disconnected
      if (!get().dbPath && !get().engineType && !get().userDisconnected) {
        const def =
          result.databases.find((d) => d.isDefault) ??
          result.databases.find((d) => d.source === 'config');
        if (def) {
          await get().openProjectDatabase(def);
        }
      }
    } catch (err) {
      set({
        discovering: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  openConfigDialog: (draft) => {
    set({
      configDialogOpen: true,
      configDraft: draft ?? { ...XAMPP_MYSQL_DEFAULTS },
      lastError: null,
    });
  },

  closeConfigDialog: () => {
    set({ configDialogOpen: false, needsSetup: false });
  },

  connectMysql: async (config, options) => {
    set({ isRunning: true, lastError: null, lastMessage: null });
    try {
      const api = requireApi();
      const root = useWorkspaceStore.getState().rootPath;
      const result = await api.sqlConnectMysql({
        ...config,
        saveToProject: options?.save !== false && Boolean(root),
        rootPath: root ?? undefined,
        setDefault: true,
      });
      const schemaTables = { ...get().schemaTables };
      if (result.database) schemaTables[result.database] = result.tables;
      const expandedSchemas = new Set(get().expandedSchemas);
      if (result.database) expandedSchemas.add(result.database);
      else if (result.databases[0]) expandedSchemas.add(result.databases[0]);

      set({
        engineType: 'mysql',
        dbPath: result.label,
        connectionLabel: result.label,
        mysql: {
          host: result.host,
          port: result.port,
          user: result.user,
          database: result.database,
          password: config.password,
        },
        mysqlDatabases: result.databases,
        tables: result.tables,
        tableInfo: null,
        schemaTables,
        expandedSchemas,
        isRunning: false,
        configDialogOpen: false,
        needsSetup: false,
        userDisconnected: false,
        lastMessage: result.database
          ? `Connected · ${result.database} (${result.tables.length} tables)`
          : `Connected · expand a database in the explorer`,
      });
      if (root) await get().discoverProject(root);
      // Auto-expand first schema if none selected
      if (!result.database && result.databases[0]) {
        await get().toggleSchema(result.databases[0]);
      }
      useLayoutStore.getState().setBottomPanelTab('sql');
      if (!useLayoutStore.getState().bottomPanelVisible) {
        useLayoutStore.setState({ bottomPanelVisible: true });
      }
      // Keep DB sidebar open so tables stay visible after connect
      useLayoutStore.setState({ sidebarVisible: true, activityView: 'database' });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        isRunning: false,
        lastError:
          msg.includes('ECONNREFUSED') || msg.includes('connect')
            ? `${msg} — Is XAMPP MySQL running? Please Turn On MySQL first`
            : msg,
      });
      return false;
    }
  },

  useMysqlDatabase: async (database) => {
    set({ isRunning: true, lastError: null });
    try {
      const result = await requireApi().sqlUseDatabase({ database });
      set({
        tables: result.tables,
        tableInfo: null,
        connectionLabel: result.label,
        dbPath: result.label,
        mysql: get().mysql
          ? { ...get().mysql!, database }
          : { host: 'localhost', port: 3306, user: 'root', database },
        schemaTables: { ...get().schemaTables, [database]: result.tables },
        expandedSchemas: new Set([...get().expandedSchemas, database]),
        isRunning: false,
        lastMessage: `Using database ${database}`,
      });
      const root = useWorkspaceStore.getState().rootPath;
      const m = get().mysql;
      if (root && m) {
        void requireApi().sqlSaveMysqlConfig({
          rootPath: root,
          config: {
            id: 'xampp',
            name: 'XAMPP Local',
            host: m.host,
            port: m.port,
            user: m.user,
            password: m.password ?? '',
            database,
          },
          setDefault: true,
        });
      }
    } catch (err) {
      set({
        isRunning: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  openDatabase: async (path) => {
    set({ lastError: null, lastMessage: null });
    try {
      const api = requireApi();
      const result = await api.sqlOpen(path ? { path } : {});
      const recent = [
        result.path,
        ...get().recentDbPaths.filter((p) => p !== result.path),
      ].slice(0, 8);
      set({
        engineType: 'sqlite',
        dbPath: result.path,
        connectionLabel: result.label ?? basename(result.path),
        mysql: null,
        mysqlDatabases: [],
        tables: result.tables,
        tableInfo: null,
        schemaTables: { sqlite: result.tables },
        expandedSchemas: new Set(['sqlite']),
        recentDbPaths: recent,
        userDisconnected: false,
        lastMessage: `Opened ${basename(result.path)}`,
      });
      void api.setSetting({ key: RECENT_KEY, value: recent });
      useLayoutStore.getState().setBottomPanelTab('sql');
      if (!useLayoutStore.getState().bottomPanelVisible) {
        useLayoutStore.setState({ bottomPanelVisible: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'Canceled' && !/cancel/i.test(msg)) {
        set({ lastError: msg });
      }
    }
  },

  newDatabase: async () => {
    set({ lastError: null, lastMessage: null });
    try {
      const api = requireApi();
      const root = useWorkspaceStore.getState().rootPath;
      const defaultPath = root ? joinPath(root, 'data', 'database.db') : 'database.db';
      const result = await api.sqlNewDatabase({ defaultPath });
      if ('canceled' in result && result.canceled) return;
      const opened = result as { canceled: false; path: string; tables: string[] };
      set({
        engineType: 'sqlite',
        dbPath: opened.path,
        connectionLabel: basename(opened.path),
        mysql: null,
        tables: opened.tables,
        tableInfo: null,
        userDisconnected: false,
        lastMessage: `Created ${basename(opened.path)}`,
      });
      if (root) {
        try {
          await api.sqlRegisterProjectDb({
            rootPath: root,
            path: opened.path,
            name: basename(opened.path),
            setDefault: false,
          });
          await get().discoverProject(root);
        } catch {
          // optional
        }
      }
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  createProjectDatabase: async () => {
    // For XAMPP users: open MySQL config instead of sqlite
    get().openConfigDialog({ ...XAMPP_MYSQL_DEFAULTS });
  },

  openProjectDatabase: async (db) => {
    if (db.type === 'mysql' && db.mysql) {
      await get().connectMysql(db.mysql, { save: false });
      return;
    }
    if (db.absolutePath) {
      await get().openDatabase(db.absolutePath);
    }
  },

  registerCurrentInProject: async () => {
    const root = useWorkspaceStore.getState().rootPath;
    if (!root) {
      set({ lastError: 'Open a project folder first' });
      return;
    }
    try {
      if (get().engineType === 'mysql' && get().mysql) {
        const m = get().mysql!;
        // Re-read password from project config if needed — user should use Configure
        await requireApi().sqlSaveMysqlConfig({
          rootPath: root,
          config: {
            id: 'xampp',
            name: get().connectionLabel ?? 'XAMPP Local',
            host: m.host,
            port: m.port,
            user: m.user,
            password: '',
            database: m.database ?? '',
          },
          setDefault: true,
        });
        await get().discoverProject(root);
        set({ lastMessage: 'Saved MySQL as project default (re-open Configure to update password)' });
        return;
      }
      const dbPath = get().dbPath;
      if (!dbPath) {
        set({ lastError: 'Open a database first' });
        return;
      }
      await requireApi().sqlRegisterProjectDb({
        rootPath: root,
        path: dbPath,
        name: basename(dbPath),
        setDefault: true,
      });
      await get().discoverProject(root);
      set({ lastMessage: 'Registered in project config' });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  openProjectConfig: async () => {
    const root = useWorkspaceStore.getState().rootPath;
    if (!root) {
      set({ lastError: 'Open a project folder first' });
      return;
    }
    try {
      const { configPath } = await requireApi().sqlOpenConfig({
        rootPath: root,
        createIfMissing: true,
      });
      set({ lastMessage: `Config: ${configPath}` });
      try {
        await useEditorStore.getState().openFile(configPath, false);
      } catch {
        // OS opened
      }
      await get().discoverProject(root);
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  openInTerminal: async (dbPath) => {
    try {
      const api = requireApi();
      const mysql = get().mysql;
      const termCmd =
        get().engineType === 'mysql' && mysql
          ? await api.sqlTerminalCommand({
              mysql: {
                host: mysql.host,
                port: mysql.port,
                user: mysql.user,
                password: mysql.password ?? '',
                database: mysql.database ?? undefined,
                name: get().connectionLabel ?? undefined,
              },
            })
          : await api.sqlTerminalCommand({
              dbPath: dbPath ?? get().dbPath ?? undefined,
            });

      const sessionId = await ensureTerminalSession();
      if (!sessionId) {
        set({ lastError: 'Could not open terminal' });
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
      await api.writeTerminal({ id: sessionId, data: termCmd.command });
      set({
        lastMessage: termCmd.mysqlCliAvailable
          ? 'Opened mysql CLI — you can INSERT/UPDATE/DELETE here'
          : termCmd.sqlite3Available
            ? 'Opened sqlite3 — you can edit data with SQL'
            : 'Connection info sent to Terminal',
      });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  writeTerminalLines: async (lines) => {
    const api = requireApi();
    const sessionId = await ensureTerminalSession();
    if (!sessionId) {
      set({ lastError: 'Could not open terminal' });
      return;
    }
    // Login / open CLI first
    const mysql = get().mysql;
    if (get().engineType === 'mysql' && mysql) {
      const termCmd = await api.sqlTerminalCommand({
        mysql: {
          host: mysql.host,
          port: mysql.port,
          user: mysql.user,
          password: mysql.password ?? '',
          database: mysql.database ?? undefined,
        },
      });
      await new Promise((r) => setTimeout(r, 200));
      await api.writeTerminal({ id: sessionId, data: termCmd.command });
      await new Promise((r) => setTimeout(r, 400));
    } else if (get().engineType === 'sqlite' && get().dbPath) {
      const termCmd = await api.sqlTerminalCommand({ dbPath: get().dbPath! });
      await new Promise((r) => setTimeout(r, 200));
      await api.writeTerminal({ id: sessionId, data: termCmd.command });
      await new Promise((r) => setTimeout(r, 400));
    }
    for (const line of lines) {
      const data = line.endsWith('\n') || line.endsWith('\r') ? line : line + '\n';
      await api.writeTerminal({ id: sessionId, data });
      await new Promise((r) => setTimeout(r, 80));
    }
  },

  toggleSchema: async (schemaKey) => {
    const expanded = new Set(get().expandedSchemas);
    if (expanded.has(schemaKey)) {
      expanded.delete(schemaKey);
      set({ expandedSchemas: expanded });
      return;
    }
    expanded.add(schemaKey);
    set({ expandedSchemas: expanded });
    await get().loadSchemaTables(schemaKey);
  },

  toggleTable: async (schemaKey, table) => {
    const key = `${schemaKey}/${table}`;
    const expanded = new Set(get().expandedTables);
    if (expanded.has(key)) {
      expanded.delete(key);
      set({ expandedTables: expanded });
      return;
    }
    expanded.add(key);
    set({ expandedTables: expanded });
    await get().loadTablePreview(schemaKey, table);
  },

  toggleRowGroup: (schemaKey, table) => {
    const key = `${schemaKey}/${table}`;
    const expanded = new Set(get().expandedRowGroups);
    if (expanded.has(key)) expanded.delete(key);
    else expanded.add(key);
    set({ expandedRowGroups: expanded });
  },

  loadSchemaTables: async (schemaKey) => {
    const done = withLoading(set, get, `schema:${schemaKey}`);
    try {
      if (get().engineType === 'sqlite') {
        const { tables } = await requireApi().sqlListTables();
        set({
          tables,
          schemaTables: { ...get().schemaTables, sqlite: tables },
        });
        return;
      }
      // MySQL: switch schema then list tables
      if (get().mysql?.database !== schemaKey) {
        await get().useMysqlDatabase(schemaKey);
      }
      const { tables } = await requireApi().sqlListTables();
      set({
        tables,
        schemaTables: { ...get().schemaTables, [schemaKey]: tables },
      });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    } finally {
      done();
    }
  },

  loadTablePreview: async (schemaKey, table) => {
    const nodeKey = `table:${schemaKey}/${table}`;
    const done = withLoading(set, get, nodeKey);
    try {
      if (get().engineType === 'mysql' && get().mysql?.database !== schemaKey && schemaKey !== 'sqlite') {
        await get().useMysqlDatabase(schemaKey);
      }
      const info = await requireApi().sqlTableInfo({ name: table });
      const q =
        get().engineType === 'mysql'
          ? `SELECT * FROM \`${table.replace(/`/g, '``')}\` LIMIT 20`
          : `SELECT * FROM "${table.replace(/"/g, '""')}" LIMIT 20`;
      const result = await requireApi().sqlExecute({ sql: q, maxRows: 20 });
      if (result.error) {
        set({ lastError: result.error });
        return;
      }
      const set0 = result.results.find((r) => r.columns.length > 0);
      const preview: TablePreview = {
        columns: info.columns,
        rows: set0?.rows ?? [],
        truncated: set0?.truncated ?? false,
      };
      set({
        tableInfo: info,
        tablePreviews: { ...get().tablePreviews, [`${schemaKey}/${table}`]: preview },
        // auto-expand rows when first opening table
        expandedRowGroups: new Set([...get().expandedRowGroups, `${schemaKey}/${table}`]),
      });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    } finally {
      done();
    }
  },

  editTableInTerminal: async (schemaKey, table) => {
    const isMysql = get().engineType === 'mysql';
    const lines = isMysql
      ? [
          `USE \`${schemaKey}\`;`,
          `SELECT * FROM \`${table}\` LIMIT 20;`,
          `-- Edit example: UPDATE \`${table}\` SET col = 'value' WHERE id = 1;`,
          `-- Insert: INSERT INTO \`${table}\` (col1, col2) VALUES ('a', 'b');`,
          `-- Delete: DELETE FROM \`${table}\` WHERE id = 1;`,
        ]
      : [
          `SELECT * FROM "${table}" LIMIT 20;`,
          `-- Edit example: UPDATE "${table}" SET col = 'value' WHERE id = 1;`,
          `-- Insert: INSERT INTO "${table}" (col1, col2) VALUES ('a', 'b');`,
          `-- Delete: DELETE FROM "${table}" WHERE id = 1;`,
        ];
    await get().writeTerminalLines(lines);
    set({ lastMessage: `Terminal ready to edit ${table}` });
  },

  editRowInTerminal: async (schemaKey, table, row, _rowIndex) => {
    const preview = get().tablePreviews[`${schemaKey}/${table}`];
    const cols = preview?.columns ?? [];
    const isMysql = get().engineType === 'mysql';
    const quote = (v: unknown) => {
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return String(v);
      return `'${String(v).replace(/'/g, "''")}'`;
    };
    const pkCols = cols.filter((c) => c.pk);
    let where = '/* add WHERE */';
    if (pkCols.length > 0) {
      where = pkCols
        .map((c) => {
          const i = cols.findIndex((x) => x.name === c.name);
          return isMysql
            ? `\`${c.name}\` = ${quote(row[i])}`
            : `"${c.name}" = ${quote(row[i])}`;
        })
        .join(' AND ');
    }
    const setParts = cols
      .filter((c) => !c.pk)
      .slice(0, 6)
      .map((c) => {
        const i = cols.findIndex((x) => x.name === c.name);
        return isMysql
          ? `\`${c.name}\` = ${quote(row[i])}`
          : `"${c.name}" = ${quote(row[i])}`;
      });
    const updateSql = isMysql
      ? `UPDATE \`${table}\` SET ${setParts.join(', ') || '/* col = val */'} WHERE ${where};`
      : `UPDATE "${table}" SET ${setParts.join(', ') || '/* col = val */'} WHERE ${where};`;

    const lines = isMysql
      ? [`USE \`${schemaKey}\`;`, updateSql]
      : [updateSql];
    await get().writeTerminalLines(lines);
    set({ lastMessage: `Edit template sent to Terminal for ${table}` });
  },

  openTableQuery: (schemaKey, table) => {
    const isMysql = get().engineType === 'mysql';
    const sql = isMysql
      ? `-- ${schemaKey}.${table}\nSELECT * FROM \`${table}\` LIMIT 100;\n\n-- UPDATE \`${table}\` SET col = 'value' WHERE id = 1;\n`
      : `-- ${table}\nSELECT * FROM "${table}" LIMIT 100;\n\n-- UPDATE "${table}" SET col = 'value' WHERE id = 1;\n`;
    useEditorStore.getState().openUntitled(sql, 'sql');
    set({ lastMessage: `Query opened for ${table}` });
  },

  openTableEditor: async (schemaKey, table) => {
    set({ isRunning: true, lastError: null, lastMessage: null });
    try {
      if (get().engineType === 'mysql' && schemaKey !== 'sqlite' && get().mysql?.database !== schemaKey) {
        await get().useMysqlDatabase(schemaKey);
      }
      const info = await requireApi().sqlTableInfo({ name: table });
      const isMysql = get().engineType === 'mysql';
      const q = isMysql
        ? `SELECT * FROM \`${table.replace(/`/g, '``')}\` LIMIT 200`
        : `SELECT * FROM "${table.replace(/"/g, '""')}" LIMIT 200`;
      const result = await requireApi().sqlExecute({ sql: q, maxRows: 200 });
      if (result.error) {
        set({ isRunning: false, lastError: result.error });
        return;
      }
      const set0 = result.results.find((r) => r.columns.length > 0);
      const colOrder =
        set0?.columns?.length
          ? set0.columns
          : info.columns.map((c) => c.name);
      // Align meta with result column order
      const columns: ColMeta[] = colOrder.map((name) => {
        const meta = info.columns.find((c) => c.name === name);
        return {
          name,
          type: meta?.type ?? '',
          notnull: meta?.notnull ?? false,
          pk: meta?.pk ?? false,
        };
      });
      const rows: EditorRow[] = (set0?.rows ?? []).map((row, i) => {
        const cells = columns.map((_, ci) => cellToDisplay(row[ci]));
        return {
          id: `r${i}-${Date.now()}`,
          cells: [...cells],
          original: [...cells],
          isNew: false,
          deleted: false,
        };
      });
      set({
        tableEditor: {
          schemaKey,
          table,
          columns,
          rows,
          selected: new Set(),
          truncated: set0?.truncated ?? false,
          pageSize: 200,
        },
        tableInfo: info,
        isRunning: false,
        lastMessage: `Editing ${table} — change cells, then Save`,
      });
      useLayoutStore.getState().setBottomPanelTab('sql');
      if (!useLayoutStore.getState().bottomPanelVisible) {
        useLayoutStore.setState({ bottomPanelVisible: true });
      }
      // Give more room for the grid
      const h = useLayoutStore.getState().bottomPanelHeight;
      if (h < 320) useLayoutStore.getState().setBottomPanelHeight(360);
    } catch (err) {
      set({
        isRunning: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  closeTableEditor: () => {
    set({ tableEditor: null });
  },

  reloadTableEditor: async () => {
    const ed = get().tableEditor;
    if (!ed) return;
    await get().openTableEditor(ed.schemaKey, ed.table);
  },

  setEditorCell: (rowId, colIndex, value) => {
    const ed = get().tableEditor;
    if (!ed) return;
    set({
      tableEditor: {
        ...ed,
        rows: ed.rows.map((r) =>
          r.id === rowId
            ? {
                ...r,
                cells: r.cells.map((c, i) => (i === colIndex ? value : c)),
              }
            : r,
        ),
      },
      lastError: null,
    });
  },

  toggleEditorNull: (rowId, colIndex) => {
    const ed = get().tableEditor;
    if (!ed) return;
    set({
      tableEditor: {
        ...ed,
        rows: ed.rows.map((r) => {
          if (r.id !== rowId) return r;
          const cur = r.cells[colIndex];
          const next = cur === null ? '' : null;
          return {
            ...r,
            cells: r.cells.map((c, i) => (i === colIndex ? next : c)),
          };
        }),
      },
    });
  },

  toggleEditorRowSelected: (rowId) => {
    const ed = get().tableEditor;
    if (!ed) return;
    const selected = new Set(ed.selected);
    if (selected.has(rowId)) selected.delete(rowId);
    else selected.add(rowId);
    set({ tableEditor: { ...ed, selected } });
  },

  toggleSelectAllEditorRows: () => {
    const ed = get().tableEditor;
    if (!ed) return;
    const visible = ed.rows.filter((r) => !r.deleted);
    const allOn = visible.length > 0 && visible.every((r) => ed.selected.has(r.id));
    set({
      tableEditor: {
        ...ed,
        selected: allOn ? new Set() : new Set(visible.map((r) => r.id)),
      },
    });
  },

  addEditorRow: () => {
    const ed = get().tableEditor;
    if (!ed) return;
    const cells = ed.columns.map(() => null as string | null);
    const row: EditorRow = {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      cells,
      original: [...cells],
      isNew: true,
      deleted: false,
    };
    set({
      tableEditor: {
        ...ed,
        rows: [...ed.rows, row],
        selected: new Set(),
      },
      lastMessage: 'New row added — fill cells and Save',
    });
  },

  deleteSelectedEditorRows: () => {
    const ed = get().tableEditor;
    if (!ed || ed.selected.size === 0) return;
    const rows = ed.rows
      .map((r) => {
        if (!ed.selected.has(r.id)) return r;
        if (r.isNew) return null; // drop unsaved new rows
        return { ...r, deleted: true };
      })
      .filter(Boolean) as EditorRow[];
    set({
      tableEditor: { ...ed, rows, selected: new Set() },
      lastMessage: 'Rows marked deleted — click Save to apply',
    });
  },

  saveTableEditor: async () => {
    const ed = get().tableEditor;
    if (!ed) return;
    const mysql = get().engineType === 'mysql';
    if (mysql && ed.schemaKey !== 'sqlite' && get().mysql?.database !== ed.schemaKey) {
      await get().useMysqlDatabase(ed.schemaKey);
    }

    const statements: string[] = [];
    for (const r of ed.rows) {
      if (r.isNew && r.deleted) continue;
      if (r.deleted && !r.isNew) {
        statements.push(buildDeleteSql(ed.table, ed.columns, r.original, mysql));
        continue;
      }
      if (r.isNew && !r.deleted) {
        statements.push(buildInsertSql(ed.table, ed.columns, r.cells, mysql));
        continue;
      }
      const upd = buildUpdateSql(ed.table, ed.columns, r.original, r.cells, mysql);
      if (upd) statements.push(upd);
    }

    if (statements.length === 0) {
      set({ lastMessage: 'No changes to save' });
      return;
    }

    set({ isRunning: true, lastError: null });
    try {
      // Run one-by-one so one failure doesn't hide which row failed
      let ok = 0;
      for (const sql of statements) {
        const result = await requireApi().sqlExecute({ sql });
        if (result.error) {
          set({
            isRunning: false,
            lastError: result.error,
            lastMessage: `Saved ${ok}/${statements.length} — stopped on error`,
          });
          return;
        }
        ok += 1;
      }
      set({
        isRunning: false,
        lastMessage: `Saved ${ok} change(s)`,
      });
      await get().openTableEditor(ed.schemaKey, ed.table);
      // refresh tree preview cache
      void get().loadTablePreview(ed.schemaKey, ed.table);
    } catch (err) {
      set({
        isRunning: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  closeDatabase: async () => {
    try {
      await requireApi().sqlClose();
    } catch {
      // ignore
    }
    set({
      engineType: null,
      dbPath: null,
      connectionLabel: null,
      mysql: null,
      mysqlDatabases: [],
      tables: [],
      tableInfo: null,
      expandedSchemas: new Set(),
      expandedTables: new Set(),
      expandedRowGroups: new Set(),
      schemaTables: {},
      tablePreviews: {},
      loadingNodes: new Set(),
      tableEditor: null,
      lastError: null,
      lastMessage: 'Disconnected',
      // Stay disconnected until user explicitly Connects again
      needsSetup: false,
      configDialogOpen: false,
      userDisconnected: true,
    });
  },

  refreshTables: async () => {
    try {
      const { tables } = await requireApi().sqlListTables();
      const schemaKey =
        get().engineType === 'mysql' ? (get().mysql?.database ?? '') : 'sqlite';
      set({
        tables,
        schemaTables: schemaKey
          ? { ...get().schemaTables, [schemaKey]: tables }
          : get().schemaTables,
      });
      if (get().engineType === 'mysql') {
        const { databases } = await requireApi().sqlListMysqlDatabases();
        set({ mysqlDatabases: databases });
      }
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  loadTableInfo: async (name) => {
    try {
      const info = await requireApi().sqlTableInfo({ name });
      set({ tableInfo: info });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  runActiveSql: async () => {
    const tab = useEditorStore.getState().getActiveTab();
    if (!tab) {
      set({ lastError: 'Open a .sql file first' });
      return;
    }
    let sql = tab.content;
    try {
      const monaco = await import('monaco-editor');
      const editors = monaco.editor.getEditors();
      const focused =
        editors.find((e) => e.hasTextFocus()) ??
        editors.find((e) => {
          const model = e.getModel();
          if (!model) return false;
          const p = model.uri.path.replace(/^\//, '').toLowerCase();
          const base = tab.path.replace(/\\/g, '/').toLowerCase().split('/').pop() ?? '';
          return p.endsWith(base);
        }) ??
        editors[0];
      const sel = focused?.getSelection();
      const model = focused?.getModel();
      if (sel && model && !sel.isEmpty()) {
        sql = model.getValueInRange(sel);
      }
    } catch {
      // full content
    }
    await get().runSql(sql);
  },

  runSql: async (sql) => {
    if (!get().engineType && !get().dbPath) {
      const root = useWorkspaceStore.getState().rootPath;
      if (root) await get().discoverProject(root);
      if (!get().engineType && !get().dbPath) {
        get().openConfigDialog({ ...XAMPP_MYSQL_DEFAULTS });
        set({ lastError: 'Connect to XAMPP MySQL first' });
        return;
      }
    }
    const text = sql.trim();
    if (!text) {
      set({ lastError: 'Nothing to run — type SQL or select a statement' });
      return;
    }

    set({ isRunning: true, lastError: null, lastMessage: null });
    useLayoutStore.getState().setBottomPanelTab('sql');
    if (!useLayoutStore.getState().bottomPanelVisible) {
      useLayoutStore.setState({ bottomPanelVisible: true });
    }

    try {
      const result = await requireApi().sqlExecute({ sql: text, maxRows: 500 });
      if (result.error) {
        set({
          isRunning: false,
          lastError: result.error,
          results: result.results,
          durationMs: result.durationMs,
        });
        return;
      }
      const mut = result.results.filter((r) => r.changes != null);
      let msg = `OK — ${result.statementCount} statement(s) in ${result.durationMs}ms`;
      if (mut.length > 0) {
        const changes = mut.reduce((a, r) => a + (r.changes ?? 0), 0);
        msg += ` · ${changes} row(s) changed`;
      }
      set({
        isRunning: false,
        results: result.results,
        durationMs: result.durationMs,
        lastMessage: msg,
        lastError: null,
      });
      await get().refreshTables();
    } catch (err) {
      set({
        isRunning: false,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  previewTable: async (name) => {
    await get().loadTableInfo(name);
    const safe = name.replace(/`/g, '``');
    if (get().engineType === 'mysql') {
      await get().runSql(`SELECT * FROM \`${safe}\` LIMIT 100;`);
    } else {
      await get().runSql(`SELECT * FROM "${name.replace(/"/g, '""')}" LIMIT 100;`);
    }
  },
}));
