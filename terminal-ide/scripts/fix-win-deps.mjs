#!/usr/bin/env node
/**
 * Repair missing Windows Rollup/esbuild natives.
 * Run from PowerShell or CMD in the project root:
 *   npm run fix:win-deps
 *
 * Also safe to run from WSL when node_modules is on a Windows drive.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
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

function pkgPath(name) {
  const parts = name.startsWith('@') ? name.split('/') : [name];
  return path.join(root, 'node_modules', ...parts);
}

function hasPkg(name) {
  const dir = pkgPath(name);
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function packExtract(name, version) {
  const spec = version ? `${name}@${version}` : name;
  const dest = pkgPath(name);
  const tmp = path.join(tmpdir(), `tide-fix-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  console.log(`→ npm pack ${spec}`);
  const pack = spawnSync('npm', ['pack', spec, '--pack-destination', tmp], {
    cwd: root,
    encoding: 'utf-8',
    shell: true,
  });
  if (pack.status !== 0) {
    console.error(pack.stderr || pack.stdout || 'npm pack failed');
    return false;
  }
  const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  if (!tgz) {
    console.error('No tarball produced');
    return false;
  }
  mkdirSync(dest, { recursive: true });
  // Clear incomplete installs (e.g. .rollup-win32-*-random)
  const extract = spawnSync('tar', ['-xzf', path.join(tmp, tgz), '-C', dest, '--strip-components=1'], {
    shell: true,
    stdio: 'inherit',
  });
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
  if (extract.status !== 0) {
    console.error('tar extract failed — on older Windows install tar or use Git Bash');
    return false;
  }
  console.log(`✓ ${name} → ${dest}`);
  return true;
}

const rollupVer =
  readJson(path.join(root, 'node_modules', 'rollup', 'package.json'))?.version ?? '4.62.4';

const needed = [
  { name: '@rollup/rollup-win32-x64-msvc', version: rollupVer },
  { name: '@esbuild/win32-x64', version: undefined },
];

let failed = 0;
for (const { name, version } of needed) {
  if (hasPkg(name)) {
    console.log(`✓ already present: ${name}`);
    continue;
  }
  console.log(`Installing ${name}…`);
  const install = spawnSync(
    'npm',
    ['install', version ? `${name}@${version}` : name, '--no-save', '--force'],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (hasPkg(name)) continue;
  if (!packExtract(name, version)) {
    failed += 1;
    if (install.status !== 0) {
      console.error(`Failed: ${name}`);
    }
  }
}

// Clean npm failed-extract leftovers
const rollupScope = path.join(root, 'node_modules', '@rollup');
if (existsSync(rollupScope)) {
  for (const name of readdirSync(rollupScope)) {
    if (name.startsWith('.rollup-')) {
      try {
        rmSync(path.join(rollupScope, name), { recursive: true, force: true });
        console.log(`cleaned ${name}`);
      } catch {
        // ignore
      }
    }
  }
}

if (failed) {
  console.error(
    '\nCould not fully repair Windows natives.\n' +
      'Try a clean install in PowerShell:\n' +
      '  Remove-Item -Recurse -Force node_modules\n' +
      '  npm install\n',
  );
  process.exit(1);
}

console.log('\nWindows Vite natives OK. Run: npm run dev');
