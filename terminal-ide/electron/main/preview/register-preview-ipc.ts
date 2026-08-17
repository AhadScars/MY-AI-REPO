import path from 'node:path';
import { ipcMain } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import { PreviewServer } from './preview-server.js';

export function registerPreviewIpc(): PreviewServer {
  const server = new PreviewServer();

  ipcMain.handle(
    IpcChannels.PREVIEW_OPEN,
    async (_e, request: { filePath: string; rootPath?: string }) => {
      if (!request?.filePath) throw new Error('filePath is required');
      const filePath = path.resolve(request.filePath);
      const root =
        request.rootPath && request.rootPath.trim()
          ? path.resolve(request.rootPath)
          : path.dirname(filePath);

      const { port } = await server.start(root);
      const url = server.urlForFile(filePath);
      return {
        url,
        port,
        root,
        filePath,
        title: path.basename(filePath),
      };
    },
  );

  ipcMain.handle(IpcChannels.PREVIEW_STOP, async () => {
    await server.stop();
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.PREVIEW_STATUS, () => ({
    running: server.isRunning(),
    port: server.getPort() || null,
    root: server.getRoot(),
  }));

  return server;
}
