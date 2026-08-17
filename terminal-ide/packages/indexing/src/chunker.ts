import type { IndexChunk } from './index';

const CHUNK_LINES = 80;
const OVERLAP = 10;

/**
 * Split file content into overlapping line-based chunks for search.
 */
export function chunkFile(opts: {
  path: string;
  content: string;
  language: string;
}): IndexChunk[] {
  const lines = opts.content.split(/\r?\n/);
  if (lines.length === 0) return [];

  const fileName = opts.path.split(/[/\\]/).pop() ?? opts.path;
  const chunks: IndexChunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < lines.length) {
    const end = Math.min(start + CHUNK_LINES, lines.length);
    const slice = lines.slice(start, end);
    const content = slice.join('\n');
    if (content.trim().length > 0) {
      chunks.push({
        id: `${opts.path}#${idx}`,
        file: fileName,
        path: opts.path,
        language: opts.language,
        startLine: start + 1,
        endLine: end,
        content,
      });
      idx += 1;
    }
    if (end >= lines.length) break;
    start = end - OVERLAP;
  }

  return chunks;
}

/** Very small bag-of-words embedding for local semantic-ish search. */
export function simpleEmbed(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length > 1);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const i = Math.abs(h) % dims;
    vec[i] = (vec[i] ?? 0) + 1;
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}
