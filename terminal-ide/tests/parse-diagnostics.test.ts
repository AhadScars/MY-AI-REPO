import { describe, it, expect } from 'vitest';
import {
  parseDiagnosticsFromOutput,
  diagnosticMatchesPath,
  stripAnsi,
} from '../src/features/run/parseDiagnostics';

describe('stripAnsi', () => {
  it('removes color codes from terminal output', () => {
    const raw = '\x1b[31mLRUCache.java:10: error: bad\x1b[0m';
    expect(stripAnsi(raw)).toBe('LRUCache.java:10: error: bad');
  });
});

describe('parseDiagnosticsFromOutput', () => {
  it('parses javac errors', () => {
    const out = `LRUCache.java:42: error: cannot find symbol
  symbol:   variable x
  location: class LRUCache
1 error
`;
    const diags = parseDiagnosticsFromOutput(out, 'C:/proj/LRUCache.java');
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0]?.line).toBe(42);
    expect(diags[0]?.message).toContain('cannot find symbol');
    expect(diags[0]?.severity).toBe('error');
    expect(diags[0]?.path).toBe('C:/proj/LRUCache.java');
  });

  it('parses javac errors with ANSI (terminal)', () => {
    const out = `\x1b[1m\x1b[31mFoo.java:7: error: ';' expected\x1b[0m`;
    const diags = parseDiagnosticsFromOutput(out, 'D:/work/Foo.java', 'terminal');
    expect(diags[0]?.line).toBe(7);
    expect(diags[0]?.message).toContain("';' expected");
    expect(diags[0]?.source).toBe('terminal');
  });

  it('parses python traceback', () => {
    const out = `Traceback (most recent call last):
  File "app.py", line 10, in <module>
    print(1/0)
ZeroDivisionError: division by zero
`;
    const diags = parseDiagnosticsFromOutput(out, '/home/u/app.py');
    expect(diags.some((d) => d.line === 10)).toBe(true);
    expect(diags.some((d) => d.message.includes('ZeroDivisionError'))).toBe(true);
  });

  it('parses gcc style', () => {
    const out = `main.c:5:3: error: expected ';' before '}' token`;
    const diags = parseDiagnosticsFromOutput(out);
    expect(diags[0]?.line).toBe(5);
    expect(diags[0]?.column).toBe(3);
  });
});

describe('diagnosticMatchesPath', () => {
  it('matches basename and full path', () => {
    expect(diagnosticMatchesPath('LRUCache.java', 'C:/code/LRUCache.java')).toBe(true);
    expect(diagnosticMatchesPath('C:/code/LRUCache.java', 'C:/code/LRUCache.java')).toBe(true);
  });
});
