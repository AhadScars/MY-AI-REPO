import type { SupportedLanguage } from '../../types/src/editor';

const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascriptreact',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'typescriptreact',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.json': 'json',
  '.jsonc': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.toml': 'plaintext',
  '.xml': 'html',
  '.svg': 'html',
  '.txt': 'plaintext',
  '.log': 'plaintext',
  '.env': 'plaintext',
};

/** Map app language IDs to Monaco language IDs. */
const MONACO_LANGUAGE_MAP: Record<SupportedLanguage, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  typescriptreact: 'typescript',
  javascriptreact: 'javascript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  php: 'php',
  html: 'html',
  css: 'css',
  scss: 'scss',
  json: 'json',
  yaml: 'yaml',
  markdown: 'markdown',
  sql: 'sql',
  shell: 'shell',
  powershell: 'powershell',
  plaintext: 'plaintext',
};

export function languageFromPath(filePath: string): SupportedLanguage {
  const lower = filePath.toLowerCase();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot < 0) {
    const base = lower.split(/[/\\]/).pop() ?? '';
    if (base === 'dockerfile') return 'shell';
    if (base === 'makefile') return 'shell';
    return 'plaintext';
  }
  const ext = lower.slice(lastDot);
  return EXTENSION_MAP[ext] ?? 'plaintext';
}

export function toMonacoLanguage(language: string): string {
  return MONACO_LANGUAGE_MAP[language as SupportedLanguage] ?? language ?? 'plaintext';
}

export function isTextFile(filePath: string): boolean {
  const lang = languageFromPath(filePath);
  if (lang !== 'plaintext') return true;
  return /\.(txt|log|env|gitignore|dockerignore|editorconfig|toml|lock|cfg|ini|conf)$/i.test(
    filePath,
  );
}
