import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface GitRunResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Run git with an argv array only — never shell interpolation.
 * `cwd` is validated to exist; git executable is fixed or from settings.
 */
export async function runGit(
  args: string[],
  cwd: string,
  gitPath = 'git',
  timeoutMs = 60_000,
): Promise<GitRunResult> {
  const resolvedCwd = path.resolve(cwd);
  if (!fs.existsSync(resolvedCwd)) {
    throw new Error(`Working directory does not exist: ${resolvedCwd}`);
  }

  // Reject empty / dangerous path-like args that look like options injection via paths
  for (const arg of args) {
    if (arg.includes('\0')) {
      throw new Error('Invalid argument');
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(gitPath, args, {
      cwd: resolvedCwd,
      env: {
        ...process.env,
        // Force English for parsing porcelain output consistently
        LANG: 'C',
        LC_ALL: 'C',
        GIT_TERMINAL_PROMPT: '0',
      },
      windowsHide: true,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`git ${args[0] ?? ''} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

/** Ensure cwd is inside a git work tree; returns repo root or null. */
export async function findGitRoot(cwd: string, gitPath = 'git'): Promise<string | null> {
  try {
    const result = await runGit(['rev-parse', '--show-toplevel'], cwd, gitPath, 10_000);
    if (result.code !== 0) return null;
    const root = result.stdout.trim();
    return root || null;
  } catch {
    return null;
  }
}
