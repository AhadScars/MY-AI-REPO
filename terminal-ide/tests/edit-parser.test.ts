import { describe, it, expect } from 'vitest';
import {
  parseFileEditsFromMarkdown,
  stripCodeFences,
  buildInlineEditPrompt,
} from '../packages/ai-core/src/edit-parser';
import { chunkFile, simpleEmbed, cosine } from '../packages/indexing/src/chunker';

describe('parseFileEditsFromMarkdown', () => {
  it('parses path= fences', () => {
    const text = `
Here is a fix:

\`\`\`typescript path=src/app.ts
export const x = 1;
\`\`\`
`;
    const edits = parseFileEditsFromMarkdown(text);
    expect(edits).toHaveLength(1);
    expect(edits[0]?.path).toBe('src/app.ts');
    expect(edits[0]?.content).toContain('export const x');
  });

  it('parses path-like headers', () => {
    const text = '```src/foo.ts\nhello\n```';
    const edits = parseFileEditsFromMarkdown(text);
    expect(edits[0]?.path).toBe('src/foo.ts');
  });
});

describe('stripCodeFences', () => {
  it('removes wrapping fences', () => {
    expect(stripCodeFences('```ts\ncode\n```')).toBe('code');
  });
});

describe('buildInlineEditPrompt', () => {
  it('includes instruction and code', () => {
    const p = buildInlineEditPrompt({
      instruction: 'add types',
      code: 'function f(x) {}',
      language: 'javascript',
    });
    expect(p).toContain('add types');
    expect(p).toContain('function f');
  });
});

describe('chunkFile', () => {
  it('chunks long files', () => {
    const content = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    const chunks = chunkFile({ path: '/a/b.ts', content, language: 'typescript' });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.startLine).toBe(1);
  });
});

describe('simpleEmbed', () => {
  it('gives higher cosine for similar text', () => {
    const a = simpleEmbed('user authentication login password');
    const b = simpleEmbed('login authentication for users');
    const c = simpleEmbed('css flexbox layout grid');
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });
});
