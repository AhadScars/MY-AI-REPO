import { describe, it, expect } from 'vitest';
import { parsePorcelainStatus, emptyStatus } from '../electron/main/git/status-parser';

describe('parsePorcelainStatus', () => {
  it('parses branch header with ahead/behind', () => {
    const out = `## main...origin/main [ahead 2, behind 1]
 M src/app.ts
A  src/new.ts
?? README.local.md
`;
    const status = parsePorcelainStatus(out, '/repo');
    expect(status.isRepo).toBe(true);
    expect(status.branch).toBe('main');
    expect(status.upstream).toBe('origin/main');
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(1);
    expect(status.unstaged.some((c) => c.relativePath === 'src/app.ts')).toBe(true);
    expect(status.staged.some((c) => c.relativePath === 'src/new.ts' && c.status === 'added')).toBe(
      true,
    );
    expect(status.unstaged.some((c) => c.status === 'untracked')).toBe(true);
    expect(status.statusMap['src/app.ts']).toBe('modified');
  });

  it('parses merge conflicts', () => {
    const out = `## main
UU conflict.ts
`;
    const status = parsePorcelainStatus(out, '/repo');
    expect(status.conflicted).toHaveLength(1);
    expect(status.conflicted[0]?.status).toBe('conflict');
    expect(status.statusMap['conflict.ts']).toBe('conflict');
  });

  it('parses renames', () => {
    const out = `## main
R  old.ts -> new.ts
`;
    const status = parsePorcelainStatus(out, '/repo');
    expect(status.staged[0]?.status).toBe('renamed');
    expect(status.staged[0]?.relativePath).toBe('new.ts');
  });

  it('emptyStatus is not a repo', () => {
    expect(emptyStatus().isRepo).toBe(false);
  });
});
