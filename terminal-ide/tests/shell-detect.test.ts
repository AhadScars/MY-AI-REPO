import { describe, it, expect } from 'vitest';
import { listAvailableShells, resolveShell, defaultCwd } from '../electron/main/terminal/shell-detect';

describe('shell-detect', () => {
  it('lists auto shell as available', () => {
    const shells = listAvailableShells();
    expect(shells.some((s) => s.id === 'auto' && s.available)).toBe(true);
  });

  it('resolves a shell without throwing', () => {
    const resolved = resolveShell('auto');
    expect(resolved.path).toBeTruthy();
    expect(resolved.name).toBeTruthy();
    expect(Array.isArray(resolved.args)).toBe(true);
  });

  it('defaultCwd returns a path', () => {
    const cwd = defaultCwd();
    expect(typeof cwd).toBe('string');
    expect(cwd.length).toBeGreaterThan(0);
  });
});
