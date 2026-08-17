import { describe, it, expect } from 'vitest';
import {
  formatContextForPrompt,
  truncateContent,
} from '../packages/ai-core/src/context';
import { PermissionManager } from '../packages/ai-core/src/permissions';

describe('truncateContent', () => {
  it('does not truncate short strings', () => {
    const r = truncateContent('hello', 100);
    expect(r.truncated).toBe(false);
    expect(r.text).toBe('hello');
  });

  it('truncates long strings', () => {
    const r = truncateContent('a'.repeat(200), 20);
    expect(r.truncated).toBe(true);
    expect(r.text.startsWith('a'.repeat(20))).toBe(true);
    expect(r.text).toContain('truncated');
  });
});

describe('formatContextForPrompt', () => {
  it('includes workspace and selection', () => {
    const prompt = formatContextForPrompt({
      workspace: { rootPath: '/proj', name: 'proj' },
      selection: {
        path: '/proj/a.ts',
        text: 'const x = 1',
        startLine: 1,
        endLine: 1,
      },
    });
    expect(prompt).toContain('Terminal - IDE');
    expect(prompt).toContain('/proj');
    expect(prompt).toContain('const x = 1');
  });
});

describe('PermissionManager', () => {
  it('allows safe tools without prompt', () => {
    const pm = new PermissionManager();
    expect(pm.evaluate('read_file', 'safe')).toBe(true);
  });

  it('requires confirm for write until approved', () => {
    const pm = new PermissionManager();
    expect(pm.evaluate('write_file', 'confirm')).toBe(null);
    pm.applyDecision('write_file', 'allow-session');
    expect(pm.evaluate('write_file', 'confirm')).toBe(true);
  });

  it('honors always-deny', () => {
    const pm = new PermissionManager();
    pm.applyDecision('write_file', 'deny');
    expect(pm.evaluate('write_file', 'confirm')).toBe(false);
  });
});
