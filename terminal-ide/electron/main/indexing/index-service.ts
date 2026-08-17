import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import {
  DEFAULT_IGNORE_PATTERNS,
  chunkFile,
  simpleEmbed,
  cosine,
  type IndexChunk,
  type IndexingProgress,
  type SearchResult,
} from '../../../packages/indexing/src/index.js';

const TEXT_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.yml',
  '.yaml',
  '.toml',
  '.sql',
  '.sh',
  '.bash',
  '.ps1',
  '.php',
  '.rb',
  '.swift',
  '.kt',
  '.txt',
]);

function languageFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.md': 'markdown',
    '.json': 'json',
    '.css': 'css',
    '.html': 'html',
  };
  return map[ext] ?? 'plaintext';
}

/**
 * In-memory + disk-persisted code index for lexical and local semantic search.
 */
export class IndexService {
  private chunks: IndexChunk[] = [];
  private root: string | null = null;
  private running = false;
  private abort = false;
  private lastProgress: IndexingProgress | null = null;

  constructor(private getWindow: () => BrowserWindow | null) {}

  private emit(progress: IndexingProgress): void {
    this.lastProgress = progress;
    this.getWindow()?.webContents.send(IpcChannels.EVENT_INDEX_PROGRESS, progress);
  }

  getStatus(): {
    root: string | null;
    chunkCount: number;
    running: boolean;
    progress: IndexingProgress | null;
  } {
    return {
      root: this.root,
      chunkCount: this.chunks.length,
      running: this.running,
      progress: this.lastProgress,
    };
  }

  stop(): void {
    this.abort = true;
  }

  async start(rootPath: string): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.abort = false;
    this.root = path.resolve(rootPath);
    this.chunks = [];

    try {
      this.emit({ phase: 'discover', filesProcessed: 0, filesTotal: 0, message: 'Discovering files…' });
      const files = await this.discover(this.root);
      if (this.abort) {
        this.running = false;
        return;
      }

      this.emit({
        phase: 'chunk',
        filesProcessed: 0,
        filesTotal: files.length,
        message: `Indexing ${files.length} files…`,
      });

      let processed = 0;
      for (const file of files) {
        if (this.abort) break;
        try {
          const content = await fs.readFile(file, 'utf-8');
          if (content.includes('\0')) {
            processed += 1;
            continue;
          }
          const ext = path.extname(file).toLowerCase();
          const language = languageFromExt(ext);
          const parts = chunkFile({ path: file, content, language });
          for (const c of parts) {
            c.embedding = simpleEmbed(`${c.file} ${c.content}`);
            this.chunks.push(c);
          }
        } catch {
          // skip unreadable
        }
        processed += 1;
        if (processed % 25 === 0 || processed === files.length) {
          this.emit({
            phase: 'chunk',
            filesProcessed: processed,
            filesTotal: files.length,
            message: `${processed}/${files.length} files`,
          });
        }
      }

      this.emit({
        phase: 'done',
        filesProcessed: processed,
        filesTotal: files.length,
        message: `Indexed ${this.chunks.length} chunks from ${processed} files`,
      });
    } catch (err) {
      this.emit({
        phase: 'error',
        filesProcessed: 0,
        filesTotal: 0,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.running = false;
    }
  }

  private async discover(dir: string, depth = 0): Promise<string[]> {
    if (depth > 14) return [];
    const out: string[] = [];
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return out;
    }

    for (const e of entries) {
      if (this.abort) break;
      if (e.name.startsWith('.') && e.name !== '.env.example') {
        if (e.name === '.git') continue;
      }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if ((DEFAULT_IGNORE_PATTERNS as readonly string[]).includes(e.name)) continue;
        out.push(...(await this.discover(full, depth + 1)));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!TEXT_EXTS.has(ext) && e.name !== 'Dockerfile' && e.name !== 'Makefile') continue;
        try {
          const st = await fs.stat(full);
          if (st.size > 512_000) continue;
        } catch {
          continue;
        }
        out.push(full);
      }
    }
    return out;
  }

  /**
   * Strict content-only search over the index: only lines that literally contain
   * the full query string. No filename-only or partial-token false positives.
   */
  searchLexical(query: string, limit = 80, caseSensitive = false): SearchResult[] {
    const qRaw = query.trim();
    if (!qRaw) return [];
    const q = caseSensitive ? qRaw : qRaw.toLowerCase();
    const results: SearchResult[] = [];
    const seen = new Set<string>(); // path:line

    for (const chunk of this.chunks) {
      const lines = chunk.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= limit) break;
        const line = lines[i] ?? '';
        const hay = caseSensitive ? line : line.toLowerCase();
        if (!hay.includes(q)) continue;

        const lineNo = chunk.startLine + i;
        const key = `${chunk.path}:${lineNo}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const col = hay.indexOf(q) + 1;
        results.push({
          chunk: {
            ...chunk,
            id: `${chunk.path}#L${lineNo}`,
            startLine: lineNo,
            endLine: lineNo,
            content: line.trimEnd(),
            // stash column in symbol for UI (optional)
            symbol: String(col),
          },
          score: 100,
          matchType: 'lexical',
        });
      }
      if (results.length >= limit) break;
    }

    results.sort((a, b) => {
      if (a.chunk.path !== b.chunk.path) {
        return a.chunk.path.localeCompare(b.chunk.path);
      }
      return a.chunk.startLine - b.chunk.startLine;
    });
    return results.slice(0, limit);
  }

  /**
   * Live line-by-line grep on disk. Only returns lines that contain the full query.
   */
  async liveGrep(
    query: string,
    limit = 200,
    caseSensitive = false,
  ): Promise<SearchResult[]> {
    const qRaw = query.trim();
    if (!qRaw || !this.root) return [];
    const q = caseSensitive ? qRaw : qRaw.toLowerCase();
    const files = await this.discover(this.root);
    const results: SearchResult[] = [];

    for (const file of files) {
      if (results.length >= limit) break;
      try {
        const content = await fs.readFile(file, 'utf-8');
        if (content.includes('\0')) continue;
        const lines = content.split(/\r?\n/);
        const fileName = path.basename(file);
        const ext = path.extname(file).toLowerCase();
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= limit) break;
          const line = lines[i] ?? '';
          const hay = caseSensitive ? line : line.toLowerCase();
          if (!hay.includes(q)) continue;
          const col = hay.indexOf(q) + 1;
          results.push({
            chunk: {
              id: `${file}#L${i + 1}`,
              file: fileName,
              path: file,
              language: languageFromExt(ext),
              startLine: i + 1,
              endLine: i + 1,
              content: line.trimEnd(),
              symbol: String(col),
            },
            score: 100,
            matchType: 'lexical',
          });
        }
      } catch {
        // skip unreadable
      }
    }
    return results;
  }

  /**
   * Workspace text search: always prefer live disk grep for accuracy.
   * Semantic mode uses the index (opt-in only).
   */
  async searchAsync(
    query: string,
    limit = 80,
    rootPath?: string | null,
    opts?: { semantic?: boolean; caseSensitive?: boolean },
  ): Promise<SearchResult[]> {
    if (rootPath) {
      this.root = path.resolve(rootPath);
    }
    const caseSensitive = opts?.caseSensitive ?? false;

    // Semantic is opt-in only — never mix into normal text search
    if (opts?.semantic) {
      if (this.chunks.length === 0 && this.root) {
        // Fall back to live grep if index empty
        return this.liveGrep(query, limit, caseSensitive);
      }
      return this.searchSemantic(query, limit);
    }

    // Always live-grep for text search so results match real file contents
    if (this.root) {
      return this.liveGrep(query, limit, caseSensitive);
    }
    // Last resort: strict lexical on whatever is indexed
    return this.searchLexical(query, limit, caseSensitive);
  }

  searchSemantic(query: string, limit = 20): SearchResult[] {
    const qEmb = simpleEmbed(query);
    const results: SearchResult[] = [];
    for (const chunk of this.chunks) {
      const emb = chunk.embedding ?? simpleEmbed(chunk.content);
      const score = cosine(qEmb, emb) * 100;
      // Higher threshold to reduce noisy false positives
      if (score > 35) {
        // Only include if at least one query token appears in content
        const tokens = query
          .toLowerCase()
          .split(/[^a-z0-9_]+/)
          .filter((t) => t.length > 2);
        const content = chunk.content.toLowerCase();
        const hasToken =
          tokens.length === 0 || tokens.some((t) => content.includes(t));
        if (!hasToken) continue;
        results.push({ chunk, score, matchType: 'semantic' });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /** @deprecated Prefer searchAsync — kept for callers that expect hybrid */
  search(query: string, limit = 30): SearchResult[] {
    return this.searchLexical(query, limit, false);
  }
}
