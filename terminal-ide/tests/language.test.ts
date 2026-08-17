import { describe, it, expect } from 'vitest';
import {
  languageFromPath,
  toMonacoLanguage,
  isTextFile,
} from '../packages/shared/src/language';

describe('toMonacoLanguage', () => {
  it('maps react variants to monaco base languages', () => {
    expect(toMonacoLanguage('typescriptreact')).toBe('typescript');
    expect(toMonacoLanguage('javascriptreact')).toBe('javascript');
    expect(toMonacoLanguage('python')).toBe('python');
  });
});

describe('languageFromPath extras', () => {
  it('detects dockerfile-like names', () => {
    expect(languageFromPath('Dockerfile')).toBe('shell');
  });

  it('isTextFile recognizes env and lock files', () => {
    expect(isTextFile('.env')).toBe(true);
    expect(isTextFile('package-lock.json')).toBe(true);
    expect(isTextFile('photo.png')).toBe(false);
  });
});
