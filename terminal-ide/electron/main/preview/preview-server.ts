/**
 * Lightweight static file server for built-in HTML/CSS/JS preview.
 * Serves only under a single root directory (workspace or file parent).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
};

function safeJoin(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const rel = decoded.replace(/^\/+/, '').replace(/\\/g, '/');
  if (rel.includes('..')) return null;
  const full = path.normalize(path.join(root, rel));
  const rootNorm = path.normalize(root);
  if (full !== rootNorm && !full.startsWith(rootNorm + path.sep)) return null;
  return full;
}

export class PreviewServer {
  private server: http.Server | null = null;
  private root: string | null = null;
  private port = 0;

  isRunning(): boolean {
    return this.server != null && this.port > 0;
  }

  getPort(): number {
    return this.port;
  }

  getRoot(): string | null {
    return this.root;
  }

  async start(rootPath: string): Promise<{ port: number; root: string }> {
    const root = path.resolve(rootPath);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      throw new Error(`Preview root not found: ${root}`);
    }

    // Reuse if same root
    if (this.server && this.root === root && this.port > 0) {
      return { port: this.port, root };
    }

    await this.stop();

    this.root = root;
    this.server = http.createServer((req, res) => {
      try {
        const url = req.url ?? '/';
        let filePath = safeJoin(root, url === '/' ? '/index.html' : url);
        if (!filePath) {
          res.writeHead(403).end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          const index = path.join(filePath, 'index.html');
          if (fs.existsSync(index)) filePath = index;
          else {
            res.writeHead(404).end('Not found');
            return;
          }
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.writeHead(404).end('Not found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const type = MIME[ext] ?? 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          // Allow embedding in Terminal-IDE iframe (file:// or localhost app origin)
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500).end(err instanceof Error ? err.message : 'Server error');
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          resolve();
        } else {
          reject(new Error('Failed to bind preview server'));
        }
      });
    });

    return { port: this.port, root };
  }

  async stop(): Promise<void> {
    if (!this.server) {
      this.root = null;
      this.port = 0;
      return;
    }
    const srv = this.server;
    this.server = null;
    this.root = null;
    this.port = 0;
    await new Promise<void>((resolve) => {
      srv.close(() => resolve());
    });
  }

  /**
   * Resolve a file path under root into a preview URL.
   */
  urlForFile(filePath: string): string {
    if (!this.root || !this.port) {
      throw new Error('Preview server is not running');
    }
    const abs = path.resolve(filePath);
    const root = this.root;
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('File is outside preview root');
    }
    return `http://127.0.0.1:${this.port}/${rel.split('/').map(encodeURIComponent).join('/')}`;
  }

  /** file:// fallback helper (not preferred for multi-file sites) */
  static fileUrl(filePath: string): string {
    return pathToFileURL(path.resolve(filePath)).href;
  }
}
