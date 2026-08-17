import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type { SettingsStore } from '../security/settings-store.js';
import { FileSystemService } from '../filesystem/fs-service.js';
import { TerminalManager } from '../terminal/terminal-manager.js';
import { registerTerminalIpc } from '../terminal/register-terminal-ipc.js';
import { registerGitIpc } from '../git/register-git-ipc.js';
import { registerAiIpc, type AiIpcHandles } from '../ai/register-ai-ipc.js';
import { registerRunIpc } from '../run/register-run-ipc.js';
import { registerSqlIpc } from '../sql/register-sql-ipc.js';
import { registerPreviewIpc } from '../preview/register-preview-ipc.js';

export interface IpcContext {
  settingsStore: SettingsStore;
  getMainWindow: () => BrowserWindow | null;
  terminalManager?: TerminalManager;
  getWorkspaceRoot?: () => string | undefined;
  /** Create an additional app window (File → Open New Window) */
  createWindow?: () => BrowserWindow;
}

export interface IpcRegistrationResult {
  ai?: AiIpcHandles;
}

/**
 * Register all IPC handlers. Renderer can only call these explicit channels.
 */
export async function registerIpcHandlers(ctx: IpcContext): Promise<IpcRegistrationResult> {
  const fsService = new FileSystemService();
  const terminalManager = ctx.terminalManager ?? new TerminalManager(ctx.getMainWindow);
  registerTerminalIpc(terminalManager);
  registerGitIpc(ctx.settingsStore);
  const ai = await registerAiIpc(
    ctx.getMainWindow,
    ctx.getWorkspaceRoot ?? (() => undefined),
  );
  registerRunIpc(ctx.getMainWindow);
  registerSqlIpc(ctx.getMainWindow);
  registerPreviewIpc();

  // ─── App ──────────────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => app.getVersion());

  ipcMain.handle(IpcChannels.APP_GET_PATH, (_e, request: { name: string }) => {
    const allowed = ['home', 'appData', 'userData', 'temp', 'documents', 'downloads'] as const;
    type Allowed = (typeof allowed)[number];
    if (!allowed.includes(request.name as Allowed)) {
      throw new Error(`Invalid path name: ${request.name}`);
    }
    return app.getPath(request.name as Allowed);
  });

  ipcMain.handle(IpcChannels.APP_QUIT, () => {
    app.quit();
  });

  // ─── Window ───────────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle(IpcChannels.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.handle(IpcChannels.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle(IpcChannels.WINDOW_IS_MAXIMIZED, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });

  ipcMain.handle(IpcChannels.WINDOW_TOGGLE_DEVTOOLS, (event) => {
    event.sender.toggleDevTools();
  });

  ipcMain.handle(IpcChannels.WINDOW_NEW, () => {
    if (ctx.createWindow) {
      ctx.createWindow();
      return;
    }
    // Fallback: open a blank BrowserWindow is not enough — ignore
  });

  // ─── Dialogs ──────────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.DIALOG_OPEN_FOLDER, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Open Folder',
    });
    return {
      canceled: result.canceled,
      path: result.canceled ? undefined : result.filePaths[0],
    };
  });

  ipcMain.handle(
    IpcChannels.DIALOG_OPEN_FILE,
    async (event, request?: { filters?: Array<{ name: string; extensions: string[] }>; multiSelections?: boolean }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(win!, {
        properties: request?.multiSelections
          ? ['openFile', 'multiSelections']
          : ['openFile'],
        filters: request?.filters,
        title: 'Open File',
      });
      return {
        canceled: result.canceled,
        paths: result.filePaths,
      };
    },
  );

  ipcMain.handle(
    IpcChannels.DIALOG_SAVE_FILE,
    async (
      event,
      request?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> },
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: request?.defaultPath,
        filters: request?.filters,
        title: 'Save File',
      });
      return {
        canceled: result.canceled,
        path: result.filePath,
      };
    },
  );

  ipcMain.handle(IpcChannels.DIALOG_SHOW_MESSAGE, async (event, request) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showMessageBox(win!, {
      type: request.type ?? 'info',
      title: request.title,
      message: request.message,
      detail: request.detail,
      buttons: request.buttons ?? ['OK'],
      defaultId: request.defaultId ?? 0,
      cancelId: request.cancelId,
    });
    return { response: result.response };
  });

  // ─── Filesystem ───────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.FS_READ_DIR, (_e, request) => fsService.readDir(request));
  ipcMain.handle(IpcChannels.FS_READ_FILE, (_e, request) => fsService.readFile(request));
  ipcMain.handle(IpcChannels.FS_WRITE_FILE, (_e, request) => fsService.writeFile(request));
  ipcMain.handle(IpcChannels.FS_CREATE_FILE, (_e, request) => fsService.createFile(request));
  ipcMain.handle(IpcChannels.FS_CREATE_DIR, (_e, request) => fsService.createDir(request));
  ipcMain.handle(IpcChannels.FS_DELETE, (_e, request) => fsService.delete(request));
  ipcMain.handle(IpcChannels.FS_RENAME, (_e, request) => fsService.rename(request));
  ipcMain.handle(IpcChannels.FS_COPY, (_e, request) => fsService.copy(request));
  ipcMain.handle(IpcChannels.FS_EXISTS, (_e, request: { path: string }) =>
    fsService.exists(request.path),
  );
  ipcMain.handle(IpcChannels.FS_STAT, (_e, request: { path: string }) =>
    fsService.stat(request.path),
  );
  ipcMain.handle(IpcChannels.FS_REVEAL_IN_OS, (_e, request: { path: string }) =>
    fsService.revealInOs(request.path),
  );

  // ─── Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.SETTINGS_GET, (_e, request: { key: string }) =>
    ctx.settingsStore.get(request.key),
  );
  ipcMain.handle(IpcChannels.SETTINGS_SET, (_e, request: { key: string; value: unknown }) =>
    ctx.settingsStore.set(request.key, request.value),
  );
  ipcMain.handle(
    IpcChannels.SETTINGS_SET_MANY,
    (_e, request: { values: Record<string, unknown> }) =>
      ctx.settingsStore.setMany(request?.values ?? {}),
  );
  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, () => ctx.settingsStore.getAll());
  ipcMain.handle(IpcChannels.SETTINGS_RESET, () => ctx.settingsStore.reset());

  // ─── Shell ────────────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.SHELL_OPEN_EXTERNAL, async (_e, request: { url: string }) => {
    // Only allow http(s)
    const url = request.url;
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      throw new Error('Only http(s) URLs are allowed');
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(IpcChannels.SHELL_OPEN_PATH, async (_e, request: { path: string }) => {
    await shell.openPath(request.path);
  });

  return { ai };
}
