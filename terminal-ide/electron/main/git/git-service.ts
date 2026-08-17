import path from 'node:path';
import type {
  GitBranchInfo,
  GitDiffResult,
  GitLogEntry,
  GitStatusResult,
} from '../../../packages/protocol/src/git.js';
import { findGitRoot, runGit } from './git-runner.js';
import { emptyStatus, parsePorcelainStatus } from './status-parser.js';

/**
 * Safe Git abstraction for the main process.
 * All operations use argv arrays — never user strings embedded in a shell command.
 */
export class GitService {
  private gitPath: string;

  constructor(gitPath = 'git') {
    this.gitPath = gitPath;
  }

  setGitPath(gitPath: string): void {
    // Only allow simple executable names or absolute paths — no shell metacharacters
    if (!gitPath || /[;&|`$<>]/.test(gitPath)) {
      throw new Error('Invalid git executable path');
    }
    this.gitPath = gitPath;
  }

  private async ensureRepo(cwd: string): Promise<string> {
    const root = await findGitRoot(cwd, this.gitPath);
    if (!root) {
      throw new Error('Not a git repository');
    }
    return root;
  }

  /** Convert absolute paths to repo-relative paths for git commands. */
  private toRelative(root: string, filePath: string): string {
    const abs = path.resolve(filePath);
    const rel = path.relative(root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Path is outside repository: ${filePath}`);
    }
    // Git on Windows accepts forward slashes
    return rel.split(path.sep).join('/');
  }

  async status(cwd: string): Promise<GitStatusResult> {
    const root = await findGitRoot(cwd, this.gitPath);
    if (!root) return emptyStatus(cwd);

    const result = await runGit(
      ['status', '--porcelain=v1', '-b', '--untracked-files=all'],
      root,
      this.gitPath,
    );

    if (result.code !== 0 && !result.stdout.includes('##')) {
      // Empty repo edge cases still often return 0
      if (result.stderr.includes('not a git repository')) {
        return emptyStatus(cwd);
      }
    }

    return parsePorcelainStatus(result.stdout, root);
  }

  async stage(cwd: string, paths: string[]): Promise<void> {
    const root = await this.ensureRepo(cwd);
    if (paths.length === 0) return;
    const rels = paths.map((p) => this.toRelative(root, p));
    // `git add -- <paths>` — never interpret as options
    const result = await runGit(['add', '--', ...rels], root, this.gitPath);
    if (result.code !== 0) {
      throw new Error(result.stderr || 'git add failed');
    }
  }

  async unstage(cwd: string, paths: string[]): Promise<void> {
    const root = await this.ensureRepo(cwd);
    if (paths.length === 0) return;
    const rels = paths.map((p) => this.toRelative(root, p));
    // Restore from HEAD into index
    const result = await runGit(['restore', '--staged', '--', ...rels], root, this.gitPath);
    if (result.code !== 0) {
      // Fallback for older git
      const fallback = await runGit(['reset', 'HEAD', '--', ...rels], root, this.gitPath);
      if (fallback.code !== 0) {
        throw new Error(fallback.stderr || result.stderr || 'git unstage failed');
      }
    }
  }

  async discard(cwd: string, paths: string[]): Promise<void> {
    const root = await this.ensureRepo(cwd);
    if (paths.length === 0) return;
    const rels = paths.map((p) => this.toRelative(root, p));

    // Separate untracked vs tracked by status
    const status = await this.status(root);
    const untracked = new Set(
      status.unstaged.filter((c) => c.status === 'untracked').map((c) => c.relativePath),
    );

    const toRestore: string[] = [];
    const toClean: string[] = [];
    for (const rel of rels) {
      if (untracked.has(rel)) toClean.push(rel);
      else toRestore.push(rel);
    }

    if (toRestore.length > 0) {
      const result = await runGit(['restore', '--worktree', '--', ...toRestore], root, this.gitPath);
      if (result.code !== 0) {
        const fallback = await runGit(['checkout', '--', ...toRestore], root, this.gitPath);
        if (fallback.code !== 0) {
          throw new Error(fallback.stderr || result.stderr || 'git discard failed');
        }
      }
    }

    if (toClean.length > 0) {
      // Remove untracked files only — paths already validated relative to repo
      const result = await runGit(['clean', '-f', '--', ...toClean], root, this.gitPath);
      if (result.code !== 0) {
        throw new Error(result.stderr || 'git clean failed');
      }
    }
  }

  async commit(cwd: string, message: string, amend = false): Promise<void> {
    const root = await this.ensureRepo(cwd);
    const msg = message.trim();
    if (!msg && !amend) {
      throw new Error('Commit message is required');
    }
    // Pass message via -m argument array (not shell)
    const args = ['commit'];
    if (amend) args.push('--amend');
    if (msg) {
      args.push('-m', msg);
    } else if (amend) {
      args.push('--no-edit');
    }
    const result = await runGit(args, root, this.gitPath);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'git commit failed');
    }
  }

  async listBranches(cwd: string): Promise<GitBranchInfo[]> {
    const root = await this.ensureRepo(cwd);
    const result = await runGit(
      ['for-each-ref', '--format=%(refname:short)%00%(HEAD)%00%(upstream:short)', 'refs/heads'],
      root,
      this.gitPath,
    );
    if (result.code !== 0) {
      throw new Error(result.stderr || 'Failed to list branches');
    }

    return result.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [name, head, upstream] = line.split('\0');
        return {
          name: name ?? '',
          current: head === '*',
          upstream: upstream || undefined,
        };
      })
      .filter((b) => b.name);
  }

  async checkout(cwd: string, ref: string): Promise<void> {
    const root = await this.ensureRepo(cwd);
    // Validate ref-ish: allow branch names / simple refs — reject option-like strings
    if (!ref || ref.startsWith('-')) {
      throw new Error('Invalid ref');
    }
    if (/[;&|`$]/.test(ref)) {
      throw new Error('Invalid ref characters');
    }
    const result = await runGit(['switch', ref], root, this.gitPath);
    if (result.code !== 0) {
      const retry = await runGit(['checkout', ref], root, this.gitPath);
      if (retry.code !== 0) {
        throw new Error(retry.stderr || result.stderr || 'checkout failed');
      }
    }
  }

  async createBranch(cwd: string, name: string, checkout = true): Promise<void> {
    const root = await this.ensureRepo(cwd);
    if (!/^[A-Za-z0-9._/-]+$/.test(name) || name.startsWith('-')) {
      throw new Error('Invalid branch name');
    }
    if (checkout) {
      const result = await runGit(['switch', '-c', name], root, this.gitPath);
      if (result.code !== 0) {
        const fallback = await runGit(['checkout', '-b', name], root, this.gitPath);
        if (fallback.code !== 0) {
          throw new Error(fallback.stderr || result.stderr || 'create branch failed');
        }
      }
    } else {
      const result = await runGit(['branch', name], root, this.gitPath);
      if (result.code !== 0) {
        throw new Error(result.stderr || 'create branch failed');
      }
    }
  }

  async diff(cwd: string, filePath: string, staged = false): Promise<GitDiffResult> {
    const root = await this.ensureRepo(cwd);
    const rel = this.toRelative(root, filePath);
    const args = staged
      ? ['diff', '--cached', '--', rel]
      : ['diff', '--', rel];

    // Untracked: show as /dev/null diff via show
    const status = await this.status(root);
    const isUntracked = status.unstaged.some(
      (c) => c.relativePath === rel && c.status === 'untracked',
    );

    if (isUntracked && !staged) {
      // Fake a simple "new file" presentation
      const show = await runGit(['show', `:${rel}`], root, this.gitPath).catch(() => null);
      void show;
      const fs = await import('node:fs/promises');
      let content = '';
      try {
        content = await fs.readFile(path.join(root, rel), 'utf-8');
      } catch {
        content = '';
      }
      if (content.includes('\0')) {
        return { path: path.join(root, rel), staged, diff: '', isBinary: true };
      }
      const lines = content.split(/\r?\n/);
      const diff = [
        `diff --git a/${rel} b/${rel}`,
        'new file mode 100644',
        '--- /dev/null',
        `+++ b/${rel}`,
        `@@ -0,0 +1,${lines.length} @@`,
        ...lines.map((l) => `+${l}`),
      ].join('\n');
      return { path: path.join(root, rel), staged, diff, isBinary: false };
    }

    const result = await runGit(args, root, this.gitPath);
    // git diff returns 0 or 1 when differences exist
    if (result.code > 1) {
      throw new Error(result.stderr || 'git diff failed');
    }
    const isBinary = /Binary files .* differ/.test(result.stdout);
    return {
      path: path.join(root, rel),
      staged,
      diff: result.stdout,
      isBinary,
    };
  }

  async log(cwd: string, limit = 30): Promise<GitLogEntry[]> {
    const root = await this.ensureRepo(cwd);
    const n = Math.min(Math.max(1, limit), 100);
    const result = await runGit(
      ['log', `-n${n}`, '--format=%H%x00%h%x00%an%x00%aI%x00%s'],
      root,
      this.gitPath,
    );
    if (result.code !== 0) {
      // Empty repo
      if (result.stderr.includes('does not have any commits')) return [];
      throw new Error(result.stderr || 'git log failed');
    }
    return result.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, author, date, subject] = line.split('\0');
        return {
          hash: hash ?? '',
          shortHash: shortHash ?? '',
          author: author ?? '',
          date: date ?? '',
          subject: subject ?? '',
        };
      });
  }

  async fetch(cwd: string, remote = 'origin'): Promise<string> {
    const root = await this.ensureRepo(cwd);
    if (!/^[A-Za-z0-9._-]+$/.test(remote)) {
      throw new Error('Invalid remote name');
    }
    const result = await runGit(['fetch', remote], root, this.gitPath, 120_000);
    if (result.code !== 0) {
      throw new Error(result.stderr || 'git fetch failed');
    }
    return result.stdout || result.stderr || 'Fetch complete';
  }

  async pull(cwd: string, remote = 'origin'): Promise<string> {
    const root = await this.ensureRepo(cwd);
    if (!/^[A-Za-z0-9._-]+$/.test(remote)) {
      throw new Error('Invalid remote name');
    }
    const result = await runGit(['pull', '--ff-only', remote], root, this.gitPath, 120_000);
    if (result.code !== 0) {
      // Retry without ff-only for usability
      const retry = await runGit(['pull', remote], root, this.gitPath, 120_000);
      if (retry.code !== 0) {
        throw new Error(retry.stderr || result.stderr || 'git pull failed');
      }
      return retry.stdout || retry.stderr || 'Pull complete';
    }
    return result.stdout || result.stderr || 'Pull complete';
  }

  async listRemotes(cwd: string): Promise<Array<{ name: string; fetchUrl: string; pushUrl: string }>> {
    const root = await this.ensureRepo(cwd);
    const result = await runGit(['remote', '-v'], root, this.gitPath);
    if (result.code !== 0) {
      return [];
    }
    const map = new Map<string, { name: string; fetchUrl: string; pushUrl: string }>();
    for (const line of result.stdout.split(/\r?\n/)) {
      // origin  https://github.com/x/y.git (fetch)
      const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)\s*$/);
      if (!m) continue;
      const name = m[1]!;
      const url = m[2]!;
      const kind = m[3]!;
      const cur = map.get(name) ?? { name, fetchUrl: '', pushUrl: '' };
      if (kind === 'fetch') cur.fetchUrl = url;
      else cur.pushUrl = url;
      map.set(name, cur);
    }
    return [...map.values()];
  }

  /**
   * Add or update a remote URL (default name: origin).
   */
  async setRemote(cwd: string, url: string, name = 'origin'): Promise<void> {
    const root = await this.ensureRepo(cwd);
    if (!/^[A-Za-z0-9._-]+$/.test(name)) {
      throw new Error('Invalid remote name');
    }
    const trimmed = url.trim();
    if (!trimmed || /\s/.test(trimmed) || /[;&|`$<>]/.test(trimmed)) {
      throw new Error('Invalid remote URL');
    }
    // Only allow common git URL shapes
    if (
      !/^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/i.test(trimmed) &&
      !trimmed.endsWith('.git')
    ) {
      // still allow file paths / other remotes if they look like a path
      if (!/^[A-Za-z]:[\\/]/.test(trimmed) && !trimmed.startsWith('/') && !trimmed.startsWith('.')) {
        throw new Error(
          'Remote URL must look like https://github.com/user/repo.git or git@github.com:user/repo.git',
        );
      }
    }

    const existing = await this.listRemotes(cwd);
    const has = existing.some((r) => r.name === name);
    const args = has
      ? (['remote', 'set-url', name, trimmed] as string[])
      : (['remote', 'add', name, trimmed] as string[]);
    const result = await runGit(args, root, this.gitPath);
    if (result.code !== 0) {
      throw new Error(result.stderr || 'Failed to set remote');
    }
  }

  async push(cwd: string, remote?: string): Promise<string> {
    const root = await this.ensureRepo(cwd);
    const remotes = await this.listRemotes(cwd);

    if (remotes.length === 0) {
      throw new Error(
        'NO_REMOTE: No remote repository configured. Add a remote URL (e.g. your GitHub repo) before pushing.',
      );
    }

    let remoteName = remote ?? 'origin';
    if (!remotes.some((r) => r.name === remoteName)) {
      // Fall back to first configured remote
      remoteName = remotes[0]!.name;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(remoteName)) {
      throw new Error('Invalid remote name');
    }

    const result = await runGit(['push', '-u', remoteName, 'HEAD'], root, this.gitPath, 120_000);
    if (result.code !== 0) {
      const err = result.stderr || result.stdout || 'git push failed';
      if (/does not appear to be a git repository|Could not read from remote|Repository not found/i.test(err)) {
        throw new Error(
          `REMOTE_INVALID: Cannot push to "${remoteName}". Check the remote URL and your access rights.\n${err}`,
        );
      }
      throw new Error(err);
    }
    return result.stdout || result.stderr || `Pushed to ${remoteName}`;
  }

  async init(cwd: string): Promise<void> {
    const result = await runGit(['init'], path.resolve(cwd), this.gitPath);
    if (result.code !== 0) {
      throw new Error(result.stderr || 'git init failed');
    }
  }

  /**
   * Clone a remote repository into parentDir/name and return the new folder path.
   */
  async clone(
    url: string,
    parentDir: string,
    directoryName?: string,
  ): Promise<string> {
    const trimmed = url.trim();
    if (!trimmed || /[;&|`$<>]/.test(trimmed)) {
      throw new Error('Invalid repository URL');
    }
    if (
      !/^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/i.test(trimmed) &&
      !trimmed.endsWith('.git')
    ) {
      throw new Error('URL must look like https://github.com/user/repo.git');
    }

    const parent = path.resolve(parentDir);
    let name = directoryName?.trim();
    if (!name) {
      const base = trimmed
        .replace(/\/+$/, '')
        .split('/')
        .pop()
        ?.replace(/\.git$/i, '')
        ?.replace(/[:*?"<>|]/g, '-')
        .trim();
      name = base && base.length > 0 ? base : 'repo';
    }
    if (/[\\/]/.test(name) || name === '.' || name === '..') {
      throw new Error('Invalid folder name');
    }

    const target = path.join(parent, name);
    const result = await runGit(
      ['clone', '--', trimmed, target],
      parent,
      this.gitPath,
      300_000,
    );
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'git clone failed');
    }
    return target;
  }
}
