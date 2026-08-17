import { describe, it, expect } from 'vitest';
import { basename, dirname, extname, joinPath, normalizePath } from '../packages/shared/src/path';
import { languageFromPath } from '../packages/shared/src/language';

describe('path helpers', () => {
  it('basename extracts file name', () => {
    expect(basename('C:\\Users\\dev\\app.ts')).toBe('app.ts');
    expect(basename('/home/dev/app.ts')).toBe('app.ts');
  });

  it('dirname extracts directory', () => {
    expect(dirname('/home/dev/app.ts')).toBe('/home/dev');
    expect(dirname('C:/Users/dev/app.ts')).toBe('C:/Users/dev');
  });

  it('extname returns extension', () => {
    expect(extname('file.test.ts')).toBe('.ts');
    expect(extname('Makefile')).toBe('');
  });

  it('joinPath joins segments', () => {
    expect(joinPath('/home', 'dev', 'src')).toBe('/home/dev/src');
  });

  it('normalizePath uses forward slashes', () => {
    expect(normalizePath('C:\\foo\\bar')).toBe('C:/foo/bar');
  });
});

describe('languageFromPath', () => {
  it('maps common extensions', () => {
    expect(languageFromPath('a.ts')).toBe('typescript');
    expect(languageFromPath('a.tsx')).toBe('typescriptreact');
    expect(languageFromPath('a.py')).toBe('python');
    expect(languageFromPath('a.rs')).toBe('rust');
    expect(languageFromPath('a.go')).toBe('go');
    expect(languageFromPath('a.unknown')).toBe('plaintext');
  });
});
