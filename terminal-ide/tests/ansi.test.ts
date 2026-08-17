import { describe, it, expect } from 'vitest';
import {
  normalizeTerminalChunk,
  parseAnsiToSegments,
  stripAnsi,
} from '../src/features/run/ansi';

describe('normalizeTerminalChunk', () => {
  it('keeps last frame after carriage-return progress rewrite', () => {
    expect(normalizeTerminalChunk('Downloading\rDone    \n')).toBe('Done    \n');
  });

  it('applies backspace', () => {
    expect(normalizeTerminalChunk('ab\bc')).toBe('ac');
  });

  it('strips OSC sequences', () => {
    expect(normalizeTerminalChunk('\x1b]0;title\x07hello')).toBe('hello');
  });
});

describe('stripAnsi', () => {
  it('removes color codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m plain')).toBe('red plain');
  });
});

describe('parseAnsiToSegments', () => {
  it('splits colored text into segments', () => {
    const segs = parseAnsiToSegments('\x1b[32mOK\x1b[0m fail');
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs.map((s) => s.text).join('')).toBe('OK fail');
    expect(segs[0]?.style.color).toBeTruthy();
  });

  it('handles bold red spring-style errors', () => {
    const segs = parseAnsiToSegments('\x1b[1m\x1b[31mERROR\x1b[0m');
    expect(stripAnsi(segs.map((s) => s.text).join(''))).toBe('ERROR');
    expect(segs.some((s) => s.style.color || s.style.fontWeight === 'bold')).toBe(true);
  });

  it('does not leave escape garbage in text', () => {
    const segs = parseAnsiToSegments('\x1b[2J\x1b[HVisible');
    expect(segs.map((s) => s.text).join('')).toBe('Visible');
  });
});
