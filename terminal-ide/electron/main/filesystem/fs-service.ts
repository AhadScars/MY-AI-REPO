import fs from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type {
  CopyRequest,
  CreateDirRequest,
  CreateFileRequest,
  DeleteRequest,
  FileEntry,
  FileStat,
  ReadDirRequest,
  ReadFileRequest,
  ReadFileResult,
  RenameRequest,
  WriteFileRequest,
} from '../../../packages/protocol/src/ipc-channels.js';

/**
 * Secure filesystem service for the main process.
 * Validates paths and never executes shell strings from user input.
 */
export class FileSystemService {
  async readDir(request: ReadDirRequest): Promise<FileEntry[]> {
    const dirPath = path.resolve(request.path);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const includeHidden = request.includeHidden ?? false;

    const result: FileEntry[] = [];
    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);
      let size: number | undefined;
      let mtimeMs: number | undefined;

      try {
        const stat = await fs.stat(fullPath);
        size = stat.size;
        mtimeMs = stat.mtimeMs;
      } catch {
        // Skip unreadable entries
        continue;
      }

      result.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        isSymbolicLink: entry.isSymbolicLink(),
        size,
        mtimeMs,
        extension: entry.isFile() ? path.extname(entry.name) : undefined,
      });
    }

    // Directories first, then alphabetical
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return result;
  }

  async readFile(request: ReadFileRequest): Promise<ReadFileResult> {
    const filePath = path.resolve(request.path);
    const encoding = request.encoding ?? 'utf-8';
    const content = await fs.readFile(filePath, { encoding });
    const stat = await fs.stat(filePath);
    return {
      content,
      encoding,
      size: stat.size,
    };
  }

  async writeFile(request: WriteFileRequest): Promise<void> {
    const filePath = path.resolve(request.path);
    const encoding = request.encoding ?? 'utf-8';
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, request.content, encoding);
  }

  async createFile(request: CreateFileRequest): Promise<void> {
    const filePath = path.resolve(request.path);
    // Fail if exists — do not overwrite silently
    try {
      await fs.access(filePath);
      throw new Error(`File already exists: ${filePath}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, request.content ?? '', 'utf-8');
  }

  async createDir(request: CreateDirRequest): Promise<void> {
    const dirPath = path.resolve(request.path);
    await fs.mkdir(dirPath, { recursive: request.recursive ?? true });
  }

  async delete(request: DeleteRequest): Promise<void> {
    const target = path.resolve(request.path);
    // Safety: never allow deleting drive roots
    if (this.isRootPath(target)) {
      throw new Error('Refusing to delete filesystem root');
    }
    await fs.rm(target, { recursive: request.recursive ?? false, force: false });
  }

  async rename(request: RenameRequest): Promise<void> {
    const oldPath = path.resolve(request.oldPath);
    const newPath = path.resolve(request.newPath);
    await fs.rename(oldPath, newPath);
  }

  async copy(request: CopyRequest): Promise<void> {
    const source = path.resolve(request.source);
    const destination = path.resolve(request.destination);
    await fs.cp(source, destination, { recursive: true, errorOnExist: true, force: false });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(path.resolve(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async stat(filePath: string): Promise<FileStat> {
    const resolved = path.resolve(filePath);
    const s = await fs.stat(resolved);
    return {
      path: resolved,
      isDirectory: s.isDirectory(),
      isFile: s.isFile(),
      isSymbolicLink: s.isSymbolicLink(),
      size: s.size,
      mtimeMs: s.mtimeMs,
      ctimeMs: s.ctimeMs,
      birthtimeMs: s.birthtimeMs,
    };
  }

  async revealInOs(filePath: string): Promise<void> {
    shell.showItemInFolder(path.resolve(filePath));
  }

  private isRootPath(p: string): boolean {
    const normalized = path.resolve(p);
    // Unix root
    if (normalized === path.sep) return true;
    // Windows drive roots: C:\ or C:/
    if (/^[A-Za-z]:[/\\]?$/.test(normalized)) return true;
    return false;
  }
}
