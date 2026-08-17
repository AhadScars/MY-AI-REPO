import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ShellId, ShellInfo } from '../../../packages/protocol/src/terminal.js';

export interface ResolvedShell {
  id: ShellId;
  path: string;
  args: string[];
  name: string;
}

function exists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

function whichOnPath(name: string): string | null {
  const pathEnv = process.env.PATH ?? process.env.Path ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').filter(Boolean)
      : [''];

  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, name + (process.platform === 'win32' ? ext : ''));
      if (exists(candidate)) return candidate;
    }
    // Also try without forcing extension casing
    const plain = path.join(dir, name);
    if (exists(plain)) return plain;
  }
  return null;
}

function findPowerShell(): string | null {
  const candidates = [
    path.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    ),
    path.join(
      process.env.ProgramFiles ?? 'C:\\Program Files',
      'PowerShell',
      '7',
      'pwsh.exe',
    ),
    whichOnPath('pwsh'),
    whichOnPath('powershell'),
  ];
  for (const c of candidates) {
    if (c && exists(c)) return c;
  }
  return null;
}

function findCmd(): string | null {
  const candidates = [
    path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe'),
    whichOnPath('cmd'),
  ];
  for (const c of candidates) {
    if (c && exists(c)) return c;
  }
  return null;
}

function findGitBash(): string | null {
  const candidates = [
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Git', 'bin', 'bash.exe'),
    whichOnPath('bash'),
  ];
  for (const c of candidates) {
    if (c && exists(c)) return c;
  }
  return null;
}

function findWsl(): string | null {
  const candidates = [
    path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'wsl.exe'),
    whichOnPath('wsl'),
  ];
  for (const c of candidates) {
    if (c && exists(c)) return c;
  }
  return null;
}

function findUnixShell(): { id: ShellId; path: string; name: string } | null {
  const shellEnv = process.env.SHELL;
  if (shellEnv && exists(shellEnv)) {
    const base = path.basename(shellEnv);
    const id: ShellId = base.includes('zsh') ? 'zsh' : 'bash';
    return { id, path: shellEnv, name: base };
  }
  for (const candidate of ['/bin/bash', '/usr/bin/bash', '/bin/zsh', '/usr/bin/zsh', '/bin/sh']) {
    if (exists(candidate)) {
      const base = path.basename(candidate);
      return {
        id: base.includes('zsh') ? 'zsh' : 'bash',
        path: candidate,
        name: base,
      };
    }
  }
  return null;
}

/** Discover available shells on this machine. */
export function listAvailableShells(): ShellInfo[] {
  const shells: ShellInfo[] = [];

  if (process.platform === 'win32') {
    const ps = findPowerShell();
    shells.push({
      id: 'powershell',
      name: 'PowerShell',
      available: Boolean(ps),
      path: ps ?? undefined,
    });
    const cmd = findCmd();
    shells.push({
      id: 'cmd',
      name: 'Command Prompt',
      available: Boolean(cmd),
      path: cmd ?? undefined,
    });
    const gitBash = findGitBash();
    shells.push({
      id: 'git-bash',
      name: 'Git Bash',
      available: Boolean(gitBash),
      path: gitBash ?? undefined,
    });
    const wsl = findWsl();
    shells.push({
      id: 'wsl',
      name: 'WSL',
      available: Boolean(wsl),
      path: wsl ?? undefined,
    });
  } else {
    const unix = findUnixShell();
    shells.push({
      id: 'bash',
      name: 'Bash',
      available: Boolean(unix),
      path: unix?.path,
    });
    if (unix?.id === 'zsh' || exists('/bin/zsh') || exists('/usr/bin/zsh')) {
      const zsh = whichOnPath('zsh') ?? (exists('/bin/zsh') ? '/bin/zsh' : '/usr/bin/zsh');
      shells.push({
        id: 'zsh',
        name: 'Zsh',
        available: exists(zsh),
        path: exists(zsh) ? zsh : undefined,
      });
    }
  }

  shells.unshift({
    id: 'auto',
    name: 'Auto',
    available: true,
  });

  return shells;
}

/**
 * Resolve a shell preference to an executable + args.
 * Never interpolates user-controlled strings into a shell command line.
 */
export function resolveShell(preference: ShellId = 'auto'): ResolvedShell {
  if (process.platform === 'win32') {
    const pick = (id: ShellId): ResolvedShell | null => {
      if (id === 'powershell') {
        const p = findPowerShell();
        if (!p) return null;
        return {
          id: 'powershell',
          path: p,
          args: ['-NoLogo'],
          name: 'PowerShell',
        };
      }
      if (id === 'cmd') {
        const p = findCmd();
        if (!p) return null;
        return { id: 'cmd', path: p, args: [], name: 'Command Prompt' };
      }
      if (id === 'git-bash') {
        const p = findGitBash();
        if (!p) return null;
        return { id: 'git-bash', path: p, args: ['--login', '-i'], name: 'Git Bash' };
      }
      if (id === 'wsl') {
        const p = findWsl();
        if (!p) return null;
        return { id: 'wsl', path: p, args: [], name: 'WSL' };
      }
      return null;
    };

    if (preference !== 'auto') {
      const resolved = pick(preference);
      if (resolved) return resolved;
    }

    // Auto order for Windows
    for (const id of ['powershell', 'cmd', 'git-bash', 'wsl'] as ShellId[]) {
      const resolved = pick(id);
      if (resolved) return resolved;
    }

    // Last resort
    return {
      id: 'cmd',
      path: findCmd() ?? 'cmd.exe',
      args: [],
      name: 'Command Prompt',
    };
  }

  // Unix / Linux / macOS / WSL host
  if (preference === 'zsh') {
    const zsh = whichOnPath('zsh') ?? (exists('/bin/zsh') ? '/bin/zsh' : null);
    if (zsh) return { id: 'zsh', path: zsh, args: ['-l'], name: 'Zsh' };
  }
  if (preference === 'bash' || preference === 'git-bash') {
    const bash = whichOnPath('bash') ?? (exists('/bin/bash') ? '/bin/bash' : null);
    if (bash) return { id: 'bash', path: bash, args: ['-l'], name: 'Bash' };
  }

  const unix = findUnixShell();
  if (unix) {
    return {
      id: unix.id,
      path: unix.path,
      args: ['-l'],
      name: unix.name,
    };
  }

  return {
    id: 'bash',
    path: '/bin/sh',
    args: [],
    name: 'sh',
  };
}

export function defaultCwd(preferred?: string): string {
  if (preferred) {
    try {
      if (fs.statSync(preferred).isDirectory()) return preferred;
    } catch {
      // fall through
    }
  }
  return process.env.HOME || process.env.USERPROFILE || os.homedir() || process.cwd();
}
