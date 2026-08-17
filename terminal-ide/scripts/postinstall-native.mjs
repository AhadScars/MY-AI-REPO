#!/usr/bin/env node
/**
 * Best-effort:
 * 1) Ensure platform Rollup/esbuild natives exist
 *    (fixes npm optional-deps bug after installs from WSL then run on Windows, or vice versa).
 * 2) Rebuild node-pty for Electron when possible.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function installedRollupVersion() {
  const pkg = readJson(path.join(root, 'node_modules', 'rollup', 'package.json'));
  return pkg?.version ?? null;
}

function packageDirExists(pkgName) {
  // @rollup/rollup-win32-x64-msvc → node_modules/@rollup/rollup-win32-x64-msvc
  const parts = pkgName.startsWith('@')
    ? pkgName.split('/')
    : [pkgName];
  const dir = path.join(root, 'node_modules', ...parts);
  if (!existsSync(dir)) return false;
  try {
    const files = readdirSync(dir);
    return files.some((f) => f.endsWith('.node') || f.endsWith('.exe') || f === 'package.json');
  } catch {
    return false;
  }
}

/** Extract `npm pack` tarball into node_modules/<pkg> when npm install skips optional deps. */
function packAndExtract(pkgName, version) {
  const spec = version ? `${pkgName}@${version}` : pkgName;
  const destParts = pkgName.startsWith('@') ? pkgName.split('/') : [pkgName];
  const dest = path.join(root, 'node_modules', ...destParts);
  const tmp = path.join(tmpdir(), `tide-pack-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  console.log(`[terminal-ide] Fetching ${spec} via npm pack…`);
  const pack = spawnSync('npm', ['pack', spec, '--pack-destination', tmp], {
    cwd: root,
    encoding: 'utf-8',
    shell: true,
  });
  if (pack.status !== 0) {
    console.warn(`[terminal-ide] npm pack failed for ${spec}`);
    return false;
  }

  const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  if (!tgz) return false;

  mkdirSync(dest, { recursive: true });
  const extract = spawnSync(
    process.platform === 'win32' ? 'tar' : 'tar',
    ['-xzf', path.join(tmp, tgz), '-C', dest, '--strip-components=1'],
    { cwd: root, shell: true, stdio: 'inherit' },
  );
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
  if (extract.status !== 0) {
    // Windows without tar: try powershell Expand-Archive is for zip only.
    // Fallback: npm install into a temp prefix is heavier — report failure.
    return packageDirExists(pkgName);
  }
  return packageDirExists(pkgName);
}

function ensurePkg(pkgName, version) {
  if (packageDirExists(pkgName)) return true;

  console.log(`[terminal-ide] Missing ${pkgName} — installing…`);
  const args = ['install', version ? `${pkgName}@${version}` : pkgName, '--no-save', '--force'];
  const result = spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (packageDirExists(pkgName)) return true;

  // npm often skips foreign-platform optional deps; pack+extract always works
  if (packAndExtract(pkgName, version)) return true;

  if (result.status !== 0) {
    console.warn(`[terminal-ide] Could not install ${pkgName}`);
  }
  return packageDirExists(pkgName);
}

function ensureViteNatives() {
  const rollupVer = installedRollupVersion();

  if (process.platform === 'win32') {
    const okRollup = ensurePkg('@rollup/rollup-win32-x64-msvc', rollupVer ?? undefined);
    const okEsbuild = ensurePkg('@esbuild/win32-x64', undefined);
    if (!okRollup || !okEsbuild) {
      console.warn(
        '\n[terminal-ide] Windows Vite natives missing.\n' +
          '  In PowerShell (project root):\n' +
          '    npm run fix:win-deps\n' +
          '  Or full reinstall:\n' +
          '    Remove-Item -Recurse -Force node_modules; npm install\n',
      );
    }
    return;
  }

  // Linux / WSL: keep linux natives; also try to materialize win32 so dual-boot path works
  if (process.platform === 'linux') {
    ensurePkg('@rollup/rollup-linux-x64-gnu', rollupVer ?? undefined);
    // Best-effort: install Windows natives too (shared node_modules on /mnt/c)
    ensurePkg('@rollup/rollup-win32-x64-msvc', rollupVer ?? undefined);
    ensurePkg('@esbuild/win32-x64', undefined);
  }
}

ensureViteNatives();

const ptyDir = path.join(root, 'node_modules', 'node-pty');
if (!existsSync(ptyDir)) {
  process.exit(0);
}

const result = spawnSync(
  'npx',
  ['@electron/rebuild', '-f', '-w', 'node-pty'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  },
);

if (result.status !== 0) {
  console.warn(
    '\n[terminal-ide] node-pty was not rebuilt for Electron.\n' +
      '  On Windows: install VS Build Tools (Desktop C++), then run: npm run rebuild:native\n' +
      '  On Linux/WSL: sudo apt install build-essential python3, then: npm run rebuild:native\n',
  );
}
