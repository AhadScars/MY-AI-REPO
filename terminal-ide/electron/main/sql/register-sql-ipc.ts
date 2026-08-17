import path from 'node:path';
import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type {
  SqlConnectMysqlRequest,
  SqlEnsureProjectDbRequest,
  SqlExecuteRequest,
  SqlOpenRequest,
  SqlRegisterProjectDbRequest,
  SqlSaveMysqlConfigRequest,
  SqlTerminalCommandRequest,
} from '../../../packages/protocol/src/sql.js';
import { SqlService } from './sql-service.js';
import {
  buildTerminalDbCommand,
  buildMysqlTerminalCommand,
  discoverProjectDatabases,
  ensureProjectDatabase,
  projectConfigPath,
  registerProjectDatabase,
  writeProjectConfig,
  defaultProjectConfig,
  readProjectConfig,
  whichSqlite3,
  saveMysqlConfig,
} from './project-db.js';

export function registerSqlIpc(getMainWindow: () => BrowserWindow | null): SqlService {
  const sql = new SqlService();

  ipcMain.handle(IpcChannels.SQL_OPEN, async (event, request: SqlOpenRequest) => {
    let filePath = request?.path;
    if (!filePath) {
      const win = BrowserWindow.fromWebContents(event.sender) ?? getMainWindow();
      const result = await dialog.showOpenDialog(win!, {
        title: 'Open SQLite Database',
        properties: ['openFile', 'createDirectory', 'promptToCreate'],
        filters: [
          { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePaths[0]) {
        throw new Error('Canceled');
      }
      filePath = result.filePaths[0];
    }
    return sql.open(filePath);
  });

  ipcMain.handle(IpcChannels.SQL_CLOSE, async () => {
    await sql.close();
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.SQL_EXECUTE, async (_e, request: SqlExecuteRequest) => {
    if (!request?.sql || typeof request.sql !== 'string') {
      throw new Error('sql is required');
    }
    return sql.execute(request);
  });

  ipcMain.handle(IpcChannels.SQL_LIST_TABLES, async () => ({
    tables: await sql.listTables(),
  }));

  ipcMain.handle(IpcChannels.SQL_TABLE_INFO, async (_e, request: { name: string }) => {
    if (!request?.name) throw new Error('name is required');
    return sql.tableInfo(request.name);
  });

  ipcMain.handle(IpcChannels.SQL_GET_OPEN, async () => {
    const state = await sql.getConnectionState();
    return {
      path: state.path,
      tables: state.tables,
      type: state.type,
      label: state.label,
      mysql: state.mysql,
      databases: state.databases,
    };
  });

  ipcMain.handle(IpcChannels.SQL_CONNECT_MYSQL, async (_e, request: SqlConnectMysqlRequest) => {
    if (!request) throw new Error('connection config required');
    const result = await sql.connectMysql({
      host: request.host || 'localhost',
      port: Number(request.port) || 3306,
      user: request.user || 'root',
      password: request.password ?? '',
      database: request.database,
      name: request.name,
      id: request.id,
    });
    if (request.saveToProject && request.rootPath) {
      saveMysqlConfig(request.rootPath, {
        id: request.id || 'xampp',
        name: request.name || 'XAMPP Local',
        host: request.host || 'localhost',
        port: Number(request.port) || 3306,
        user: request.user || 'root',
        password: request.password ?? '',
        database: request.database,
        setDefault: request.setDefault !== false,
      });
    }
    return result;
  });

  ipcMain.handle(
    IpcChannels.SQL_USE_DATABASE,
    async (_e, request: { database: string }) => {
      if (!request?.database) throw new Error('database required');
      const tables = await sql.mysql.useDatabase(request.database);
      return { tables, database: request.database, label: sql.mysql.label() };
    },
  );

  ipcMain.handle(
    IpcChannels.SQL_LIST_MYSQL_DATABASES,
    async () => {
      if (!sql.mysql.isConnected()) return { databases: [] as string[] };
      return { databases: await sql.mysql.listDatabases() };
    },
  );

  ipcMain.handle(IpcChannels.SQL_SAVE_MYSQL_CONFIG, (_e, request: SqlSaveMysqlConfigRequest) => {
    if (!request?.rootPath || !request?.config) throw new Error('rootPath and config required');
    return saveMysqlConfig(request.rootPath, {
      ...request.config,
      setDefault: request.setDefault !== false,
    });
  });

  ipcMain.handle(IpcChannels.SQL_NEW_DATABASE, async (event, request?: { defaultPath?: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? getMainWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Create SQLite Database',
      defaultPath: request?.defaultPath ?? 'database.db',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true as const };
    }
    const opened = await sql.open(result.filePath);
    return { canceled: false as const, ...opened };
  });

  ipcMain.handle(
    IpcChannels.SQL_DISCOVER_PROJECT,
    (_e, request: { rootPath: string }) => {
      if (!request?.rootPath) throw new Error('rootPath is required');
      const discovered = discoverProjectDatabases(request.rootPath);
      const hasConfig = Boolean(discovered.config && discovered.config.databases.length > 0);
      return {
        rootPath: discovered.rootPath,
        configPath: discovered.configPath,
        hasConfig,
        needsSetup: !hasConfig,
        databases: discovered.databases,
        sqlite3Available: discovered.sqlite3Available,
        sqlite3Path: discovered.sqlite3Path,
      };
    },
  );

  ipcMain.handle(
    IpcChannels.SQL_ENSURE_PROJECT_DB,
    async (_e, request: SqlEnsureProjectDbRequest) => {
      if (!request?.rootPath) throw new Error('rootPath is required');
      const ensured = ensureProjectDatabase(request.rootPath, {
        id: request.id,
        name: request.name,
        relativePath: request.relativePath,
      });
      // Initialize valid sqlite file via sql.js
      const opened = await sql.open(ensured.absolutePath);
      return {
        configPath: ensured.configPath,
        absolutePath: opened.path,
        tables: opened.tables,
        createdFile: ensured.createdFile,
      };
    },
  );

  ipcMain.handle(
    IpcChannels.SQL_REGISTER_PROJECT_DB,
    (_e, request: SqlRegisterProjectDbRequest) => {
      if (!request?.rootPath || !request?.path) {
        throw new Error('rootPath and path are required');
      }
      const config = registerProjectDatabase(request.rootPath, {
        path: request.path,
        name: request.name,
        id: request.id,
        setDefault: request.setDefault,
        description: request.description,
      });
      return { config, configPath: projectConfigPath(request.rootPath) };
    },
  );

  ipcMain.handle(
    IpcChannels.SQL_TERMINAL_COMMAND,
    (_e, request: SqlTerminalCommandRequest) => {
      if (request?.mysql) {
        const cmd = buildMysqlTerminalCommand(request.mysql);
        return {
          command: cmd.command,
          label: cmd.label,
          sqlite3Available: Boolean(whichSqlite3()),
          mysqlCliAvailable: cmd.mysqlCliAvailable,
          dbPath: `${request.mysql.user}@${request.mysql.host}`,
        };
      }
      if (!request?.dbPath) throw new Error('dbPath or mysql config required');
      const sqlite3Path = whichSqlite3();
      const abs = path.resolve(request.dbPath);
      const cmd = buildTerminalDbCommand(abs, sqlite3Path);
      return {
        command: cmd.command,
        label: cmd.label,
        sqlite3Available: Boolean(sqlite3Path),
        mysqlCliAvailable: false,
        dbPath: abs,
      };
    },
  );

  ipcMain.handle(
    IpcChannels.SQL_OPEN_CONFIG,
    async (_e, request: { rootPath: string; createIfMissing?: boolean }) => {
      if (!request?.rootPath) throw new Error('rootPath is required');
      const cfgPath = projectConfigPath(request.rootPath);
      if (!readProjectConfig(request.rootPath) && request.createIfMissing !== false) {
        writeProjectConfig(request.rootPath, defaultProjectConfig());
      }
      await shell.openPath(cfgPath);
      return { configPath: cfgPath };
    },
  );

  return sql;
}
