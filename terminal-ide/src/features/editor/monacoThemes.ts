import type * as Monaco from 'monaco-editor';

/** Minimal professional dark theme for Terminal - IDE. */
export const TERMINAL_IDE_DARK: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7aa2f7' },
    { token: 'string', foreground: '9ece6a' },
    { token: 'number', foreground: 'ff9e64' },
    { token: 'type', foreground: '7dcfff' },
    { token: 'class', foreground: '7dcfff' },
    { token: 'function', foreground: 'bb9af7' },
  ],
  colors: {
    'editor.background': '#0f1115',
    'editor.foreground': '#e6e8eb',
    'editor.lineHighlightBackground': '#161a20',
    'editor.selectionBackground': '#1e3a5f',
    'editorCursor.foreground': '#e6e8eb',
    'editorWhitespace.foreground': '#2a3038',
    'editorIndentGuide.background': '#1e232b',
    'editorIndentGuide.activeBackground': '#3a424e',
    'editorLineNumber.foreground': '#4b5563',
    'editorLineNumber.activeForeground': '#9ca3af',
    'editorGutter.background': '#0f1115',
    'editorWidget.background': '#14171c',
    'editorWidget.border': '#232830',
    'editorSuggestWidget.background': '#14171c',
    'editorSuggestWidget.border': '#232830',
    'editorSuggestWidget.selectedBackground': '#1e3a5f',
    'scrollbarSlider.background': '#3a3a3a40',
    'scrollbarSlider.hoverBackground': '#4a4a4a66',
    'scrollbarSlider.activeBackground': '#5a5a5a80',
  },
};

export const TERMINAL_IDE_LIGHT: Monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#fafafa',
    'editor.foreground': '#111827',
    'editor.lineHighlightBackground': '#f3f4f6',
    'editor.selectionBackground': '#dbeafe',
    'editorLineNumber.foreground': '#9ca3af',
    'editorLineNumber.activeForeground': '#4b5563',
    'editorGutter.background': '#fafafa',
  },
};

export const THEME_DARK_ID = 'terminal-ide-dark';
export const THEME_LIGHT_ID = 'terminal-ide-light';

export function registerMonacoThemes(monaco: typeof Monaco): void {
  monaco.editor.defineTheme(THEME_DARK_ID, TERMINAL_IDE_DARK);
  monaco.editor.defineTheme(THEME_LIGHT_ID, TERMINAL_IDE_LIGHT);
}
