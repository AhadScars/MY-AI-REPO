import { ipcMain } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type {
  TerminalCreateRequest,
  TerminalKillRequest,
  TerminalResizeRequest,
  TerminalRestartRequest,
  TerminalWriteRequest,
} from '../../../packages/protocol/src/terminal.js';
import type { TerminalManager } from './terminal-manager.js';

export function registerTerminalIpc(manager: TerminalManager): void {
  ipcMain.handle(IpcChannels.TERMINAL_LIST_SHELLS, () => manager.listShells());

  ipcMain.handle(IpcChannels.TERMINAL_CREATE, (_e, request?: TerminalCreateRequest) =>
    manager.create(request ?? {}),
  );

  ipcMain.handle(IpcChannels.TERMINAL_WRITE, (_e, request: TerminalWriteRequest) => {
    manager.write(request.id, request.data);
  });

  ipcMain.handle(IpcChannels.TERMINAL_RESIZE, (_e, request: TerminalResizeRequest) => {
    manager.resize(request.id, request.cols, request.rows);
  });

  ipcMain.handle(IpcChannels.TERMINAL_KILL, (_e, request: TerminalKillRequest) => {
    manager.kill(request.id);
  });

  ipcMain.handle(IpcChannels.TERMINAL_RESTART, (_e, request: TerminalRestartRequest) =>
    manager.restart(request.id, {
      cwd: request.cwd,
      shell: request.shell,
      cols: request.cols,
      rows: request.rows,
    }),
  );

  ipcMain.handle(IpcChannels.TERMINAL_LIST, () => manager.list());
}
