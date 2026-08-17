/**
 * Indexing package — discovery, chunking, and search abstractions.
 */

export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  '.tmp',
  '.env',
  '.env.*',
  '*.min.js',
  '*.map',
  'release',
  '.next',
  '.nuxt',
  '__pycache__',
  'venv',
  '.venv',
  'target',
  'bin',
  'obj',
  'dist-electron',
] as const;

export interface IndexChunk {
  id: string;
  file: string;
  path: string;
  language: string;
  symbol?: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding?: number[];
}

export interface SearchResult {
  chunk: IndexChunk;
  score: number;
  matchType: 'lexical' | 'semantic' | 'filename';
}

export interface IndexingProgress {
  phase: 'discover' | 'parse' | 'chunk' | 'embed' | 'store' | 'done' | 'error';
  filesProcessed: number;
  filesTotal: number;
  message?: string;
}

export { chunkFile, simpleEmbed, cosine } from './chunker';
