/**
 * Cross-platform path helpers that work in both main and renderer.
 * Avoid depending on node:path in the renderer.
 */

export function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

export function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return normalized;
  // Handle Windows drive roots like C:/
  if (lastSlash === 2 && normalized[1] === ':') {
    return normalized.slice(0, 3);
  }
  return normalized.slice(0, lastSlash);
}

export function extname(filePath: string): string {
  const name = basename(filePath);
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot);
}

export function joinPath(...parts: string[]): string {
  if (parts.length === 0) return '';
  const first = parts[0] ?? '';
  const isWindows = /^[A-Za-z]:/.test(first) || first.startsWith('\\\\');
  const sep = isWindows ? '\\' : '/';

  const cleaned = parts
    .filter((p) => p.length > 0)
    .map((p, i) => {
      let s = p.replace(/\\/g, '/');
      if (i > 0) s = s.replace(/^\/+/, '');
      s = s.replace(/\/+$/, '');
      return s;
    });

  let result = cleaned.join('/');
  if (isWindows) {
    result = result.replace(/\//g, sep);
  }
  return result;
}

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
