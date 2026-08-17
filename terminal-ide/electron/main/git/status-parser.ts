import path from 'node:path';
import type { GitChange, GitFileStatusCode, GitStatusResult } from '../../../packages/protocol/src/git.js';

/**
 * Parse `git status --porcelain=v1 -b` output.
 * Spec: https://git-scm.com/docs/git-status#_short_format
 */
export function parsePorcelainStatus(output: string, rootPath: string): GitStatusResult {
  const lines = output.split(/\r?\n/).filter((l) => l.length > 0);

  let branch: string | null = null;
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;

  const staged: GitChange[] = [];
  const unstaged: GitChange[] = [];
  const conflicted: GitChange[] = [];
  const statusMap: Record<string, GitFileStatusCode> = {};

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const header = line.slice(3);
      // ## main...origin/main [ahead 1, behind 2]
      // ## HEAD (no branch)
      const noBranch = header.startsWith('HEAD (no branch)');
      if (noBranch) {
        branch = 'HEAD (detached)';
        continue;
      }

      const dots = header.indexOf('...');
      if (dots >= 0) {
        branch = header.slice(0, dots).trim();
        const rest = header.slice(dots + 3);
        const spaceIdx = rest.search(/\s/);
        upstream = (spaceIdx >= 0 ? rest.slice(0, spaceIdx) : rest).trim() || null;
        const aheadM = rest.match(/ahead\s+(\d+)/);
        const behindM = rest.match(/behind\s+(\d+)/);
        if (aheadM) ahead = Number(aheadM[1]);
        if (behindM) behind = Number(behindM[1]);
      } else {
        const spaceIdx = header.search(/\s/);
        branch = (spaceIdx >= 0 ? header.slice(0, spaceIdx) : header).trim();
      }
      continue;
    }

    if (line.length < 3) continue;

    const x = line[0]!;
    const y = line[1]!;
    // path starts at index 3; renames use "old -> new"
    const pathPart = line.slice(3);

    let relativePath = pathPart;
    let oldPath: string | undefined;

    if (pathPart.includes(' -> ')) {
      const [from, to] = pathPart.split(' -> ');
      oldPath = from?.trim();
      relativePath = to?.trim() ?? pathPart;
    }

    // Unquoted paths; git may quote paths with special chars — strip quotes
    relativePath = unquoteGitPath(relativePath);
    if (oldPath) oldPath = unquoteGitPath(oldPath);

    const absPath = path.join(rootPath, relativePath);
    const absOld = oldPath ? path.join(rootPath, oldPath) : undefined;

    const unmergedCodes = new Set(['AU', 'UD', 'UA', 'DU', 'AA', 'DD', 'UU', 'DU']);
    const isUnmerged = unmergedCodes.has(`${x}${y}`) || x === 'U' || y === 'U';

    if (isUnmerged) {
      const change: GitChange = {
        path: absPath,
        relativePath,
        oldPath: absOld,
        status: 'conflict',
        staged: false,
      };
      conflicted.push(change);
      statusMap[relativePath] = 'conflict';
      statusMap[normalizeKey(relativePath)] = 'conflict';
      continue;
    }

    if (x === '?' && y === '?') {
      const change: GitChange = {
        path: absPath,
        relativePath,
        status: 'untracked',
        staged: false,
      };
      unstaged.push(change);
      statusMap[relativePath] = 'untracked';
      continue;
    }

    if (x === '!' && y === '!') {
      statusMap[relativePath] = 'ignored';
      continue;
    }

    // Index (staged) status in X
    if (x !== ' ' && x !== '?') {
      const status = mapCode(x, true);
      staged.push({
        path: absPath,
        relativePath,
        oldPath: absOld,
        status,
        staged: true,
      });
      // Prefer conflict/modified over untracked in map
      if (!statusMap[relativePath] || statusMap[relativePath] === 'untracked') {
        statusMap[relativePath] = status;
      }
    }

    // Worktree status in Y
    if (y !== ' ' && y !== '?') {
      const status = mapCode(y, false);
      unstaged.push({
        path: absPath,
        relativePath,
        oldPath: absOld,
        status,
        staged: false,
        both: x !== ' ' && x !== '?',
      });
      // Worktree modifications take decoration priority for explorer
      if (status === 'modified' || status === 'deleted' || !statusMap[relativePath]) {
        statusMap[relativePath] = status;
      }
    }
  }

  return {
    isRepo: true,
    rootPath,
    branch,
    upstream,
    ahead,
    behind,
    staged,
    unstaged,
    conflicted,
    statusMap,
  };
}

function mapCode(code: string, _staged: boolean): GitFileStatusCode {
  switch (code) {
    case 'M':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case 'T':
      return 'typechange';
    case 'U':
      return 'conflict';
    default:
      return 'modified';
  }
}

function unquoteGitPath(p: string): string {
  if (p.startsWith('"') && p.endsWith('"')) {
    return p
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  return p;
}

function normalizeKey(p: string): string {
  return p.replace(/\\/g, '/');
}

export function emptyStatus(cwd: string | null = null): GitStatusResult {
  return {
    isRepo: false,
    rootPath: cwd,
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    conflicted: [],
    statusMap: {},
  };
}
