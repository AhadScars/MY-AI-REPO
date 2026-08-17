#!/usr/bin/env node
/**
 * Smoke verification helper for CI / local foundation checks.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'package.json',
  'src/App.tsx',
  'electron/main/main.ts',
  'electron/preload/preload.ts',
  'packages/protocol/src/ipc-channels.ts',
];

let ok = true;
for (const rel of required) {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    console.error('Missing:', rel);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('Foundation structure OK');
