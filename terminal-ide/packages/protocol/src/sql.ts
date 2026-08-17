/**
 * SQL IPC contracts — SQLite files + MySQL/MariaDB (XAMPP localhost).
 */

export type SqlEngineType = 'sqlite' | 'mysql';

export interface SqlOpenRequest {
  /** Absolute path to .db / .sqlite file. Created if missing. */
  path: string;
}

export interface SqlOpenResult {
  path: string;
  tables: string[];
  type?: SqlEngineType;
  label?: string;
}

/** MySQL / MariaDB / XAMPP connection settings */
export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  /** Schema/database name (optional until chosen) */
  database?: string;
  /** Display name in project config */
  name?: string;
  id?: string;
}

export interface SqlConnectMysqlRequest extends MysqlConnectionConfig {
  /** Also save into project .terminal-ide/databases.json */
  saveToProject?: boolean;
  rootPath?: string;
  setDefault?: boolean;
}

export interface SqlConnectMysqlResult {
  type: 'mysql';
  label: string;
  host: string;
  port: number;
  user: string;
  database: string | null;
  tables: string[];
  /** Schemas available on server (excluding system) */
  databases: string[];
}

export interface SqlExecuteRequest {
  sql: string;
  maxRows?: number;
}

export interface SqlResultSet {
  columns: string[];
  rows: unknown[][];
  changes: number | null;
  lastInsertRowid: number | null;
  truncated: boolean;
}

export interface SqlExecuteResult {
  results: SqlResultSet[];
  statementCount: number;
  durationMs: number;
  error?: string;
}

export interface SqlTableInfo {
  name: string;
  columns: Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
}

export interface SqlListTablesResult {
  tables: string[];
}

export interface SqlConnectionState {
  type: SqlEngineType | null;
  /** sqlite path or mysql label */
  path: string | null;
  label: string | null;
  mysql: {
    host: string;
    port: number;
    user: string;
    database: string | null;
  } | null;
  tables: string[];
  databases: string[];
}

/** Entry in project .terminal-ide/databases.json or auto-scanned file. */
export interface ProjectDatabaseInfo {
  id: string;
  name: string;
  type: SqlEngineType;
  /** sqlite absolute path; empty for mysql */
  absolutePath: string;
  relativePath: string;
  description?: string;
  source: 'config' | 'scan';
  exists: boolean;
  isDefault: boolean;
  /** mysql connection (password may be stored in config for local XAMPP) */
  mysql?: MysqlConnectionConfig;
}

export interface SqlDiscoverProjectRequest {
  rootPath: string;
}

export interface SqlDiscoverProjectResult {
  rootPath: string;
  configPath: string;
  hasConfig: boolean;
  /** True when no DB config at all — UI should prompt */
  needsSetup: boolean;
  databases: ProjectDatabaseInfo[];
  sqlite3Available: boolean;
  sqlite3Path: string | null;
}

export interface SqlEnsureProjectDbRequest {
  rootPath: string;
  relativePath?: string;
  id?: string;
  name?: string;
}

export interface SqlEnsureProjectDbResult {
  configPath: string;
  absolutePath: string;
  tables: string[];
  createdFile: boolean;
}

export interface SqlRegisterProjectDbRequest {
  rootPath: string;
  path: string;
  name?: string;
  id?: string;
  setDefault?: boolean;
  description?: string;
}

export interface SqlSaveMysqlConfigRequest {
  rootPath: string;
  config: MysqlConnectionConfig;
  setDefault?: boolean;
}

export interface SqlTerminalCommandRequest {
  dbPath?: string;
  /** If mysql, build mysql CLI command */
  mysql?: MysqlConnectionConfig;
}

export interface SqlTerminalCommandResult {
  command: string;
  label: string;
  sqlite3Available: boolean;
  mysqlCliAvailable: boolean;
  dbPath: string;
}

/** XAMPP-friendly defaults for the setup dialog */
export const XAMPP_MYSQL_DEFAULTS: MysqlConnectionConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: '',
  name: 'XAMPP Local',
  id: 'xampp',
};
