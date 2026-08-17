/**
 * VS Code-style Go to Definition (Ctrl/Cmd+click, F12).
 * Searches open tabs + workspace files for symbol definitions and import paths.
 */
import type * as Monaco from 'monaco-editor';
import { requireApi } from '../../services/platform';
import { useEditorStore } from '../../stores/editorStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useDiagnosticsStore } from '../../stores/diagnosticsStore';
import { basename, dirname } from '../../../packages/shared/src/path';

export interface SymbolLocation {
  path: string;
  line: number;
  column: number;
  preview?: string;
}

let registered = false;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isIdent(s: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(s);
}

/** Definition-like lines for common languages */
function definitionPatterns(symbol: string): RegExp[] {
  const s = escapeRegExp(symbol);
  return [
    new RegExp(`\\b(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\*?\\s+${s}\\b`),
    new RegExp(`\\b(?:export\\s+)?(?:default\\s+)?class\\s+${s}\\b`),
    new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+${s}\\b`),
    new RegExp(`\\b(?:export\\s+)?(?:type|interface|enum|namespace)\\s+${s}\\b`),
    new RegExp(`\\b(?:export\\s+)?(?:abstract\\s+)?class\\s+${s}\\b`),
    new RegExp(`\\bdef\\s+${s}\\s*[(:]`),
    new RegExp(`\\bclass\\s+${s}\\s*[(:]`),
    new RegExp(`\\basync\\s+def\\s+${s}\\s*\\(`),
    new RegExp(`\\bfn\\s+${s}\\s*[<(]`),
    new RegExp(`\\b(?:pub\\s+)?(?:async\\s+)?fn\\s+${s}\\b`),
    new RegExp(`\\bfunc\\s+(?:\\([^)]*\\)\\s*)?${s}\\s*\\(`),
    new RegExp(`\\b${s}\\s*[:=]\\s*(?:async\\s+)?(?:function\\b|\\(|=>)`),
    new RegExp(`\\b${s}\\s*\\([^)]*\\)\\s*\\{`), // method-ish
  ];
}

export function findDefinitionsInText(
  text: string,
  symbol: string,
): Array<{ line: number; column: number; preview: string }> {
  if (!isIdent(symbol) || symbol.length < 1) return [];
  const lines = text.split(/\r?\n/);
  const patterns = definitionPatterns(symbol);
  const hits: Array<{ line: number; column: number; preview: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i] ?? '';
    // Skip pure comments / imports usage lines for weak patterns
    const trimmed = lineText.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;

    for (const re of patterns) {
      re.lastIndex = 0;
      const m = re.exec(lineText);
      if (m && m.index !== undefined) {
        // Prefer column at the symbol itself
        const symIdx = lineText.indexOf(symbol, m.index);
        const column = (symIdx >= 0 ? symIdx : m.index) + 1;
        hits.push({
          line: i + 1,
          column,
          preview: trimmed.slice(0, 120),
        });
        break;
      }
    }
  }
  return hits;
}

/** Resolve relative import/require path near cursor */
function tryResolveImportPath(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  currentFilePath: string,
): string | null {
  const line = model.getLineContent(position.lineNumber);
  // Match string under cursor
  const strRe = /(['"])([^'"]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = strRe.exec(line)) !== null) {
    const start = m.index + 1;
    const end = start + m[2]!.length;
    const col = position.column;
    if (col >= start + 1 && col <= end + 1) {
      const spec = m[2]!;
      if (spec.startsWith('.') || spec.startsWith('/') || /^[A-Za-z]:/.test(spec)) {
        return resolveModulePath(currentFilePath, spec);
      }
      // bare module — skip node_modules resolution for now
      return null;
    }
  }
  return null;
}

function resolveModulePath(fromFile: string, spec: string): string {
  if (spec.startsWith('/') || /^[A-Za-z]:[\\/]/.test(spec)) {
    return spec.replace(/\//g, fromFile.includes('\\') ? '\\' : '/');
  }
  // Resolve ./ and ../ relative to the current file's directory
  const isWin = /^[A-Za-z]:/.test(fromFile) || fromFile.includes('\\');
  const sep = isWin ? '\\' : '/';
  const dir = dirname(fromFile);
  const start = dir.replace(/\\/g, '/').split('/').filter((p, i) => p.length > 0 || i === 0);
  // Keep Windows drive segment
  const parts =
    isWin && /^[A-Za-z]:$/.test(start[0] ?? '')
      ? [...start]
      : dir.replace(/\\/g, '/').split('/').filter(Boolean);

  if (isWin && /^[A-Za-z]:$/.test(parts[0] ?? '') === false && /^[A-Za-z]:/.test(fromFile)) {
    parts.unshift(fromFile.slice(0, 2));
  }

  for (const seg of spec.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length > 1) parts.pop();
      continue;
    }
    parts.push(seg);
  }

  if (isWin) {
    const drive = parts[0]?.endsWith(':') ? parts.shift()! : fromFile.slice(0, 2);
    return `${drive}${sep}${parts.join(sep)}`;
  }
  return `/${parts.join('/')}`;
}

const EXT_CANDIDATES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.cs',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
];

async function resolveExistingFile(base: string): Promise<string | null> {
  const api = requireApi();
  for (const ext of EXT_CANDIDATES) {
    const candidate = base + ext;
    try {
      if (await api.exists({ path: candidate })) {
        const st = await api.stat({ path: candidate });
        if (st.isFile) return candidate;
      }
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * Find definition locations for a symbol (open tabs first, then workspace files).
 */
export async function findDefinitions(
  symbol: string,
  currentPath: string,
  currentText?: string,
): Promise<SymbolLocation[]> {
  if (!isIdent(symbol)) return [];

  const results: SymbolLocation[] = [];
  const seen = new Set<string>();

  const addHits = (filePath: string, text: string) => {
    for (const hit of findDefinitionsInText(text, symbol)) {
      const key = `${filePath}:${hit.line}:${hit.column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        path: filePath,
        line: hit.line,
        column: hit.column,
        preview: hit.preview,
      });
    }
  };

  // 1) Current file
  if (currentText != null) {
    addHits(currentPath, currentText);
  }

  // 2) Other open tabs
  const tabs = useEditorStore.getState().tabs;
  for (const tab of tabs) {
    if (tab.path === currentPath) continue;
    if (tab.path.startsWith('untitled:')) continue;
    addHits(tab.path, tab.content);
    if (results.length >= 20) return results;
  }

  // 3) Workspace files (name match first, then content sample)
  const ws = useWorkspaceStore.getState();
  if (!ws.rootPath) return results;

  if (ws.fileIndex.length === 0 && !ws.fileIndexLoading) {
    void ws.buildFileIndex();
  }

  const lower = symbol.toLowerCase();
  const index = ws.fileIndex;
  const candidates: string[] = [];

  for (const p of index) {
    const name = basename(p).toLowerCase();
    if (name.includes(lower) || name.replace(/\.\w+$/, '') === lower) {
      candidates.push(p);
    }
  }
  // Also scan a slice of the index for content (capped)
  for (const p of index) {
    if (candidates.length >= 40) break;
    if (!candidates.includes(p)) {
      // prefer source extensions
      if (/\.(ts|tsx|js|jsx|py|go|rs|java|cs|cpp|h|php)$/i.test(p)) {
        candidates.push(p);
      }
    }
  }

  const api = requireApi();
  let scanned = 0;
  for (const filePath of candidates) {
    if (results.length >= 25) break;
    if (tabs.some((t) => t.path === filePath)) continue;
    if (filePath === currentPath) continue;
    scanned += 1;
    if (scanned > 35) break;
    try {
      const { content } = await api.readFile({ path: filePath });
      if (content.includes(symbol)) {
        addHits(filePath, content);
      }
    } catch {
      // skip unreadable
    }
  }

  // Prefer current file definitions first, then same folder
  const curDir = dirname(currentPath).toLowerCase();
  results.sort((a, b) => {
    const aCur = a.path === currentPath ? 0 : 1;
    const bCur = b.path === currentPath ? 0 : 1;
    if (aCur !== bCur) return aCur - bCur;
    const aDir = dirname(a.path).toLowerCase() === curDir ? 0 : 1;
    const bDir = dirname(b.path).toLowerCase() === curDir ? 0 : 1;
    return aDir - bDir;
  });

  return results;
}

function pathKey(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/([A-Za-z]:)/, '$1').toLowerCase();
}

/**
 * Jump to a definition. If the file is already the active tab, only move the cursor
 * (do not re-open or flash the tab).
 */
export async function navigateToDefinition(loc: SymbolLocation): Promise<void> {
  const editor = useEditorStore.getState();
  const targetKey = pathKey(loc.path);
  const active = editor.getActiveTab();
  const existing = editor.tabs.find((t) => pathKey(t.path) === targetKey);

  if (existing) {
    // Already open — switch tab only if it's not the active one
    if (!active || pathKey(active.path) !== targetKey) {
      editor.setActiveTab(existing.id);
    }
  } else {
    // Not open — open once
    try {
      await editor.openFile(loc.path, false);
    } catch {
      return;
    }
  }

  const revealPath = existing?.path ?? loc.path;
  // Jump within the editor (same or newly opened tab)
  requestAnimationFrame(() => {
    useDiagnosticsStore.getState().requestReveal(revealPath, loc.line, loc.column);
  });
  setTimeout(() => {
    useDiagnosticsStore.getState().requestReveal(revealPath, loc.line, loc.column);
  }, 40);
}

/**
 * Resolve word/import under cursor and jump to best definition.
 */
export async function goToDefinitionAt(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  currentPath: string,
): Promise<boolean> {
  // Import / path string first
  const importPath = tryResolveImportPath(model, position, currentPath);
  if (importPath) {
    const resolved = await resolveExistingFile(importPath);
    if (resolved) {
      await navigateToDefinition({ path: resolved, line: 1, column: 1 });
      return true;
    }
  }

  const word = model.getWordAtPosition(position);
  if (!word || word.word.length < 2) return false;

  const locs = await findDefinitions(word.word, currentPath, model.getValue());
  if (locs.length === 0) return false;

  // If only reference is same line in current file, still jump to first def
  await navigateToDefinition(locs[0]!);
  return true;
}

/**
 * Register Monaco definition providers (F12 + Ctrl+click when multiCursorModifier is alt).
 */
export function registerGoToDefinitionProviders(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  const languages = [
    'typescript',
    'javascript',
    'python',
    'java',
    'csharp',
    'cpp',
    'c',
    'go',
    'rust',
    'php',
    'ruby',
    'kotlin',
    'swift',
    'json',
    'html',
    'css',
    'scss',
    'sql',
    'shell',
    'plaintext',
  ];

  // Passive provider only — NEVER navigate here (Monaco calls this on Ctrl+hover).
  // Actual jump is done only by Ctrl+click handler or F12 → goToDefinitionAt.
  const provider: Monaco.languages.DefinitionProvider = {
    provideDefinition: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word || word.word.length < 2) return null;

      const monacoLocs: Monaco.languages.Location[] = [];

      const pushHits = (m: Monaco.editor.ITextModel, hits: ReturnType<typeof findDefinitionsInText>) => {
        for (const hit of hits) {
          monacoLocs.push({
            uri: m.uri,
            range: {
              startLineNumber: hit.line,
              startColumn: hit.column,
              endLineNumber: hit.line,
              endColumn: hit.column + word.word.length,
            },
          });
        }
      };

      pushHits(model, findDefinitionsInText(model.getValue(), word.word));
      for (const m of monaco.editor.getModels()) {
        if (m === model) continue;
        pushHits(m, findDefinitionsInText(m.getValue(), word.word));
      }

      return monacoLocs.length > 0 ? monacoLocs : null;
    },
  };

  for (const lang of languages) {
    monaco.languages.registerDefinitionProvider(lang, provider);
  }
}

/**
 * Hold Ctrl/Cmd → underline + pointer; click → Go to Definition (VS Code-style).
 * multiCursorModifier should be 'alt' so Ctrl is free for navigation.
 */
export function attachCtrlClickGoToDefinition(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  getPath: () => string,
): Monaco.IDisposable {
  const disposables: Monaco.IDisposable[] = [];
  let deco: Monaco.editor.IEditorDecorationsCollection | null = null;
  let ctrlHeld = false;
  let pendingPos: Monaco.Position | null = null;

  const clearHover = () => {
    deco?.clear();
    try {
      const dom = editor.getDomNode();
      if (dom) dom.style.cursor = '';
    } catch {
      // ignore
    }
  };

  const showHover = (model: Monaco.editor.ITextModel, pos: Monaco.Position) => {
    const word = model.getWordAtPosition(pos);
    if (!word || word.word.length < 2) {
      clearHover();
      return;
    }
    if (!deco) {
      deco = editor.createDecorationsCollection();
    }
    deco.set([
      {
        range: {
          startLineNumber: pos.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: pos.lineNumber,
          endColumn: word.endColumn,
        },
        options: {
          inlineClassName: 'ide-goto-definition-hover',
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ]);
    try {
      const dom = editor.getDomNode();
      if (dom) dom.style.cursor = 'pointer';
    } catch {
      // ignore
    }
  };

  // Track Ctrl/Cmd held while editor focused
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      ctrlHeld = true;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      ctrlHeld = false;
      clearHover();
      pendingPos = null;
    }
  };
  const onBlur = () => {
    ctrlHeld = false;
    clearHover();
    pendingPos = null;
  };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);

  disposables.push({
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      clearHover();
      deco = null;
    },
  });

  disposables.push(
    editor.onMouseMove((e) => {
      const mod = e.event.ctrlKey || e.event.metaKey;
      ctrlHeld = mod;
      if (!mod || e.event.altKey) {
        clearHover();
        return;
      }
      const model = editor.getModel();
      const pos = e.target.position;
      if (
        !model ||
        !pos ||
        (e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT &&
          e.target.type !== monaco.editor.MouseTargetType.CONTENT_EMPTY)
      ) {
        clearHover();
        return;
      }
      showHover(model, pos);
    }),
  );

  // Click only (not hover): hold Ctrl, then click to jump
  disposables.push(
    editor.onMouseDown((e) => {
      const holdingMod = e.event.ctrlKey || e.event.metaKey || ctrlHeld;
      const isGoto = holdingMod && !e.event.altKey && e.event.leftButton;
      if (!isGoto) {
        pendingPos = null;
        return;
      }
      if (
        e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT &&
        e.target.type !== monaco.editor.MouseTargetType.CONTENT_EMPTY
      ) {
        pendingPos = null;
        return;
      }
      const pos = e.target.position;
      if (!pos) {
        pendingPos = null;
        return;
      }
      pendingPos = pos;

      // Prevent selection / multi-cursor; wait for mouseup to navigate
      e.event.preventDefault();
      e.event.stopPropagation();
    }),
  );

  disposables.push(
    editor.onMouseUp((e) => {
      if (!pendingPos) return;

      const holdingMod = e.event.ctrlKey || e.event.metaKey || ctrlHeld;
      const isGoto = holdingMod && !e.event.altKey;
      const pos = pendingPos;
      pendingPos = null;

      if (!isGoto) return;

      const model = editor.getModel();
      if (!model) return;

      // Prefer release position if still on text, else down position
      const upPos = e.target.position;
      const target =
        upPos &&
        (e.target.type === monaco.editor.MouseTargetType.CONTENT_TEXT ||
          e.target.type === monaco.editor.MouseTargetType.CONTENT_EMPTY)
          ? upPos
          : pos;

      e.event.preventDefault();
      e.event.stopPropagation();
      clearHover();

      // Navigate only on click — never on hover
      void goToDefinitionAt(model, target, getPath());
    }),
  );

  return {
    dispose: () => {
      for (const d of disposables) d.dispose();
      disposables.length = 0;
    },
  };
}
