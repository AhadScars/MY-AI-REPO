import { ipcMain } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type {
  GitBranchRequest,
  GitCheckoutRequest,
  GitCommitRequest,
  GitDiffRequest,
  GitLogRequest,
  GitPathsRequest,
  GitRemoteRequest,
  GitRepoRequest,
  GitSetRemoteRequest,
  GitCloneRequest,
} from '../../../packages/protocol/src/git.js';
import type { SettingsStore } from '../security/settings-store.js';
import { GitService } from './git-service.js';

export function registerGitIpc(settingsStore: SettingsStore): GitService {
  const git = new GitService();

  const syncGitPath = () => {
    const configured = settingsStore.get<string>('git.gitPath');
    if (configured && typeof configured === 'string') {
      try {
        git.setGitPath(configured);
      } catch {
        // keep default
      }
    }
  };
  syncGitPath();

  ipcMain.handle(IpcChannels.GIT_STATUS, async (_e, request: GitRepoRequest) => {
    syncGitPath();
    return git.status(request.cwd);
  });

  ipcMain.handle(IpcChannels.GIT_STAGE, async (_e, request: GitPathsRequest) => {
    syncGitPath();
    await git.stage(request.cwd, request.paths);
  });

  ipcMain.handle(IpcChannels.GIT_UNSTAGE, async (_e, request: GitPathsRequest) => {
    syncGitPath();
    await git.unstage(request.cwd, request.paths);
  });

  ipcMain.handle(IpcChannels.GIT_DISCARD, async (_e, request: GitPathsRequest) => {
    syncGitPath();
    await git.discard(request.cwd, request.paths);
  });

  ipcMain.handle(IpcChannels.GIT_COMMIT, async (_e, request: GitCommitRequest) => {
    syncGitPath();
    await git.commit(request.cwd, request.message, request.amend);
  });

  ipcMain.handle(IpcChannels.GIT_BRANCHES, async (_e, request: GitRepoRequest) => {
    syncGitPath();
    return git.listBranches(request.cwd);
  });

  ipcMain.handle(IpcChannels.GIT_CHECKOUT, async (_e, request: GitCheckoutRequest) => {
    syncGitPath();
    await git.checkout(request.cwd, request.ref);
  });

  ipcMain.handle(IpcChannels.GIT_CREATE_BRANCH, async (_e, request: GitBranchRequest) => {
    syncGitPath();
    await git.createBranch(request.cwd, request.name, request.checkout ?? true);
  });

  ipcMain.handle(IpcChannels.GIT_DIFF, async (_e, request: GitDiffRequest) => {
    syncGitPath();
    return git.diff(request.cwd, request.path, request.staged);
  });

  ipcMain.handle(IpcChannels.GIT_LOG, async (_e, request: GitLogRequest) => {
    syncGitPath();
    return git.log(request.cwd, request.limit);
  });

  ipcMain.handle(IpcChannels.GIT_FETCH, async (_e, request: GitRemoteRequest) => {
    syncGitPath();
    return git.fetch(request.cwd, request.remote);
  });

  ipcMain.handle(IpcChannels.GIT_PULL, async (_e, request: GitRemoteRequest) => {
    syncGitPath();
    return git.pull(request.cwd, request.remote);
  });

  ipcMain.handle(IpcChannels.GIT_PUSH, async (_e, request: GitRemoteRequest) => {
    syncGitPath();
    return git.push(request.cwd, request.remote);
  });

  ipcMain.handle(IpcChannels.GIT_INIT, async (_e, request: GitRepoRequest) => {
    syncGitPath();
    await git.init(request.cwd);
  });

  ipcMain.handle(IpcChannels.GIT_LIST_REMOTES, async (_e, request: GitRepoRequest) => {
    syncGitPath();
    return git.listRemotes(request.cwd);
  });

  ipcMain.handle(IpcChannels.GIT_SET_REMOTE, async (_e, request: GitSetRemoteRequest) => {
    syncGitPath();
    await git.setRemote(request.cwd, request.url, request.name ?? 'origin');
  });

  ipcMain.handle(IpcChannels.GIT_CLONE, async (_e, request: GitCloneRequest) => {
    syncGitPath();
    const dest = await git.clone(request.url, request.parentDir, request.directoryName);
    return { path: dest };
  });

  return git;
}
