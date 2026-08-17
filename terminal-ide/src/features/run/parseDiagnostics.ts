import type { EditorDiagnostic } from '../../../packages/types/src/editor';
import { basename, normalizePath } from '../../../packages/shared/src/path';
import { stripAnsi } from './ansi';

export { stripAnsi };

/**
 * Parse compiler/runtime stderr into editor diagnostics (line + message).
 * Supports Java (javac), Python, Node/TS, gcc/g++, Go, Rust, and generic file:line patterns.
 */
export function parseDiagnosticsFromOutput(
  output: string,
  primaryFilePath?: string | null,
  source: string = 'run',
): EditorDiagnostic[] {
  const cleaned = stripAnsi(output);
  const lines = cleaned.split(/\r?\n/);
  const found: EditorDiagnostic[] = [];
  const primaryBase = primaryFilePath ? basename(primaryFilePath) : null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Java: File.java:12: error: message
    let m = line.match(
      /^(.+?\.(?:java|kt|scala)):(\d+)(?::(\d+))?:\s*(error|warning|Error|Warning):\s*(.+)$/,
    );
    if (m) {
      found.push(
        makeDiag(
          m[1]!,
          Number(m[2]),
          m[3] ? Number(m[3]) : 1,
          m[5]!,
          m[4]!,
          primaryFilePath,
          primaryBase,
          source,
        ),
      );
      continue;
    }

    // Maven / javac: [ERROR] path/File.java:[12,5] cannot find symbol
    m = line.match(
      /^\[(?:ERROR|WARNING|error|warning)\]\s+(.+?\.(?:java|kt|scala)):\[(\d+),(\d+)\]\s*(.+)$/,
    );
    if (m) {
      const sev = /warn/i.test(line) ? 'warning' : 'error';
      found.push(
        makeDiag(
          m[1]!,
          Number(m[2]),
          Number(m[3]),
          m[4]!,
          sev,
          primaryFilePath,
          primaryBase,
          source,
        ),
      );
      continue;
    }

    // Python traceback: File "path", line N
    m = line.match(/^\s*File\s+"([^"]+)",\s+line\s+(\d+)/);
    if (m) {
      let message = 'Error';
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const nl = lines[j] ?? '';
        const err = nl.match(/^([A-Za-z_][\w.]*(?:Error|Exception|Warning)):\s*(.*)$/);
        if (err) {
          message = `${err[1]}: ${err[2]}`;
          break;
        }
      }
      found.push(
        makeDiag(m[1]!, Number(m[2]), 1, message, 'error', primaryFilePath, primaryBase, source),
      );
      continue;
    }

    // Generic: path:line: message  OR path:line:col: message
    m = line.match(
      /^(.+?\.(?:py|pyw|js|mjs|cjs|ts|tsx|jsx|go|rs|c|cpp|cc|h|hpp|java)):(\d+)(?::(\d+))?:\s*(.*)$/,
    );
    if (m && m[4] && !m[4].startsWith('//')) {
      const msg = m[4].trim();
      if (msg.length > 0 && !/^\d+$/.test(msg)) {
        const severity = /warn/i.test(msg) ? 'warning' : 'error';
        found.push(
          makeDiag(
            m[1]!,
            Number(m[2]),
            m[3] ? Number(m[3]) : 1,
            msg,
            severity,
            primaryFilePath,
            primaryBase,
            source,
          ),
        );
        continue;
      }
    }

    // Node style: path:line
    m = line.match(/^(.+?\.(?:js|mjs|cjs|ts|tsx)):(\d+)(?::(\d+))?$/);
    if (m) {
      let message = 'Runtime error';
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const nl = lines[j] ?? '';
        const err = nl.match(/^([A-Za-z]*Error):\s*(.*)$/);
        if (err) {
          message = `${err[1]}: ${err[2]}`;
          break;
        }
      }
      found.push(
        makeDiag(
          m[1]!,
          Number(m[2]),
          m[3] ? Number(m[3]) : 1,
          message,
          'error',
          primaryFilePath,
          primaryBase,
          source,
        ),
      );
      continue;
    }

    // gcc/clang: file:line:col: error: msg
    m = line.match(
      /^(.+?):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.+)$/i,
    );
    if (m) {
      const sev = /warn/i.test(m[4]!) ? 'warning' : /note/i.test(m[4]!) ? 'info' : 'error';
      found.push(
        makeDiag(
          m[1]!,
          Number(m[2]),
          Number(m[3]),
          m[5]!,
          sev,
          primaryFilePath,
          primaryBase,
          source,
        ),
      );
      continue;
    }

    // Go: file:line:col: message
    m = line.match(/^(.+\.go):(\d+):(\d+):\s*(.+)$/);
    if (m) {
      found.push(
        makeDiag(
          m[1]!,
          Number(m[2]),
          Number(m[3]),
          m[4]!,
          'error',
          primaryFilePath,
          primaryBase,
          source,
        ),
      );
      continue;
    }

    // Rust: --> path:line:col
    m = line.match(/^\s*-->\s+(.+):(\d+):(\d+)\s*$/);
    if (m) {
      let message = 'error';
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prev = lines[j] ?? '';
        const err = prev.match(/^error(?:\[E\d+\])?:\s*(.+)$/);
        if (err) {
          message = err[1]!;
          break;
        }
      }
      found.push(
        makeDiag(
          m[1]!,
          Number(m[2]),
          Number(m[3]),
          message,
          'error',
          primaryFilePath,
          primaryBase,
          source,
        ),
      );
    }
  }

  // Deduplicate by path+line+message
  const seen = new Set<string>();
  const unique: EditorDiagnostic[] = [];
  for (const d of found) {
    const key = `${d.path}|${d.line}|${d.column}|${d.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(d);
  }
  return unique;
}

function makeDiag(
  rawPath: string,
  line: number,
  column: number,
  message: string,
  severityRaw: string,
  primaryFilePath: string | null | undefined,
  primaryBase: string | null,
  source: string,
): EditorDiagnostic {
  let filePath = rawPath.trim().replace(/^["']|["']$/g, '');
  // Map basename-only errors onto the file that was just run
  if (primaryFilePath && primaryBase) {
    const base = basename(filePath);
    if (base.toLowerCase() === primaryBase.toLowerCase()) {
      filePath = primaryFilePath;
    }
  }

  const severity: EditorDiagnostic['severity'] = /warn/i.test(severityRaw)
    ? 'warning'
    : /info|note|hint/i.test(severityRaw)
      ? 'info'
      : 'error';

  return {
    path: filePath,
    line: Math.max(1, line),
    column: Math.max(1, column),
    severity,
    message: message.trim(),
    source,
  };
}

/** Resolve whether a diagnostic applies to an open editor path. */
export function diagnosticMatchesPath(diagPath: string, editorPath: string): boolean {
  const a = normalizePath(diagPath).toLowerCase();
  const b = normalizePath(editorPath).toLowerCase();
  if (a === b) return true;
  if (b.endsWith('/' + a) || b.endsWith('\\' + a.replace(/\//g, '\\'))) return true;
  if (basename(a) === basename(b) && !a.includes('/') && !a.includes('\\')) return true;
  // Windows drive-insensitive suffix match
  if (b.endsWith(a.replace(/^\.\//, '')) || a.endsWith(b.replace(/^\.\//, ''))) return true;
  return basename(a).toLowerCase() === basename(b).toLowerCase();
}
