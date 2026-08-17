import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type {
  ProjectDepsRequest,
  RunProgramRequest,
  RunStopRequest,
  RunWriteRequest,
} from '../../../packages/protocol/src/run.js';
import { RunService } from './run-service.js';

export function registerRunIpc(getWindow: () => BrowserWindow | null): RunService {
  const service = new RunService(getWindow);

  ipcMain.handle(IpcChannels.RUN_DETECT, (_e, request: { filePath: string }) => {
    return service.detect(request.filePath);
  });

  ipcMain.handle(IpcChannels.RUN_START, async (_e, request: RunProgramRequest) => {
    return service.start(request);
  });

  ipcMain.handle(IpcChannels.RUN_STOP, (_e, request?: RunStopRequest) => {
    return service.stop(request?.runId);
  });

  ipcMain.handle(IpcChannels.RUN_WRITE, (_e, request: RunWriteRequest) => {
    service.write(request);
  });

  ipcMain.handle(IpcChannels.RUN_PROJECT_DETECT, (_e, request: { rootPath: string }) => {
    return service.detectProject(request.rootPath);
  });

  ipcMain.handle(IpcChannels.RUN_PROJECT_DEPS, async (_e, request: ProjectDepsRequest) => {
    return service.startProjectDeps(request);
  });

  return service;
}
