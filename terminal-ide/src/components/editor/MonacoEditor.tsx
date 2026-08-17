import { useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useSettingsStore } from '../../stores/settingsStore';
import { toMonacoLanguage } from '../../../packages/shared/src/language';
import {
  registerMonacoThemes,
  THEME_DARK_ID,
  THEME_LIGHT_ID,
} from '../../features/editor/monacoThemes';
import { languageServiceManager } from '../../features/editor/languageService';
import { setupMonaco } from '../../features/editor/monacoSetup';
import { registerAiInlineCompletions } from '../../features/ai/autocompleteProvider';
import { registerSpringCompletions } from '../../features/editor/springCompletions';
import { useInlineAiStore } from '../../stores/inlineAiStore';
import { useDiagnosticsStore } from '../../stores/diagnosticsStore';
import { applyRunMarkers, clearRunMarkers } from '../../features/editor/applyMarkers';
import { diagnosticMatchesPath } from '../../features/run/parseDiagnostics';
import { onEditorCommand } from '../../features/editor/editorCommands';
import { applySearchHighlights } from '../../features/editor/applySearchHighlights';
import {
  attachCtrlClickGoToDefinition,
  goToDefinitionAt,
  registerGoToDefinitionProviders,
} from '../../features/editor/goToDefinition';
import { useEditorStore } from '../../stores/editorStore';
import { useSearchHighlightStore } from '../../stores/searchHighlightStore';

setupMonaco();

interface MonacoEditorProps {
  tabId: string;
  path: string;
  value: string;
  language: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}

function resolveEditorTheme(theme: string): string {
  if (theme === 'light') return THEME_LIGHT_ID;
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? THEME_LIGHT_ID
      : THEME_DARK_ID;
  }
  return THEME_DARK_ID;
}

export function MonacoEditor({
  tabId,
  path,
  value,
  language,
  onChange,
  onSave,
}: MonacoEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const pathRef = useRef(path);
  pathRef.current = path;
  const contentDispRef = useRef<{ dispose: () => void } | null>(null);
  const searchDecoRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const gotoDispRef = useRef<Monaco.IDisposable | null>(null);

  const editorSettings = useSettingsStore((s) => s.settings.editor);
  const theme = useSettingsStore((s) => s.settings.general.theme);
  const resolvedTheme = resolveEditorTheme(theme);
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics);
  const revealRequest = useDiagnosticsStore((s) => s.revealRequest);
  const searchQuery = useSearchHighlightStore((s) => s.query);
  const searchCase = useSearchHighlightStore((s) => s.caseSensitive);
  const searchActive = useSearchHighlightStore((s) => s.activeMatch);
  const searchToken = useSearchHighlightStore((s) => s.token);

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    registerMonacoThemes(monacoInstance);
    languageServiceManager.configureMonaco(monacoInstance);
    registerAiInlineCompletions(monacoInstance);
    registerSpringCompletions(monacoInstance);
    registerGoToDefinitionProviders(monacoInstance);
    monacoInstance.editor.setTheme(
      resolveEditorTheme(useSettingsStore.getState().settings.general.theme),
    );

    // Apply any existing run/terminal diagnostics when editor mounts
    const model = editor.getModel();
    if (model) {
      const diags = useDiagnosticsStore
        .getState()
        .diagnostics.filter((d) => diagnosticMatchesPath(d.path, pathRef.current));
      applyRunMarkers(monacoInstance, model, diags);
    }

    // Editing a line clears its red underline (problem fixed / code changed)
    contentDispRef.current?.dispose();
    contentDispRef.current = editor.onDidChangeModelContent((e) => {
      const filePath = pathRef.current;
      const store = useDiagnosticsStore.getState();
      if (store.forPath(filePath).length === 0) return;

      for (const change of e.changes) {
        // ''.split → [''] length 1 so single-line char edits get lineDelta 0
        const newLineCount = change.text.split(/\r\n|\r|\n/).length;
        store.applyEditToPath(filePath, {
          startLine: change.range.startLineNumber,
          endLine: change.range.endLineNumber,
          newLineCount,
        });
      }
    });

    // Ctrl/Cmd+click → Go to Definition (VS Code-style)
    gotoDispRef.current?.dispose();
    gotoDispRef.current = attachCtrlClickGoToDefinition(
      editor,
      monacoInstance,
      () => pathRef.current,
    );

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });

    // F12 — Go to Definition
    editor.addCommand(monacoInstance.KeyCode.F12, () => {
      const m = editor.getModel();
      const pos = editor.getPosition();
      if (!m || !pos) return;
      void goToDefinitionAt(m, pos, pathRef.current);
    });

    const runAction = (id: string) => {
      const action = editor.getAction(id);
      if (action) void action.run();
    };

    // ── Multi-cursor / multi-selection (VS Code style) ─────────────────
    // After multi-cursors are placed, normal typing inserts at EVERY cursor.
    // Ctrl+D — add next match (then type to edit all)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyD, () => {
      runAction('editor.action.addSelectionToNextFindMatch');
    });
    // Ctrl+Shift+L — select all occurrences
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyL,
      () => {
        runAction('editor.action.selectHighlights');
      },
    );
    // Shift+Alt+I — cursor at end of each selected line (type to append on every line)
    editor.addCommand(
      monacoInstance.KeyMod.Shift | monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyI,
      () => {
        runAction('editor.action.insertCursorAtEndOfEachLineSelected');
      },
    );
    // Ctrl+Alt+Right — collapse each selection to a cursor at its end (insert after selected text)
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.RightArrow,
      () => {
        const sels = editor.getSelections();
        if (!sels?.length) return;
        editor.setSelections(
          sels.map((s) => ({
            selectionStartLineNumber: s.endLineNumber,
            selectionStartColumn: s.endColumn,
            positionLineNumber: s.endLineNumber,
            positionColumn: s.endColumn,
          })),
        );
      },
    );
    // Ctrl+Alt+Left — collapse each selection to a cursor at its start (insert before selected text)
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.LeftArrow,
      () => {
        const sels = editor.getSelections();
        if (!sels?.length) return;
        editor.setSelections(
          sels.map((s) => ({
            selectionStartLineNumber: s.startLineNumber,
            selectionStartColumn: s.startColumn,
            positionLineNumber: s.startLineNumber,
            positionColumn: s.startColumn,
          })),
        );
      },
    );
    // Ctrl+Alt+Up / Down — add cursor above / below
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.UpArrow,
      () => {
        runAction('editor.action.insertCursorAbove');
      },
    );
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.DownArrow,
      () => {
        runAction('editor.action.insertCursorBelow');
      },
    );
    // Ctrl+Shift+Alt+Arrow — column (box) selection; type to insert on every line in the column
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd |
        monacoInstance.KeyMod.Shift |
        monacoInstance.KeyMod.Alt |
        monacoInstance.KeyCode.DownArrow,
      () => {
        runAction('cursorColumnSelectDown');
      },
    );
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd |
        monacoInstance.KeyMod.Shift |
        monacoInstance.KeyMod.Alt |
        monacoInstance.KeyCode.UpArrow,
      () => {
        runAction('cursorColumnSelectUp');
      },
    );
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd |
        monacoInstance.KeyMod.Shift |
        monacoInstance.KeyMod.Alt |
        monacoInstance.KeyCode.LeftArrow,
      () => {
        runAction('cursorColumnSelectLeft');
      },
    );
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd |
        monacoInstance.KeyMod.Shift |
        monacoInstance.KeyMod.Alt |
        monacoInstance.KeyCode.RightArrow,
      () => {
        runAction('cursorColumnSelectRight');
      },
    );
    // Escape — clear multi-cursors back to one
    editor.addCommand(monacoInstance.KeyCode.Escape, () => {
      const sels = editor.getSelections();
      if (sels && sels.length > 1) {
        editor.setSelection(sels[sels.length - 1]!);
      } else {
        runAction('closeFindWidget');
      }
    });

    // Ctrl+K — AI edit selection
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK, () => {
      const sel = editor.getSelection();
      const m = editor.getModel();
      if (!sel || !m) return;
      const code = m.getValueInRange(sel);
      if (!code.trim()) return;
      useInlineAiStore.getState().openWithSelection({
        code,
        path: m.uri.path.startsWith('/') ? m.uri.path : pathRef.current,
        language: m.getLanguageId(),
        selection: {
          startLine: sel.startLineNumber,
          startColumn: sel.startColumn,
          endLine: sel.endLineNumber,
          endColumn: sel.endColumn,
        },
      });
    });

    editor.focus();
  }, []);

  useEffect(() => {
    return () => {
      contentDispRef.current?.dispose();
      contentDispRef.current = null;
      gotoDispRef.current?.dispose();
      gotoDispRef.current = null;
    };
  }, []);

  useEffect(() => {
    monacoRef.current?.editor.setTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Sync run/terminal compile errors → red squiggles + hover message
  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!monaco || !model) return;

    const diags = diagnostics.filter((d) => diagnosticMatchesPath(d.path, path));
    if (diags.length === 0) {
      clearRunMarkers(monaco, model);
    } else {
      applyRunMarkers(monaco, model, diags);
    }
  }, [diagnostics, path, value]);

  // Jump to problem / search result line
  useEffect(() => {
    if (!revealRequest) return;
    if (!diagnosticMatchesPath(revealRequest.path, path)) return;

    const editor = editorRef.current;
    if (!editor) return;

    const line = Math.max(1, revealRequest.line);
    const column = Math.max(1, revealRequest.column);
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column });
    // Select the active search match on the line when possible
    const q = useSearchHighlightStore.getState().query.trim();
    const model = editor.getModel();
    if (q && model) {
      const lineText = model.getLineContent(line);
      const cs = useSearchHighlightStore.getState().caseSensitive;
      const idx = cs
        ? lineText.indexOf(q)
        : lineText.toLowerCase().indexOf(q.toLowerCase());
      if (idx >= 0) {
        editor.setSelection({
          startLineNumber: line,
          startColumn: idx + 1,
          endLineNumber: line,
          endColumn: idx + 1 + q.length,
        });
      }
    }
    editor.focus();
    useDiagnosticsStore.getState().clearReveal();
  }, [revealRequest, path]);

  // Highlight workspace search matches in this editor
  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!monaco || !editor || !model) return;

    searchDecoRef.current = applySearchHighlights(
      monaco,
      editor,
      model,
      searchQuery,
      searchCase,
      searchActive,
      path,
      searchDecoRef.current,
    );
  }, [searchQuery, searchCase, searchActive, searchToken, path, value, tabId]);

  useEffect(() => {
    return () => {
      searchDecoRef.current?.clear();
      searchDecoRef.current = null;
    };
  }, []);

  // Find / Replace from menu and global shortcuts (active tab only)
  useEffect(() => {
    return onEditorCommand((cmd) => {
      if (useEditorStore.getState().activeTabId !== tabId) return;
      const editor = editorRef.current;
      if (!editor) return;

      const run = (id: string) => {
        const action = editor.getAction(id);
        if (action) void action.run();
      };

      switch (cmd) {
        case 'find':
          run('actions.find');
          break;
        case 'replace':
          run('editor.action.startFindReplaceAction');
          break;
        case 'findNext':
          run('editor.action.nextMatchFindAction');
          break;
        case 'findPrevious':
          run('editor.action.previousMatchFindAction');
          break;
        case 'undo':
          editor.trigger('menu', 'undo', null);
          break;
        case 'redo':
          editor.trigger('menu', 'redo', null);
          break;
        case 'cut':
          run('editor.action.clipboardCutAction');
          break;
        case 'copy':
          run('editor.action.clipboardCopyAction');
          break;
        case 'paste':
          run('editor.action.clipboardPasteAction');
          break;
        case 'selectAll':
          run('editor.action.selectAll');
          break;
        case 'addNextOccurrence':
          run('editor.action.addSelectionToNextFindMatch');
          break;
        case 'selectAllOccurrences':
          run('editor.action.selectHighlights');
          break;
        case 'insertCursorAbove':
          run('editor.action.insertCursorAbove');
          break;
        case 'insertCursorBelow':
          run('editor.action.insertCursorBelow');
          break;
        case 'cursorsAtLineEnds':
          run('editor.action.insertCursorAtEndOfEachLineSelected');
          break;
        case 'collapseToEnd': {
          const sels = editor.getSelections();
          if (!sels?.length) break;
          editor.setSelections(
            sels.map((s) => ({
              selectionStartLineNumber: s.endLineNumber,
              selectionStartColumn: s.endColumn,
              positionLineNumber: s.endLineNumber,
              positionColumn: s.endColumn,
            })),
          );
          break;
        }
        case 'collapseToStart': {
          const sels = editor.getSelections();
          if (!sels?.length) break;
          editor.setSelections(
            sels.map((s) => ({
              selectionStartLineNumber: s.startLineNumber,
              selectionStartColumn: s.startColumn,
              positionLineNumber: s.startLineNumber,
              positionColumn: s.startColumn,
            })),
          );
          break;
        }
        default:
          break;
      }
      editor.focus();
    });
  }, [tabId]);

  const monacoLang = toMonacoLanguage(language);

  return (
    <div className="h-full min-h-0 w-full" data-tab-id={tabId}>
      <Editor
        height="100%"
        theme={resolvedTheme}
        language={monacoLang}
        path={path}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        loading={
          <div className="flex h-full items-center justify-center text-ide-sm text-ide-muted">
            Loading editor…
          </div>
        }
        options={{
          fontSize: editorSettings.fontSize,
          fontFamily: editorSettings.fontFamily,
          tabSize: editorSettings.tabSize,
          insertSpaces: editorSettings.insertSpaces,
          wordWrap: editorSettings.wordWrap,
          minimap: { enabled: editorSettings.minimap },
          lineNumbers: editorSettings.lineNumbers,
          cursorBlinking: editorSettings.cursorBlinking,
          renderWhitespace: editorSettings.renderWhitespace,
          rulers: editorSettings.rulers,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 8 },
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          // Alt+click = multi-cursor; Ctrl/Cmd+click = Go to Definition
          multiCursorModifier: 'alt',
          multiCursorMergeOverlapping: true,
          multiCursorPaste: 'spread',
          // Middle-click drag = column (box) selection like VS Code Alt+Shift+drag
          mouseMiddleClickAction: 'default',
          dragAndDrop: true,
          emptySelectionClipboard: true,
          copyWithSyntaxHighlighting: true,
          formatOnPaste: false,
          formatOnType: false,
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          inlineSuggest: { enabled: true },
          folding: true,
          foldingHighlight: true,
          // Disable Monaco built-in link click (we handle Ctrl+click ourselves)
          links: false,
          gotoLocation: {
            multiple: 'goto',
            multipleDefinitions: 'goto',
            multipleDeclarations: 'goto',
            multipleImplementations: 'goto',
            multipleReferences: 'goto',
            multipleTypeDefinitions: 'goto',
          },
          definitionLinkOpensInPeek: false,
          mouseWheelZoom: true,
          contextmenu: true,
          // Click line number gutter to select whole line; drag for multi-line
          selectOnLineNumbers: true,
          selectionHighlight: true,
          occurrencesHighlight: 'singleFile',
          find: {
            addExtraSpaceOnTop: true,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'always',
          },
        }}
      />
    </div>
  );
}
